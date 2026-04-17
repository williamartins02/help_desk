package com.start.helpdesk.services;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.Tarefa;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.dtos.TarefaDTO;
import com.start.helpdesk.domain.enums.Prioridade;
import com.start.helpdesk.domain.enums.Status;
import com.start.helpdesk.domain.enums.StatusTarefa;
import com.start.helpdesk.repositories.ChamadoRepository;
import com.start.helpdesk.repositories.TarefaRepository;
import com.start.helpdesk.services.exception.ObjectnotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Camada de serviço responsável por toda a lógica de negócio
 * relacionada à {@link Tarefa} (Agenda do técnico).
 *
 * <p>Sincronização bidirecional em tempo real:</p>
 * <pre>
 *   Chamado ABERTO(0)     ↔  Tarefa PENDENTE(0)
 *   Chamado ANDAMENTO(1)  ↔  Tarefa EM_EXECUCAO(1)
 *   Chamado ENCERRADO(2)  ↔  Tarefa CONCLUIDO(2)
 * </pre>
 *
 * <p>Quando o técnico altera o status de uma Tarefa, o Chamado vinculado
 * é atualizado diretamente via {@link ChamadoRepository} (sem passar pelo
 * {@link ChamadoService}, evitando dependência circular) e um evento
 * WebSocket é publicado para que a Central de Chamados recarregue ao vivo.</p>
 *
 * <p>Quando o atendente altera o status de um Chamado (via {@link ChamadoService}),
 * o método {@link #sincronizarStatusPorChamado} é chamado e atualiza todas
 * as Tarefas vinculadas, publicando o evento WebSocket de volta para a Agenda.</p>
 */
@Service
public class TarefaService {

    @Autowired
    private TarefaRepository tarefaRepository;

    /**
     * ChamadoRepository injetado diretamente para atualizar o status do Chamado
     * sem criar dependência circular com ChamadoService.
     */
    @Autowired
    private ChamadoRepository chamadoRepository;

    @Autowired
    private TecnicoService tecnicoService;

    @Autowired
    private ChamadoService chamadoService;

    /** Publisher WebSocket — notifica clientes em tempo real. */
    @Autowired
    private AgendaEventPublisher agendaEventPublisher;

    // ── Consultas ─────────────────────────────────────────────────────────────

    /**
     * Busca uma tarefa pelo ID.
     *
     * @param id identificador da tarefa
     * @return tarefa encontrada
     * @throws ObjectnotFoundException se não existir
     */
    public Tarefa findById(Integer id) {
        Optional<Tarefa> obj = tarefaRepository.findById(id);
        return obj.orElseThrow(() -> new ObjectnotFoundException("Tarefa não encontrada! ID: " + id));
    }

    /**
     * Lista todas as tarefas de um técnico em uma data específica.
     * Resultados ordenados por hora_inicio.
     *
     * @param tecnicoId ID do técnico
     * @param data      data desejada (padrão: hoje quando nulo)
     * @return lista de TarefaDTO
     */
    public List<TarefaDTO> findByTecnicoAndData(Integer tecnicoId, LocalDate data) {
        LocalDate dataBusca = (data != null) ? data : LocalDate.now();
        return tarefaRepository.findByTecnicoIdAndData(tecnicoId, dataBusca)
                .stream()
                .map(TarefaDTO::new)
                .collect(Collectors.toList());
    }

    /**
     * Lista todas as tarefas de um técnico, sem filtro de data.
     *
     * @param tecnicoId ID do técnico
     * @return lista de TarefaDTO
     */
    public List<TarefaDTO> findByTecnico(Integer tecnicoId) {
        return tarefaRepository.findByTecnicoId(tecnicoId)
                .stream()
                .map(TarefaDTO::new)
                .collect(Collectors.toList());
    }

    /**
     * Lista todas as tarefas (apenas para ADMIN).
     *
     * @return lista completa de TarefaDTO
     */
    public List<TarefaDTO> findAll() {
        return tarefaRepository.findAll()
                .stream()
                .map(TarefaDTO::new)
                .collect(Collectors.toList());
    }

    /**
     * Retorna tarefas de um técnico filtradas por status.
     *
     * @param tecnicoId ID do técnico
     * @param status    status da tarefa
     * @return lista filtrada
     */
    public List<TarefaDTO> findByTecnicoAndStatus(Integer tecnicoId, StatusTarefa status) {
        return tarefaRepository.findByTecnicoIdAndStatus(tecnicoId, status)
                .stream()
                .map(TarefaDTO::new)
                .collect(Collectors.toList());
    }

    // ── Operações de escrita ──────────────────────────────────────────────────

    /**
     * Cria uma nova tarefa na agenda.
     *
     * @param dto dados da tarefa a ser criada
     * @return DTO da tarefa criada
     */
    @Transactional
    public TarefaDTO create(TarefaDTO dto) {
        Tarefa tarefa = buildTarefa(null, dto);
        return new TarefaDTO(tarefaRepository.save(tarefa));
    }

    /**
     * Atualiza todos os campos de uma tarefa existente.
     *
     * @param id  ID da tarefa a ser atualizada
     * @param dto novos dados da tarefa
     * @return DTO da tarefa atualizada
     * @throws ObjectnotFoundException se a tarefa não existir
     */
    @Transactional
    public TarefaDTO update(Integer id, TarefaDTO dto) {
        // Garante que a tarefa existe antes de atualizar
        findById(id);
        dto.setId(id);
        Tarefa tarefa = buildTarefa(id, dto);
        return new TarefaDTO(tarefaRepository.save(tarefa));
    }

    /**
     * Remove uma tarefa pelo ID.
     *
     * @param id ID da tarefa a excluir
     * @throws ObjectnotFoundException se não existir
     */
    @Transactional
    public void delete(Integer id) {
        findById(id); // valida existência antes de excluir
        tarefaRepository.deleteById(id);
    }

    /**
     * Altera o status de uma Tarefa e sincroniza o Chamado vinculado.
     *
     * <p>Mapeamento de status (Agenda → Central de Chamados):</p>
     * <ul>
     *   <li>PENDENTE(0)    → Chamado permanece ABERTO (nenhuma ação)</li>
     *   <li>EM_EXECUCAO(1) → Chamado muda para ANDAMENTO</li>
     *   <li>CONCLUIDO(2)   → Chamado muda para ENCERRADO (com data de fechamento)</li>
     * </ul>
     *
     * <p>A atualização do Chamado é feita diretamente via {@link ChamadoRepository}
     * para evitar dependência circular com {@link ChamadoService}.</p>
     *
     * @param id         ID da tarefa a alterar
     * @param novoCodigo código numérico do novo status da tarefa
     * @return DTO atualizado
     */
    @Transactional
    public TarefaDTO alterarStatus(Integer id, Integer novoCodigo) {
        StatusTarefa novoStatus = StatusTarefa.toEnum(novoCodigo);
        Tarefa tarefa = findById(id);

        // Evita reprocessar se o status já é o mesmo
        if (tarefa.getStatus() == novoStatus) {
            return new TarefaDTO(tarefa);
        }

        tarefa.setStatus(novoStatus);
        Tarefa salva = tarefaRepository.save(tarefa);

        // ── Sincroniza o Chamado vinculado ────────────────────────────────────
        if (salva.getChamado() != null) {
            sincronizarChamadoPorTarefa(salva, novoStatus);
        }

        // ── Notifica Agenda via WebSocket (auto-refresh do card) ─────────────
        agendaEventPublisher.publicarTarefaAtualizada(
            salva.getId(), novoCodigo, salva.getTecnico().getId()
        );

        return new TarefaDTO(salva);
    }

    /**
     * Sincroniza o status de todas as Tarefas vinculadas a um Chamado.
     *
     * <p>Chamado por {@link ChamadoService} quando o atendente altera o status
     * do Chamado na Central de Chamados. Garante que a Agenda reflita a mudança
     * em tempo real.</p>
     *
     * <p>Mapeamento de status (Central → Agenda):</p>
     * <ul>
     *   <li>Chamado ABERTO(0)    → Tarefa PENDENTE(0)</li>
     *   <li>Chamado ANDAMENTO(1) → Tarefa EM_EXECUCAO(1)</li>
     *   <li>Chamado ENCERRADO(2) → Tarefa CONCLUIDO(2)</li>
     * </ul>
     *
     * @param chamadoId       ID do chamado atualizado
     * @param novoStatusCodigo código numérico do novo status do chamado
     */
    @Transactional
    public void sincronizarStatusPorChamado(Integer chamadoId, Integer novoStatusCodigo) {
        StatusTarefa novoStatusTarefa = mapChamadoParaTarefa(novoStatusCodigo);
        if (novoStatusTarefa == null) return; // status sem mapeamento — sem ação

        List<Tarefa> tarefas = tarefaRepository.findByChamadoId(chamadoId);
        for (Tarefa tarefa : tarefas) {
            if (tarefa.getStatus() == novoStatusTarefa) continue; // já está sincronizado

            tarefa.setStatus(novoStatusTarefa);
            Tarefa salva = tarefaRepository.save(tarefa);

            // Notifica a Agenda via WebSocket para recarregar o card em tempo real
            agendaEventPublisher.publicarTarefaAtualizada(
                salva.getId(),
                novoStatusTarefa.getCodigo(),
                salva.getTecnico().getId()
            );
        }
    }

    // ── Criação automática a partir de chamado ────────────────────────────────

    /**
     * Cria automaticamente uma Tarefa ao abrir um Chamado.
     * Status inicial: PENDENTE (espelhando o Chamado ABERTO).
     */
    @Transactional
    public void criarTarefaParaChamado(Chamado chamado, Tecnico tecnico) {
        Tarefa tarefa = new Tarefa();
        tarefa.setTitulo("Atender: " + chamado.getTitulo());
        tarefa.setDescricao("Tarefa gerada automaticamente para o chamado #" + chamado.getId()
                            + "\n\n" + chamado.getObservacoes());
        tarefa.setData(LocalDate.now());
        tarefa.setStatus(StatusTarefa.PENDENTE);
        tarefa.setPrioridade(chamado.getPrioridade());
        tarefa.setTecnico(tecnico);
        tarefa.setChamado(chamado);
        tarefaRepository.save(tarefa);
    }

    // ── Métodos auxiliares privados ───────────────────────────────────────────

    /**
     * Atualiza o Chamado vinculado à Tarefa de acordo com o novo status da Tarefa.
     * Operação feita via ChamadoRepository para evitar dependência circular.
     *
     * <ul>
     *   <li>EM_EXECUCAO → Chamado: ANDAMENTO</li>
     *   <li>CONCLUIDO   → Chamado: ENCERRADO (com dataFechamento)</li>
     * </ul>
     */
    private void sincronizarChamadoPorTarefa(Tarefa tarefa, StatusTarefa novoStatusTarefa) {
        // Carrega o Chamado fresquinho para evitar conflito de versão
        Optional<Chamado> optChamado = chamadoRepository.findById(tarefa.getChamado().getId());
        if (optChamado.isEmpty()) return;
        Chamado chamado = optChamado.get();

        Status novoStatusChamado;
        switch (novoStatusTarefa) {
            case EM_EXECUCAO:
                if (chamado.getStatus() == Status.ABERTO) {
                    novoStatusChamado = Status.ANDAMENTO;
                } else return; // já em andamento ou encerrado — sem ação
                break;
            case CONCLUIDO:
                if (chamado.getStatus() != Status.ENCERRADO) {
                    novoStatusChamado = Status.ENCERRADO;
                    chamado.setDataFechamento(LocalDateTime.now());
                } else return; // já encerrado — sem ação
                break;
            default:
                return; // PENDENTE não altera o chamado
        }

        chamado.setStatus(novoStatusChamado);
        chamadoRepository.save(chamado);

        // Notifica a Central de Chamados via WebSocket
        agendaEventPublisher.publicarChamadoAtualizado(
            chamado.getId(),
            novoStatusChamado.getCodigo(),
            tarefa.getTecnico().getId()
        );
    }

    /**
     * Converte o código de status do Chamado para o StatusTarefa equivalente.
     *
     * @param codigoChamado 0=ABERTO, 1=ANDAMENTO, 2=ENCERRADO
     * @return StatusTarefa mapeado ou null se sem mapeamento
     */
    private StatusTarefa mapChamadoParaTarefa(Integer codigoChamado) {
        if (codigoChamado == null) return null;
        switch (codigoChamado) {
            case 0: return StatusTarefa.PENDENTE;
            case 1: return StatusTarefa.EM_EXECUCAO;
            case 2: return StatusTarefa.CONCLUIDO;
            default: return null;
        }
    }

    /**
     * Constrói uma entidade {@link Tarefa} a partir de um DTO.
     */
    private Tarefa buildTarefa(Integer id, TarefaDTO dto) {
        Tecnico tecnico = tecnicoService.findById(dto.getTecnico());
        Chamado chamado = (dto.getChamado() != null)
            ? chamadoService.findById(dto.getChamado())
            : null;

        Tarefa tarefa = new Tarefa();
        tarefa.setId(id);
        tarefa.setTitulo(dto.getTitulo());
        tarefa.setDescricao(dto.getDescricao());
        tarefa.setData(dto.getData());
        tarefa.setHoraInicio(dto.getHoraInicio());
        tarefa.setHoraFim(dto.getHoraFim());
        tarefa.setStatus(StatusTarefa.toEnum(dto.getStatus()));
        tarefa.setPrioridade(Prioridade.toEnum(dto.getPrioridade()));
        tarefa.setTecnico(tecnico);
        tarefa.setChamado(chamado);

        if (id != null) {
            tarefa.setDataCriacao(findById(id).getDataCriacao());
        }
        return tarefa;
    }
}


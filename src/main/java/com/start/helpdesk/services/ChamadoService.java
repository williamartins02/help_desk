package com.start.helpdesk.services;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import javax.validation.Valid;
import com.start.helpdesk.services.exception.DataIntegrityViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import com.start.helpdesk.services.EncerrarChamadoEmail.ChamadoEmailService;
import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.Cliente;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.dtos.ChamadoDTO;
import com.start.helpdesk.domain.enums.Classificacao;
import com.start.helpdesk.domain.enums.Prioridade;
import com.start.helpdesk.domain.enums.Status;
import com.start.helpdesk.repositories.ChamadoRepository;
import com.start.helpdesk.services.exception.ObjectnotFoundException;

@Service
public class ChamadoService {

	private static final Logger log = LoggerFactory.getLogger(ChamadoService.class);

	@Autowired
	private ChamadoRepository chamadoRepository;
	@Autowired
	private TecnicoService tecnicoService;
	@Autowired
	private ClienteService clienteService;
	@Autowired
	private ChamadoEmailService chamadoEmailService;

	/**
	 * Injeção via setter para evitar dependência circular com TarefaService.
	 * TarefaService → ChamadoService → TarefaService (ciclo).
	 * Com @Lazy o Spring resolve sem erro de startup.
	 */
	@Autowired(required = false)
	@org.springframework.context.annotation.Lazy
	private com.start.helpdesk.services.TarefaService tarefaService;

	/** Publisher WebSocket para notificar clientes em tempo real. */
	@Autowired
	private AgendaEventPublisher agendaEventPublisher;

	public Chamado findById(Integer id) {
		Optional<Chamado> object = chamadoRepository.findById(id);
		return object.orElseThrow(() -> new ObjectnotFoundException("Objeto não econtrado! ID:" + id));
	}

	public List<Chamado> findAll() {
		return chamadoRepository.findAll();
	}

	/**
	 * Versão paginada de findAll — use este método em produção quando o volume
	 * de chamados for grande. Retorna um Page com metadados (total, páginas, etc.).
	 * Endpoint: GET /chamados/page?page=0&size=20&sort=dataAbertura,desc
	 */
	public Page<ChamadoDTO> findAllPaginado(Pageable pageable) {
		Page<Chamado> page = chamadoRepository.findAll(pageable);
		return page.map(ChamadoDTO::new);
	}

	/**
	 * Versão paginada por técnico.
	 */
	public Page<ChamadoDTO> findByTecnicoIdPaginado(Integer tecnicoId, Pageable pageable) {
		Page<Chamado> page = chamadoRepository.findByTecnicoId(tecnicoId, pageable);
		return page.map(ChamadoDTO::new);
	}

	public List<Chamado> findByClienteId(Integer clienteId) {
		return chamadoRepository.findByClienteId(clienteId);
	}

	public List<Chamado> findByTecnicoId(Integer tecnicoId) {
		return chamadoRepository.findByTecnicoId(tecnicoId);
	}

	public Chamado create(@Valid ChamadoDTO objectDTO) {
		Chamado chamado = chamadoRepository.save(newChamado(objectDTO));

		// Criação automática de tarefa na agenda do técnico ao abrir um chamado
		if (tarefaService != null) {
			try {
				Tecnico tecnico = tecnicoService.findById(chamado.getTecnico().getId());
				tarefaService.criarTarefaParaChamado(chamado, tecnico);
			} catch (Exception e) {
				// Falha na criação da tarefa não impede a criação do chamado
				log.warn("Falha ao criar tarefa para o chamado id={}: {}", chamado.getId(), e.getMessage());
			}
		}

		// ── Notifica Kanban e Central via WebSocket (CHAMADO_CRIADO) ────────────
		// Garante que ambas as telas recebam o novo chamado em tempo real,
		// sem necessidade de recarregar manualmente.
		try {
			agendaEventPublisher.publicarChamadoCriado(
				chamado.getId(),
				chamado.getStatus().getCodigo(),
				chamado.getTecnico().getId()
			);
			agendaEventPublisher.publicarBiRefresh();
		} catch (Exception e) { /* WebSocket não deve bloquear a criação */
			log.warn("Falha ao publicar evento WebSocket para chamado id={}: {}", chamado.getId(), e.getMessage());
		}

		return chamado;
	}

	public Chamado update(Integer id, @Valid ChamadoDTO objectDTO) {
		objectDTO.setId(id);
		Chamado oldObject = findById(id);
		/* Chamado ENCERRADO não pode ser reaberto; um novo chamado deve ser criado */
		if (oldObject.getStatus() == Status.ENCERRADO) {
			throw new DataIntegrityViolationException(
				"Chamado encerrado não pode ser reaberto. Crie um novo chamado se necessário.");
		}
		boolean vaiEncerrar = objectDTO.getStatus().equals(Status.ENCERRADO.getCodigo());
		Chamado updated = newChamado(objectDTO);
		// Preserve original opening date and SLA deadline on updates
		updated.setDataAbertura(oldObject.getDataAbertura());
		updated.setPrazoSla(oldObject.getPrazoSla());
		Chamado salvo = chamadoRepository.save(updated);
		if (vaiEncerrar) {
			chamadoEmailService.sendChamadoEncerradoEmail(salvo);
		}

		// ── Sincroniza as Tarefas vinculadas (Agenda ↔ Central) ──────────────
		// Converte o status do chamado e atualiza todas as tarefas vinculadas via TarefaService.
		// O TarefaService também publica o evento WebSocket para a Agenda recarregar ao vivo.
		if (tarefaService != null) {
			try {
				tarefaService.sincronizarStatusPorChamado(salvo.getId(), salvo.getStatus().getCodigo());
			} catch (Exception e) {
				log.warn("Falha ao sincronizar tarefas para chamado id={}: {}", salvo.getId(), e.getMessage());
			}
		}

		// ── Notifica Central de Chamados via WebSocket (auto-refresh da lista) ─
		try {
			agendaEventPublisher.publicarChamadoAtualizado(
				salvo.getId(),
				salvo.getStatus().getCodigo(),
				salvo.getTecnico().getId()
			);
			agendaEventPublisher.publicarBiRefresh();
		} catch (Exception e) { /* WebSocket não deve bloquear a operação */
			log.warn("Falha ao publicar evento WebSocket de atualização para chamado id={}: {}", salvo.getId(), e.getMessage());
		}

		return salvo;
	}

	/* metodo privado para ATUALIZAR ou CRIAR um novo chamado. */
	private Chamado newChamado(ChamadoDTO object) {
		Tecnico tecnico = tecnicoService.findById(object.getTecnico());
		Cliente cliente = clienteService.findById(object.getCliente());

		Chamado chamado = new Chamado();
		if (object.getId() != null) {
			chamado.setId((object.getId()));
		}
		/* Se o chamado for "ENCERRADO(2)" retorna dia do fechamento */
		if (object.getStatus().equals(2)) {
			chamado.setDataFechamento(LocalDateTime.now());
		}
		/* Calcula prazoSla apenas em novos chamados (sem ID) */
		if (object.getId() == null) {
			chamado.setPrazoSla(calcularPrazoSla(Prioridade.toEnum(object.getPrioridade()), chamado.getDataAbertura()));
		}
		chamado.setTecnico(tecnico);
		chamado.setCliente(cliente);
		chamado.setPrioridade(Prioridade.toEnum(object.getPrioridade()));
		chamado.setStatus(Status.toEnum(object.getStatus()));
		chamado.setClassificacao(Classificacao.toEnum(object.getClassificacao()));
		chamado.setTitulo(object.getTitulo());
		chamado.setObservacoes(object.getObservacoes());
		return chamado;
	}

	/**
	 * Calcula o prazo de SLA com base na prioridade do chamado:
	 * BAIXA → 24h | MEDIA → 8h | ALTA → 4h | CRITICA → 2h
	 */
	public static LocalDateTime calcularPrazoSla(Prioridade prioridade, LocalDateTime dataAbertura) {
		switch (prioridade) {
			case BAIXA:   return dataAbertura.plusHours(24);
			case MEDIA:   return dataAbertura.plusHours(8);
			case ALTA:    return dataAbertura.plusHours(4);
			case CRITICA: return dataAbertura.plusHours(2);
			default:      return dataAbertura.plusHours(8);
		}
	}

}

package com.start.helpdesk.resources;

import com.start.helpdesk.domain.Pessoa;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.dtos.TarefaDTO;
import com.start.helpdesk.domain.enums.Perfil;
import com.start.helpdesk.services.PessoaService;
import com.start.helpdesk.services.TarefaService;
import com.start.helpdesk.services.TecnicoService;
import com.start.helpdesk.services.exception.UnauthorizedException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import javax.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * REST Controller para gerenciamento da Agenda de Tarefas dos técnicos.
 *
 * <p>Endpoints disponíveis:</p>
 * <ul>
 *   <li>POST   /tarefas                   → criar tarefa</li>
 *   <li>GET    /tarefas                   → listar tarefas (filtro por data/técnico)</li>
 *   <li>GET    /tarefas/{id}              → detalhar tarefa</li>
 *   <li>PUT    /tarefas/{id}              → atualizar tarefa</li>
 *   <li>PATCH  /tarefas/{id}/status       → alterar apenas o status</li>
 *   <li>DELETE /tarefas/{id}              → excluir tarefa</li>
 * </ul>
 *
 * <p>Segurança:</p>
 * <ul>
 *   <li>ADMIN pode ver e gerenciar tarefas de qualquer técnico</li>
 *   <li>TECNICO só acessa as próprias tarefas</li>
 * </ul>
 */
@RestController
@RequestMapping("/tarefas")
public class TarefaResource {

    @Autowired
    private TarefaService tarefaService;

    @Autowired
    private PessoaService pessoaService;

    @Autowired
    private TecnicoService tecnicoService;

    // ── GET /tarefas/{id} ─────────────────────────────────────────────────────

    /**
     * Retorna o detalhe de uma tarefa pelo ID.
     *
     * @param id identificador da tarefa
     * @return TarefaDTO com todos os campos
     */
    @GetMapping("/{id}")
    public ResponseEntity<TarefaDTO> findById(@PathVariable Integer id) {
        Pessoa pessoa = getPessoaAutenticada();
        TarefaDTO dto = new TarefaDTO(tarefaService.findById(id));

        // Técnico só pode ver as próprias tarefas
        if (!pessoa.getPerfis().contains(Perfil.ADMIN)
                && !dto.getTecnico().equals(pessoa.getId())) {
            throw new UnauthorizedException("Acesso negado: tarefa não pertence a este técnico");
        }
        return ResponseEntity.ok(dto);
    }

    // ── GET /tarefas ──────────────────────────────────────────────────────────

    /**
     * Lista tarefas com filtros opcionais de data e técnico.
     *
     * <p>Comportamento por perfil:</p>
     * <ul>
     *   <li>ADMIN: pode filtrar por qualquer tecnicoId; sem tecnicoId retorna todas</li>
     *   <li>TECNICO: sempre retorna apenas as próprias tarefas</li>
     * </ul>
     *
     * @param data      filtro de data (dd/MM/yyyy) — opcional
     * @param tecnicoId filtro por técnico — ignorado para perfil TECNICO
     * @return lista de TarefaDTO
     */
    @GetMapping
    public ResponseEntity<List<TarefaDTO>> findAll(
            @RequestParam(required = false)
            @DateTimeFormat(pattern = "dd/MM/yyyy") LocalDate data,
            @RequestParam(required = false) Integer tecnicoId) {

        Pessoa pessoa = getPessoaAutenticada();
        List<TarefaDTO> lista;

        if (pessoa.getPerfis().contains(Perfil.ADMIN)) {
            // ADMIN: filtro por técnico (opcional) + data (opcional)
            if (tecnicoId != null && data != null) {
                lista = tarefaService.findByTecnicoAndData(tecnicoId, data);
            } else if (tecnicoId != null) {
                lista = tarefaService.findByTecnico(tecnicoId);
            } else {
                lista = tarefaService.findAll();
            }
        } else {
            // TECNICO: ignora tecnicoId do request, usa sempre o próprio ID
            Tecnico tecnico = tecnicoService.findByEmail(getEmailAutenticado());
            lista = (data != null)
                    ? tarefaService.findByTecnicoAndData(tecnico.getId(), data)
                    : tarefaService.findByTecnico(tecnico.getId());
        }

        return ResponseEntity.ok(lista);
    }

    // ── POST /tarefas ─────────────────────────────────────────────────────────

    /**
     * Cria uma nova tarefa na agenda.
     *
     * <p>TECNICO só pode criar tarefas para si mesmo.</p>
     *
     * @param dto dados da nova tarefa
     * @return 201 Created com Location header
     */
    @PostMapping
    public ResponseEntity<TarefaDTO> create(@Valid @RequestBody TarefaDTO dto) {
        Pessoa pessoa = getPessoaAutenticada();

        // Técnico não pode criar tarefa para outro técnico
        if (!pessoa.getPerfis().contains(Perfil.ADMIN)
                && !dto.getTecnico().equals(pessoa.getId())) {
            throw new UnauthorizedException("Técnico só pode criar tarefas para si mesmo");
        }

        TarefaDTO criada = tarefaService.create(dto);
        URI uri = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}").buildAndExpand(criada.getId()).toUri();
        return ResponseEntity.created(uri).body(criada);
    }

    // ── PUT /tarefas/{id} ─────────────────────────────────────────────────────

    /**
     * Atualiza todos os campos de uma tarefa.
     *
     * @param id  ID da tarefa
     * @param dto novos dados
     * @return TarefaDTO atualizado
     */
    @PutMapping("/{id}")
    public ResponseEntity<TarefaDTO> update(@PathVariable Integer id,
                                            @Valid @RequestBody TarefaDTO dto) {
        Pessoa pessoa = getPessoaAutenticada();
        validarPropriedade(pessoa, id);

        return ResponseEntity.ok(tarefaService.update(id, dto));
    }

    // ── PATCH /tarefas/{id}/status ────────────────────────────────────────────

    /**
     * Altera apenas o status de uma tarefa (Iniciar / Concluir).
     *
     * <p>Corpo esperado: {@code { "status": 1 } }</p>
     *
     * @param id   ID da tarefa
     * @param body mapa contendo a chave "status" com código numérico
     * @return TarefaDTO com o status atualizado
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<TarefaDTO> alterarStatus(@PathVariable Integer id,
                                                    @RequestBody Map<String, Integer> body) {
        Pessoa pessoa = getPessoaAutenticada();
        validarPropriedade(pessoa, id);

        Integer novoCodigo = body.get("status");
        if (novoCodigo == null) {
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(tarefaService.alterarStatus(id, novoCodigo));
    }

    // ── DELETE /tarefas/{id} ──────────────────────────────────────────────────

    /**
     * Remove uma tarefa pelo ID.
     *
     * @param id ID da tarefa a excluir
     * @return 204 No Content
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        Pessoa pessoa = getPessoaAutenticada();
        validarPropriedade(pessoa, id);

        tarefaService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ── Métodos auxiliares privados ───────────────────────────────────────────

    /**
     * Obtém o e-mail do usuário autenticado via SecurityContext.
     *
     * @return e-mail do usuário logado
     */
    private String getEmailAutenticado() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth.getPrincipal() instanceof UserDetails) {
            return ((UserDetails) auth.getPrincipal()).getUsername();
        }
        return auth.getPrincipal().toString();
    }

    /**
     * Obtém a entidade {@link Pessoa} do usuário autenticado.
     *
     * @return Pessoa autenticada
     * @throws UnauthorizedException se não encontrada
     */
    private Pessoa getPessoaAutenticada() {
        Pessoa pessoa = pessoaService.findByEmail(getEmailAutenticado());
        if (pessoa == null) {
            throw new UnauthorizedException("Usuário não autenticado");
        }
        return pessoa;
    }

    /**
     * Valida que um técnico autenticado só opera em suas próprias tarefas.
     * ADMIN não passa por esta verificação.
     *
     * @param pessoa  usuário autenticado
     * @param tarefaId ID da tarefa alvo
     * @throws UnauthorizedException se o técnico não for o dono da tarefa
     */
    private void validarPropriedade(Pessoa pessoa, Integer tarefaId) {
        if (!pessoa.getPerfis().contains(Perfil.ADMIN)) {
            TarefaDTO dto = new TarefaDTO(tarefaService.findById(tarefaId));
            if (!dto.getTecnico().equals(pessoa.getId())) {
                throw new UnauthorizedException("Acesso negado: tarefa não pertence a este técnico");
            }
        }
    }
}


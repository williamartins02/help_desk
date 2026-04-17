package com.start.helpdesk.domain.dtos;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.start.helpdesk.domain.Tarefa;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Data Transfer Object (DTO) para a entidade {@link Tarefa}.
 *
 * <p>Utilizado tanto para receber dados nas requisições (POST/PUT)
 * quanto para retornar informações nas respostas da API.</p>
 *
 * <p>Campos de leitura apenas (nomeTecnico, nomeCliente, tituloChamado)
 * são preenchidos pelo service ao montar a resposta.</p>
 */
@Getter
@Setter
@ToString
public class TarefaDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    /** Identificador da tarefa (nulo para criação). */
    private Integer id;

    /** Título da tarefa — obrigatório. */
    @NotBlank(message = "Campo TITULO é obrigatório")
    private String titulo;

    /** Descrição completa da tarefa. */
    private String descricao;

    /**
     * Data de execução da tarefa.
     * Formato esperado: dd/MM/yyyy
     */
    @NotNull(message = "Campo DATA é obrigatório")
    @JsonFormat(pattern = "dd/MM/yyyy")
    private LocalDate data;

    /** Hora de início prevista (HH:mm). */
    @JsonFormat(pattern = "HH:mm")
    private LocalTime horaInicio;

    /** Hora de término prevista (HH:mm). */
    @JsonFormat(pattern = "HH:mm")
    private LocalTime horaFim;

    /**
     * Código numérico do status da tarefa.
     * 0 = PENDENTE | 1 = EM_EXECUCAO | 2 = CONCLUIDO
     */
    @NotNull(message = "Campo STATUS é obrigatório")
    private Integer status;

    /**
     * Código numérico da prioridade.
     * 0 = BAIXA | 1 = MEDIA | 2 = ALTA | 3 = CRITICA
     */
    @NotNull(message = "Campo PRIORIDADE é obrigatório")
    private Integer prioridade;

    /** ID do técnico responsável pela tarefa — obrigatório. */
    @NotNull(message = "Campo TÉCNICO é obrigatório")
    private Integer tecnico;

    /**
     * ID do chamado vinculado (opcional).
     * Pode ser nulo para tarefas internas.
     */
    private Integer chamado;

    // ── Campos de leitura (populados pelo service) ────────────────────────────

    /** Nome do técnico responsável (somente leitura). */
    private String nomeTecnico;

    /** Título do chamado vinculado (somente leitura, pode ser nulo). */
    private String tituloChamado;

    /** Nome do cliente do chamado vinculado (somente leitura, pode ser nulo). */
    private String nomeCliente;

    /** Data/hora de criação da tarefa (somente leitura). */
    @JsonFormat(pattern = "dd/MM/yyyy - HH:mm")
    private LocalDateTime dataCriacao;

    // ── Construtores ──────────────────────────────────────────────────────────

    public TarefaDTO() {
        super();
    }

    /**
     * Construtor que converte uma entidade {@link Tarefa} em DTO.
     *
     * @param tarefa entidade a ser convertida
     */
    public TarefaDTO(Tarefa tarefa) {
        this.id           = tarefa.getId();
        this.titulo       = tarefa.getTitulo();
        this.descricao    = tarefa.getDescricao();
        this.data         = tarefa.getData();
        this.horaInicio   = tarefa.getHoraInicio();
        this.horaFim      = tarefa.getHoraFim();
        this.status       = tarefa.getStatus().getCodigo();
        this.prioridade   = tarefa.getPrioridade().getCodigo();
        this.dataCriacao  = tarefa.getDataCriacao();
        this.tecnico      = tarefa.getTecnico().getId();
        this.nomeTecnico  = tarefa.getTecnico().getNome();

        // Campos opcionais do chamado vinculado
        if (tarefa.getChamado() != null) {
            this.chamado      = tarefa.getChamado().getId();
            this.tituloChamado = tarefa.getChamado().getTitulo();
            this.nomeCliente  = tarefa.getChamado().getCliente() != null
                                ? tarefa.getChamado().getCliente().getNome()
                                : null;
        }
    }
}


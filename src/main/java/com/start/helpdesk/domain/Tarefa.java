package com.start.helpdesk.domain;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.start.helpdesk.domain.enums.Prioridade;
import com.start.helpdesk.domain.enums.StatusTarefa;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

import javax.persistence.*;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Entidade que representa uma Tarefa na Agenda do técnico.
 *
 * <p>Uma tarefa pode estar vinculada a um {@link Chamado} existente ou
 * existir de forma independente (tarefa interna).</p>
 *
 * <p>Relacionamentos:</p>
 * <ul>
 *   <li>Tarefa → Técnico  (N:1) — cada tarefa pertence a um único técnico</li>
 *   <li>Tarefa → Chamado  (N:1) — associação opcional a um chamado</li>
 * </ul>
 */
@Getter
@Setter
@ToString
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Entity
@Table(name = "tarefa")
public class Tarefa implements Serializable {
    private static final long serialVersionUID = 1L;

    /** Identificador único da tarefa (gerado pelo banco). */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @EqualsAndHashCode.Include
    private Integer id;

    /** Título curto e descritivo da tarefa. */
    @Column(nullable = false, length = 150)
    private String titulo;

    /** Descrição detalhada do que deve ser feito. */
    @Column(columnDefinition = "TEXT")
    private String descricao;

    /**
     * Data em que a tarefa deve ser executada.
     * Formato de exibição: dd/MM/yyyy
     */
    @JsonFormat(pattern = "dd/MM/yyyy")
    @Column(nullable = false)
    private LocalDate data;

    /**
     * Hora prevista de início da tarefa.
     * Formato de exibição: HH:mm
     */
    @JsonFormat(pattern = "HH:mm")
    private LocalTime horaInicio;

    /**
     * Hora prevista de término da tarefa.
     * Formato de exibição: HH:mm
     */
    @JsonFormat(pattern = "HH:mm")
    private LocalTime horaFim;

    /**
     * Status atual da tarefa.
     * @see StatusTarefa
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusTarefa status = StatusTarefa.PENDENTE;

    /**
     * Nível de prioridade herdado do mesmo enum do {@link Chamado}.
     * @see Prioridade
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Prioridade prioridade = Prioridade.MEDIA;

    /**
     * Técnico responsável pela tarefa.
     * Obrigatório — uma tarefa sempre pertence a um técnico.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tecnico_id", nullable = false)
    private Tecnico tecnico;

    /**
     * Chamado relacionado à tarefa (opcional).
     * Quando presente, a tarefa é originada a partir de um chamado.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chamado_id")
    private Chamado chamado;

    /**
     * Data e hora em que a tarefa foi criada no sistema.
     * Preenchido automaticamente na construção do objeto.
     */
    @JsonFormat(pattern = "dd/MM/yyyy - HH:mm")
    @Column(name = "data_criacao", nullable = false, updatable = false)
    private LocalDateTime dataCriacao = LocalDateTime.now();

    // ── Construtores ──────────────────────────────────────────────────────────

    public Tarefa() {
        super();
    }

    public Tarefa(String titulo, String descricao, LocalDate data,
                  LocalTime horaInicio, LocalTime horaFim,
                  Prioridade prioridade, Tecnico tecnico, Chamado chamado) {
        this.titulo     = titulo;
        this.descricao  = descricao;
        this.data       = data;
        this.horaInicio = horaInicio;
        this.horaFim    = horaFim;
        this.prioridade = prioridade;
        this.tecnico    = tecnico;
        this.chamado    = chamado;
    }
}


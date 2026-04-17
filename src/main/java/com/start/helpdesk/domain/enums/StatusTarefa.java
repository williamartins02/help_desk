package com.start.helpdesk.domain.enums;

/**
 * Representa os possíveis estados de uma Tarefa na agenda do técnico.
 *
 * PENDENTE    → tarefa criada, aguardando início
 * EM_EXECUCAO → técnico iniciou o atendimento
 * CONCLUIDO   → tarefa finalizada
 */
public enum StatusTarefa {

    PENDENTE(0, "PENDENTE"),
    EM_EXECUCAO(1, "EM_EXECUCAO"),
    CONCLUIDO(2, "CONCLUIDO");

    private final Integer codigo;
    private final String descricao;

    StatusTarefa(Integer codigo, String descricao) {
        this.codigo = codigo;
        this.descricao = descricao;
    }

    public Integer getCodigo() { return codigo; }
    public String getDescricao() { return descricao; }

    /**
     * Converte um código inteiro para o enum correspondente.
     *
     * @param cod código numérico do status
     * @return StatusTarefa correspondente
     * @throws IllegalArgumentException se o código não for reconhecido
     */
    public static StatusTarefa toEnum(Integer cod) {
        if (cod == null) return null;
        for (StatusTarefa s : StatusTarefa.values()) {
            if (cod.equals(s.getCodigo())) return s;
        }
        throw new IllegalArgumentException("StatusTarefa inválido: " + cod);
    }
}


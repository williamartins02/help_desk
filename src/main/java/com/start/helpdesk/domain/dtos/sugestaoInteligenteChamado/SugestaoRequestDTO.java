package com.start.helpdesk.domain.dtos.sugestaoInteligenteChamado;

import java.io.Serializable;

import lombok.Getter;
import lombok.Setter;

/**
 * Payload de entrada para os endpoints de inteligência.
 * Todos os campos são opcionais — quanto mais preenchidos, melhor a sugestão.
 */
@Getter @Setter
public class SugestaoRequestDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private String titulo;
    private String observacoes;
    /** Código da classificação (0=HARDWARE, 1=SOFTWARE, 2=REDES, 3=BANCO) — opcional */
    private Integer classificacao;
}


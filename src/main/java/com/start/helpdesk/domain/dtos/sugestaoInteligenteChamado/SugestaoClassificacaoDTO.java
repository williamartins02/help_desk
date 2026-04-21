package com.start.helpdesk.domain.dtos.sugestaoInteligenteChamado;

import java.io.Serializable;

import lombok.Getter;
import lombok.Setter;

/**
 * Resposta da sugestão automática de classificação/categoria.
 */
@Getter @Setter
public class SugestaoClassificacaoDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer classificacaoCodigo;
    private String classificacaoNome;
    private long totalOcorrencias;
}


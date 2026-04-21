package com.start.helpdesk.domain.dtos.sugestaoInteligenteChamado;

import java.io.Serializable;

import lombok.Getter;
import lombok.Setter;

/**
 * Representa um chamado semelhante já resolvido, exibido como referência.
 */
@Getter @Setter
public class ChamadoSemelhantDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer id;
    private String titulo;
    private String nomeTecnico;
    /** Tempo de resolução formatado, ex.: "30 min" */
    private String tempoResolucao;
    private String status;
    private String classificacao;
}


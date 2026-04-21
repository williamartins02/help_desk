package com.start.helpdesk.domain.dtos.sugestaoInteligenteChamado;

import java.io.Serializable;

import lombok.Getter;
import lombok.Setter;

/**
 * Resposta da sugestão automática de técnico.
 */
@Getter @Setter
public class SugestaoTecnicoDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer tecnicoId;
    private String nomeTecnico;
    private long totalChamadosSemelhantes;
    /** Tempo médio de resolução formatado, ex.: "15 min" ou "2h 30min" */
    private String tempoMedioResolucao;
}


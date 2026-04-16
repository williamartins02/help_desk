package com.start.helpdesk.domain.dtos;

import java.io.Serializable;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.start.helpdesk.domain.Chamado;

import lombok.Getter;
import lombok.Setter;

/**
 * DTO leve para exibir chamados pendentes de um técnico no modal de reatribuição.
 */
@Getter
@Setter
public class ChamadoPendenteInfoDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer id;
    private String titulo;
    private String nomeCliente;
    private String prioridade;
    private String status;

    @JsonFormat(pattern = "dd/MM/yyyy - HH:mm")
    private LocalDateTime dataAbertura;

    public ChamadoPendenteInfoDTO(Chamado chamado) {
        this.id = chamado.getId();
        this.titulo = chamado.getTitulo();
        this.nomeCliente = chamado.getCliente() != null ? chamado.getCliente().getNome() : "";
        this.prioridade = chamado.getPrioridade() != null ? chamado.getPrioridade().getDescricao() : "";
        this.status = chamado.getStatus() != null ? chamado.getStatus().getDescricao() : "";
        this.dataAbertura = chamado.getDataAbertura();
    }
}


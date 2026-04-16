package com.start.helpdesk.domain.dtos;

import java.io.Serializable;

public class SlaAlertDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer chamadoId;
    private String titulo;
    private String statusSla;     // "ALERTA" | "ATRASADO"
    private String prioridade;
    private String nomeTecnico;
    private String tempoRestante; // ex: "01:30:00" ou "-00:15:00"

    public SlaAlertDTO() {}

    public SlaAlertDTO(Integer chamadoId, String titulo, String statusSla,
                       String prioridade, String nomeTecnico, String tempoRestante) {
        this.chamadoId = chamadoId;
        this.titulo = titulo;
        this.statusSla = statusSla;
        this.prioridade = prioridade;
        this.nomeTecnico = nomeTecnico;
        this.tempoRestante = tempoRestante;
    }

    public Integer getChamadoId()   { return chamadoId; }
    public String getTitulo()       { return titulo; }
    public String getStatusSla()    { return statusSla; }
    public String getPrioridade()   { return prioridade; }
    public String getNomeTecnico()  { return nomeTecnico; }
    public String getTempoRestante(){ return tempoRestante; }
}


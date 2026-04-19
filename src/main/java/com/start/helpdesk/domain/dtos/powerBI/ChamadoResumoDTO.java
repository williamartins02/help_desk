package com.start.helpdesk.domain.dtos.powerBI;

import java.io.Serializable;

public class ChamadoResumoDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer id;
    private String titulo;
    private String tecnico;
    private String cliente;
    private String status;
    private String prioridade;
    private String tempoResolucao;
    private String statusSla;

    public ChamadoResumoDTO() {}

    public ChamadoResumoDTO(Integer id, String titulo, String tecnico, String cliente,
                             String status, String prioridade, String tempoResolucao, String statusSla) {
        this.id = id;
        this.titulo = titulo;
        this.tecnico = tecnico;
        this.cliente = cliente;
        this.status = status;
        this.prioridade = prioridade;
        this.tempoResolucao = tempoResolucao;
        this.statusSla = statusSla;
    }

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getTecnico() { return tecnico; }
    public void setTecnico(String tecnico) { this.tecnico = tecnico; }
    public String getCliente() { return cliente; }
    public void setCliente(String cliente) { this.cliente = cliente; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getPrioridade() { return prioridade; }
    public void setPrioridade(String prioridade) { this.prioridade = prioridade; }
    public String getTempoResolucao() { return tempoResolucao; }
    public void setTempoResolucao(String tempoResolucao) { this.tempoResolucao = tempoResolucao; }
    public String getStatusSla() { return statusSla; }
    public void setStatusSla(String statusSla) { this.statusSla = statusSla; }
}


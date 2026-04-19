package com.start.helpdesk.domain.dtos.powerBI;
import java.io.Serializable;
public class TecnicoMetricaDTO implements Serializable {
    private static final long serialVersionUID = 1L;
    private Integer id;
    private String nome;
    private int totalResolvidos;
    private double tempoMedioResolucaoMins;
    private double slaPercent;
    private int posicao;
    public TecnicoMetricaDTO() {}
    public TecnicoMetricaDTO(Integer id, String nome, int totalResolvidos, double tempoMedioResolucaoMins, double slaPercent) {
        this.id = id; this.nome = nome; this.totalResolvidos = totalResolvidos;
        this.tempoMedioResolucaoMins = tempoMedioResolucaoMins; this.slaPercent = slaPercent;
    }
    public Integer getId() { return id; } public void setId(Integer id) { this.id = id; }
    public String getNome() { return nome; } public void setNome(String nome) { this.nome = nome; }
    public int getTotalResolvidos() { return totalResolvidos; } public void setTotalResolvidos(int v) { this.totalResolvidos = v; }
    public double getTempoMedioResolucaoMins() { return tempoMedioResolucaoMins; } public void setTempoMedioResolucaoMins(double v) { this.tempoMedioResolucaoMins = v; }
    public double getSlaPercent() { return slaPercent; } public void setSlaPercent(double v) { this.slaPercent = v; }
    public int getPosicao() { return posicao; } public void setPosicao(int v) { this.posicao = v; }
}
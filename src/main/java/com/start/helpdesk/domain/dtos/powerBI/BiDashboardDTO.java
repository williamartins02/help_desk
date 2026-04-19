package com.start.helpdesk.domain.dtos.powerBI;

import java.io.Serializable;
import java.util.List;
import java.util.Map;
public class BiDashboardDTO implements Serializable {
    private static final long serialVersionUID = 1L;
    private long totalChamados;
    private long totalEncerrados;
    private long totalAbertos;
    private long totalAndamento;
    private long totalCriticos;
    private double tempoMedioResolucaoMins;
    private double slaPercent;
    private Map<String, Long> porCategoria;
    private Map<String, Long> porStatus;
    private Map<String, Long> porPrioridade;
    private List<TecnicoMetricaDTO> tecnicosRanking;
    private List<EvolucaoDiaDTO> evolucao;
    private List<String> alertasGargalo;
    public BiDashboardDTO() {}
    public long getTotalChamados() { return totalChamados; } public void setTotalChamados(long v) { this.totalChamados = v; }
    public long getTotalEncerrados() { return totalEncerrados; } public void setTotalEncerrados(long v) { this.totalEncerrados = v; }
    public long getTotalAbertos() { return totalAbertos; } public void setTotalAbertos(long v) { this.totalAbertos = v; }
    public long getTotalAndamento() { return totalAndamento; } public void setTotalAndamento(long v) { this.totalAndamento = v; }
    public long getTotalCriticos() { return totalCriticos; } public void setTotalCriticos(long v) { this.totalCriticos = v; }
    public double getTempoMedioResolucaoMins() { return tempoMedioResolucaoMins; } public void setTempoMedioResolucaoMins(double v) { this.tempoMedioResolucaoMins = v; }
    public double getSlaPercent() { return slaPercent; } public void setSlaPercent(double v) { this.slaPercent = v; }
    public Map<String, Long> getPorCategoria() { return porCategoria; } public void setPorCategoria(Map<String, Long> v) { this.porCategoria = v; }
    public Map<String, Long> getPorStatus() { return porStatus; } public void setPorStatus(Map<String, Long> v) { this.porStatus = v; }
    public Map<String, Long> getPorPrioridade() { return porPrioridade; } public void setPorPrioridade(Map<String, Long> v) { this.porPrioridade = v; }
    public List<TecnicoMetricaDTO> getTecnicosRanking() { return tecnicosRanking; } public void setTecnicosRanking(List<TecnicoMetricaDTO> v) { this.tecnicosRanking = v; }
    public List<EvolucaoDiaDTO> getEvolucao() { return evolucao; } public void setEvolucao(List<EvolucaoDiaDTO> v) { this.evolucao = v; }
    public List<String> getAlertasGargalo() { return alertasGargalo; } public void setAlertasGargalo(List<String> v) { this.alertasGargalo = v; }
}

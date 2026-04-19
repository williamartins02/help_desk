package com.start.helpdesk.domain.dtos.powerBI;
import java.io.Serializable;
public class EvolucaoDiaDTO implements Serializable {
    private static final long serialVersionUID = 1L;
    private String data;
    private long abertos;
    private long encerrados;
    private long emAndamento;
    public EvolucaoDiaDTO() {}
    public EvolucaoDiaDTO(String data, long abertos, long encerrados, long emAndamento) {
        this.data = data; this.abertos = abertos; this.encerrados = encerrados; this.emAndamento = emAndamento;
    }
    public String getData() { return data; } public void setData(String data) { this.data = data; }
    public long getAbertos() { return abertos; } public void setAbertos(long v) { this.abertos = v; }
    public long getEncerrados() { return encerrados; } public void setEncerrados(long v) { this.encerrados = v; }
    public long getEmAndamento() { return emAndamento; } public void setEmAndamento(long v) { this.emAndamento = v; }
}
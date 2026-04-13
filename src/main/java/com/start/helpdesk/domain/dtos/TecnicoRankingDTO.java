package com.start.helpdesk.domain.dtos;

import java.util.List;

public class TecnicoRankingDTO {
    private Integer id;
    private String nome;
    private String email;
    private int chamadosResolvidosMes;
    private double avaliacaoMedia;
    private List<EvolucaoDTO> evolucao;

    public TecnicoRankingDTO() {}

    public TecnicoRankingDTO(Integer id, String nome, String email, int chamadosResolvidosMes, double avaliacaoMedia, List<EvolucaoDTO> evolucao) {
        this.id = id;
        this.nome = nome;
        this.email = email;
        this.chamadosResolvidosMes = chamadosResolvidosMes;
        this.avaliacaoMedia = avaliacaoMedia;
        this.evolucao = evolucao;
    }

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }
    public String getNome() { return nome; }
    public void setNome(String nome) { this.nome = nome; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public int getChamadosResolvidosMes() { return chamadosResolvidosMes; }
    public void setChamadosResolvidosMes(int chamadosResolvidosMes) { this.chamadosResolvidosMes = chamadosResolvidosMes; }
    public double getAvaliacaoMedia() { return avaliacaoMedia; }
    public void setAvaliacaoMedia(double avaliacaoMedia) { this.avaliacaoMedia = avaliacaoMedia; }
    public List<EvolucaoDTO> getEvolucao() { return evolucao; }
    public void setEvolucao(List<EvolucaoDTO> evolucao) { this.evolucao = evolucao; }

    // DTO para evolução do técnico ao longo do tempo
    public static class EvolucaoDTO {
        private String periodo;
        private int chamadosResolvidos;
        private double avaliacaoMedia;

        public EvolucaoDTO() {}
        public EvolucaoDTO(String periodo, int chamadosResolvidos, double avaliacaoMedia) {
            this.periodo = periodo;
            this.chamadosResolvidos = chamadosResolvidos;
            this.avaliacaoMedia = avaliacaoMedia;
        }
        public String getPeriodo() { return periodo; }
        public void setPeriodo(String periodo) { this.periodo = periodo; }
        public int getChamadosResolvidos() { return chamadosResolvidos; }
        public void setChamadosResolvidos(int chamadosResolvidos) { this.chamadosResolvidos = chamadosResolvidos; }
        public double getAvaliacaoMedia() { return avaliacaoMedia; }
        public void setAvaliacaoMedia(double avaliacaoMedia) { this.avaliacaoMedia = avaliacaoMedia; }
    }
}

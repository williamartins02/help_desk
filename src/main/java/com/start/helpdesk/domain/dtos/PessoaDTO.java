package com.start.helpdesk.domain.dtos;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.start.helpdesk.domain.Cliente;
import com.start.helpdesk.domain.Pessoa;
import com.start.helpdesk.domain.enums.Perfil;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * DTO unificado para listagem de todos os usuários do sistema
 * (Técnicos e Clientes), incluindo seus perfis de acesso.
 */
public class PessoaDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private Integer id;
    private String  nome;
    private String  cpf;
    private String  email;
    private Set<String> perfis;

    @JsonFormat(pattern = "dd/MM/yyyy")
    private LocalDate dataCriacao;

    /** "TECNICO" ou "CLIENTE" — derivado do tipo da entidade */
    private String tipo;

    /** Foto de perfil armazenada como Base64 (somente técnicos possuem) */
    private String fotoPerfil;

    public PessoaDTO(Pessoa pessoa) {
        this.id          = pessoa.getId();
        this.nome        = pessoa.getNome();
        this.cpf         = pessoa.getCpf();
        this.email       = pessoa.getEmail();
        this.perfis      = pessoa.getPerfis().stream()
                                  .map(Perfil::getDescricao)
                                  .collect(Collectors.toSet());
        this.dataCriacao = pessoa.getDataCriacao();
        this.tipo        = (pessoa instanceof Cliente) ? "CLIENTE" : "TECNICO";
        this.fotoPerfil  = pessoa.getFotoPerfil();
    }

    public Integer       getId()          { return id; }
    public String        getNome()        { return nome; }
    public String        getCpf()         { return cpf; }
    public String        getEmail()       { return email; }
    public Set<String>   getPerfis()      { return perfis; }
    public LocalDate     getDataCriacao() { return dataCriacao; }
    public String        getTipo()        { return tipo; }
    public String        getFotoPerfil()  { return fotoPerfil; }
}


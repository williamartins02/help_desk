package com.start.helpdesk.domain;


import java.util.ArrayList;
import java.util.List;

import java.util.stream.Collectors;

import javax.persistence.Entity;
import javax.persistence.OneToMany;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.start.helpdesk.domain.dtos.ClienteDTO;

import com.start.helpdesk.domain.enums.Perfil;


import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Getter @Setter
@ToString

@Entity
public class Cliente extends Pessoa {
	private static final long serialVersionUID = 1L;
	
	@JsonIgnore
	@OneToMany(mappedBy = "cliente")
	private List<Chamado> chamados = new ArrayList<>();

	public Cliente() {
		super();
		addPerfil(Perfil.CLIENTE);
	}
	
	public Cliente(ClienteDTO object) {
		super();
		this.id =     object.getId();
		this.nome =   object.getNome();
		this.cpf =    object.getCpf();
		this.email =  object.getEmail();
		this.senha =  object.getSenha();
		this.perfis = object.getPerfis().stream().map(p -> p.getCodigo()).collect(Collectors.toSet());
		this.dataCriacao = object.getDataCriacao();
	}

	public Cliente(Integer id, String nome, String cpf, String email, String senha) {
		super(id, nome, cpf, email, senha);
		addPerfil(Perfil.CLIENTE);
	}

	public List<Chamado> getChamados() {
		return chamados;
	}

	public void setChamados(List<Chamado> chamados) {
		this.chamados = chamados;
	}
	
	

}

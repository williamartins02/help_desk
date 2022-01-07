package com.start.helpdesk.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import javax.persistence.Entity;
import javax.persistence.OneToMany;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.start.helpdesk.domain.dtos.TecnicoDTO;
import com.start.helpdesk.domain.enums.Perfil;


@Entity
public class Tecnico extends Pessoa {
	private static final long serialVersionUID = 1L;
	
	@JsonIgnore // ignorando serialização no json
	@OneToMany(mappedBy = "tecnico") // um tecnico para muitos chamados
	private List<Chamado> chamados = new ArrayList<>();

	public Tecnico() {
		super();
		addPerfil(Perfil.CLIENTE);
	}

	public Tecnico(Integer id, String nome, String cpf, String email, String senha) {
		super(id, nome, cpf, email, senha);
		addPerfil(Perfil.CLIENTE);
	}
	
	public Tecnico(TecnicoDTO object) {
		super();
		this.id =     object.getId();
		this.nome =   object.getNome();
		this.cpf =    object .getCpf();
		this.email =  object.getEmail();
		this.senha =  object.getSenha();
		this.perfis = object.getPerfis().stream().map(p -> p.getCodigo()).collect(Collectors.toSet());
		this.dataCriacao = object.getDataCriacao();
	}

	public List<Chamado> getChamados() {
		return chamados;
	}

	public void setChamados(List<Chamado> chamados) {
		this.chamados = chamados;
	}

	
	
}

package com.start.helpdesk.domain;


import java.util.ArrayList;

import java.util.List;

import java.util.stream.Collectors;

import javax.persistence.Entity;
import javax.persistence.OneToMany;


import com.fasterxml.jackson.annotation.JsonIgnore;
import com.start.helpdesk.domain.dtos.TecnicoDTO;
import com.start.helpdesk.domain.enums.Perfil;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Getter @Setter
@ToString
@Entity
public class Tecnico extends Pessoa {
	private static final long serialVersionUID = 1L;
	
	@JsonIgnore // ignorando serialização no json
	@OneToMany(mappedBy = "tecnico") // um tecnico para muitos chamados
	
	//Passando uma lista de chamado para o TECNICO
	private List<Chamado> chamados = new ArrayList<>();
	
	@OneToMany(mappedBy = "tecnico")/*Um tecnico, para muitos telefones*/
	private List<Telefone> telefones = new ArrayList<>();

	public Tecnico() {
		super();
		addPerfil(Perfil.TECNICO);//add um perfil para o tecnico.
	}

	public Tecnico(Integer id, String nome, String cpf, String email, String senha) {
		super(id, nome, cpf, email, senha);
		addPerfil(Perfil.TECNICO);

	}
	
	public Tecnico(TecnicoDTO object) {
		super();
		this.id =     object.getId();
		this.nome =   object.getNome();
		this.cpf =    object .getCpf();
		this.email =  object.getEmail();
		this.senha =  object.getSenha();
		this.perfis = object.getPerfisMapped().stream().map(p -> p.getCodigo()).collect(Collectors.toSet());
		// dataCriacao e dataHoraCriacao são gerenciados pelo servidor via @CreationTimestamp
	}
	
}

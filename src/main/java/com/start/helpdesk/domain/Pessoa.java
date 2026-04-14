package com.start.helpdesk.domain;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

import javax.persistence.CollectionTable;
import javax.persistence.Column;
import javax.persistence.ElementCollection;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.validator.constraints.br.CPF;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.start.helpdesk.domain.enums.Perfil;


import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;


@Setter 
@Getter
@ToString
@EqualsAndHashCode
@Entity
public abstract class Pessoa implements Serializable {
	private static final long serialVersionUID = 1L;
	
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)//Para cada objeto banco gera um "ID" diferente.
	protected Integer id;
	
	protected String nome;
	
	@CPF
	@Column(unique = true)//Dizendo que essa coluna "CPF" sera unica no banco, p n gerar duas vezes o mesmo.
	protected String cpf;
	
	@Column(unique = true)
	protected String email;
	
	protected String senha;

	/** Foto de perfil armazenada como string Base64 (data URL) ou SVG gerado automaticamente. */
	@Column(name = "foto_perfil", columnDefinition = "LONGTEXT")
	protected String fotoPerfil;

	@ElementCollection(fetch = FetchType.EAGER)//informando q é uma coleção, element tipo Integer, q a lista tem que vir junto com usuario assim que for informado
	@CollectionTable(name = "PERFIS")//UMA TABELA NO BANCO COM APENAS OS PERFIS
	
	protected Set<Integer> perfis = new HashSet<>(); //HashSet: evita ter dois perfils repetido.
	
	
	/** Data de criação — preenchida automaticamente pelo Hibernate no INSERT */
	@CreationTimestamp
	@Column(updatable = false)
	@JsonFormat(pattern = "dd/MM/yyyy")
	protected LocalDate dataCriacao;

	/** Horário exato de criação — preenchido automaticamente pelo Hibernate no INSERT */
	@CreationTimestamp
	@Column(updatable = false)
	@JsonFormat(pattern = "dd/MM/yyyy - HH:mm")
	protected LocalDateTime dataHoraCriacao;

	public Pessoa() {
		super();
		addPerfil(Perfil.CLIENTE);//cliente precisa ter pelo menos um perfil, se caso esquecer (CLIENTE) como padrão
	}

	public Pessoa(Integer id, String nome, String cpf, String email, String senha) {
		super();
		this.id = id;
		this.nome = nome;
		this.cpf = cpf;
		this.email = email;
		this.senha = senha;
		addPerfil(Perfil.CLIENTE);
	}

	public Set<Perfil> getPerfis() {
		return perfis.stream().map(p -> Perfil.toEnum(p)).collect(Collectors.toSet());//mapeando cada perfil, retorna o cod do perfil
	}
	public void addPerfil(Perfil perfil) {
		this.perfis.add(perfil.getCodigo());
	}
	
    
}

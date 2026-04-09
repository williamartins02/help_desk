package com.start.helpdesk.domain.dtos;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

import javax.validation.constraints.NotEmpty;


import com.fasterxml.jackson.annotation.JsonFormat;
import com.start.helpdesk.domain.Cliente;
import com.start.helpdesk.domain.enums.Perfil;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;


@Getter @Setter
@ToString
@EqualsAndHashCode

/**
 * DTO é uma abreviação de Data Transfer Object, transferir dados de um sistema para outro
 * Fazer trafego em REDES.
 */
public class ClienteDTO implements Serializable {
	private static final long serialVersionUID = 1L; 
		
		protected Integer id;
		
		@NotEmpty(message = "O campo NOME é obrigatório")
		protected String nome;
		@NotEmpty(message = "O campo CPF é obrigatório")
		protected String cpf;
		@NotEmpty(message = "O campo E-MAIL é obrigatório")
		protected String email;
		@NotEmpty(message = "O campo SENHA é obrigatório")
		protected String senha;
		protected Set<Integer> perfis = new HashSet<>();
		
		@JsonFormat(pattern = "dd/MM/yyy")
		protected LocalDate dataCriacao = LocalDate.now();

		@JsonFormat(pattern = "dd/MM/yyyy - HH:mm")
		protected LocalDateTime dataHoraCriacao;

		public ClienteDTO() {
			super();
			addPerfis(Perfil.CLIENTE);
		}

		public ClienteDTO(Cliente object) {
			super();
			this.id =          object.getId();
			this.nome =        object.getNome();
			this.cpf =         object.getCpf();
			this.email =       object.getEmail();
			this.senha =       object.getSenha();
			this.perfis =      object.getPerfis().stream().map(p -> p.getCodigo()).collect(Collectors.toSet());
			this.dataCriacao =     object.getDataCriacao();
			this.dataHoraCriacao = object.getDataHoraCriacao();
			addPerfis(Perfil.CLIENTE);
		}

		/*Tranzendo um SETTERS de perfil/Ao inves de STRING o CODIGO*/
		public Set<Perfil> getPerfis() {
			return perfis.stream().map(p -> Perfil.toEnum(p)).collect(Collectors.toSet());
		}

		public void addPerfis(Perfil perfil) {
			this.perfis.add(perfil.getCodigo());
		}	
	
}

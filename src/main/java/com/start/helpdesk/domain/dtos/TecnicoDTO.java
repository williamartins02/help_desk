package com.start.helpdesk.domain.dtos;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

import javax.validation.constraints.NotNull;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.enums.Perfil;


import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Getter @Setter
@ToString
@EqualsAndHashCode

/**
 * DTO é uma abreviação de Data Transfer Object, transferir dados de um sistema para outro.
 */
public class TecnicoDTO implements Serializable {
	private static final long serialVersionUID = 1L; 
		
		protected Integer id;
		
		@NotNull(message = "O campo NOME é requerido")
		protected String nome;
		@NotNull(message = "O campo CPF é requerido")
		protected String cpf;
		@NotNull(message = "O campo E-MAIL é requerido")
		protected String email;
		@NotNull(message = "O campo SENHA é requerido")
		protected String senha;
		
		protected Set<Integer> perfis = new HashSet<>();
		
		
		@JsonFormat(pattern = "dd/MM/yyy")
		protected LocalDate dataCriacao = LocalDate.now();
		
		public TecnicoDTO() {
			super();
			addPerfis(Perfil.TECNICO);
		}

		public TecnicoDTO(Tecnico object) {
			super();
			this.id =     object.getId();
			this.nome =   object.getNome();
			this.cpf =    object .getCpf();
			this.email =  object.getEmail();
			this.senha =  object.getSenha();
			this.perfis = object.getPerfis().stream().map(p -> p.getCodigo()).collect(Collectors.toSet());
			this.dataCriacao = object.getDataCriacao();
			addPerfis(Perfil.TECNICO);
		}

		/*Tranzendo um SETTERS de perfil/Ao inves de STRING o CODIGO*/
		public Set<Perfil> getPerfis() {
			return perfis.stream().map(p -> Perfil.toEnum(p)).collect(Collectors.toSet());
		}
		public void addPerfis(Perfil perfil) {
			this.perfis.add(perfil.getCodigo());
		}	
	
}

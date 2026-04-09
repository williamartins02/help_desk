package com.start.helpdesk.domain.dtos;

import java.io.Serializable;
import java.time.LocalDateTime;

import javax.validation.constraints.NotNull;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.start.helpdesk.domain.Telefone;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Getter @Setter
@ToString
@EqualsAndHashCode
public class TelefoneDTO implements Serializable {
	private static final long serialVersionUID = 1L; 
		
		private Integer id;
		
		@NotNull(message = "Campo TELEFONE obrigatório")
		private String numero;
		@NotNull(message = "Campo TIPO obrigatório")
		private Integer tipoTelefone;
		private Integer tecnico;
		private String nomeTecnico;

		@JsonFormat(pattern = "dd/MM/yyyy - HH:mm")
		private LocalDateTime dataCriacao;

		public TelefoneDTO() {
			super();
		}

		public TelefoneDTO(Telefone object) {
			super();
			this.id           = object.getId();
			this.numero       = object.getNumero();
			this.tipoTelefone = object.getTipoTelefone().getCodigo();
			this.tecnico      = object.getTecnico().getId();
			this.nomeTecnico  = object.getTecnico().getNome();
			this.dataCriacao  = object.getDataCriacao();
		}

}

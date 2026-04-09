package com.start.helpdesk.domain;

import java.io.Serializable;
import java.time.LocalDateTime;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.start.helpdesk.domain.enums.TipoTelefone;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;

@Getter @Setter
@ToString
@EqualsAndHashCode

@Entity
@Builder
public class Telefone implements Serializable {
	private static final long serialVersionUID = 1L;
	    
		@Id
		@GeneratedValue(strategy = GenerationType.IDENTITY)
		private Integer id;
		
		private String numero;
		
		private TipoTelefone tipoTelefone;

		/** Preenchida automaticamente pelo Hibernate no momento da inserção */
		@CreationTimestamp
		@JsonFormat(pattern = "dd/MM/yyyy - HH:mm")
		private LocalDateTime dataCriacao;

		@JsonIgnore
		@ManyToOne /*Muitos telefones para muitos tecnico */
		@JoinColumn(name = "tecnico_id")
		private Tecnico tecnico;
		
		
		public Telefone() {
			super();
		}
		
		public Telefone(Integer id, String numero, TipoTelefone tipoTelefone, Tecnico tecnico) {
			super();
			this.id = id;
			this.numero = numero;
			this.tecnico = tecnico;
			this.tipoTelefone = tipoTelefone;
		}

		/* Construtor completo exigido pelo @Builder quando há campos extras */
		public Telefone(Integer id, String numero, TipoTelefone tipoTelefone,
				        LocalDateTime dataCriacao, Tecnico tecnico) {
			super();
			this.id          = id;
			this.numero      = numero;
			this.tipoTelefone = tipoTelefone;
			this.dataCriacao  = dataCriacao;
			this.tecnico      = tecnico;
		}
		
	}
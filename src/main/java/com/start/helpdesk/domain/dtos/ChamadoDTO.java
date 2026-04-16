package com.start.helpdesk.domain.dtos;

import java.io.Serializable;
import java.time.Duration;
import java.time.LocalDateTime;

import javax.validation.constraints.NotNull;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.enums.Status;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;
import lombok.ToString;

@Getter @Setter
@ToString
@EqualsAndHashCode
public class ChamadoDTO implements Serializable {
	private static final long serialVersionUID = 1L;

	private Integer id;
	@JsonFormat(pattern = "dd/MM/yyyy - HH:mm")
	private LocalDateTime dataAbertura = LocalDateTime.now();
	@JsonFormat(pattern = "dd/MM/yyyy - HH:mm")
	private LocalDateTime dataFechamento;

	@JsonFormat(pattern = "dd/MM/yyyy - HH:mm")
	private LocalDateTime prazoSla;
	private String statusSla;

	@NotNull(message = "Campo PRIORIDADE obrigatório")
	private Integer prioridade;
	
	@NotNull(message = "Campo STATUS obrigatório")
	private Integer status;
	
	@NotNull(message = "Campo Classifcação obrigatório")
	private Integer classificacao;
	
	@NotNull(message = "Campo TITULO obrigatório")
	private String titulo;
	
	@NotNull(message = "Campo OBSERVAÇÕES obrigatório")
	private String observacoes;
	
	@NotNull(message = "Campo TÉCNICO obrigatório")
	private Integer tecnico;
	
	@NotNull(message = "Campo CLIENTE obrigatório")
	private Integer cliente;
	private String nomeTecnico;
	private String nomeCliente;

	public ChamadoDTO() {
		super();
	}

	public ChamadoDTO(Chamado object) {
		super();
		this.id = object.getId();
		this.dataAbertura = object.getDataAbertura();
		this.dataFechamento = object.getDataFechamento();
		this.prazoSla = object.getPrazoSla();
		this.statusSla = computeStatusSla(object);
		this.prioridade = object.getPrioridade().getCodigo();
		this.status = object.getStatus().getCodigo();
		this.classificacao = object.getClassificacao().getCodigo();
		this.titulo = object.getTitulo();
		this.observacoes = object.getObservacoes();
		this.tecnico = object.getTecnico().getId();
		this.cliente = object.getCliente().getId();
		this.nomeTecnico = object.getTecnico().getNome();
		this.nomeCliente = object.getCliente().getNome();
	}

	private String computeStatusSla(Chamado chamado) {
		if (chamado.getStatus() == Status.ENCERRADO) return "ENCERRADO";
		if (chamado.getPrazoSla() == null) return "N/A";
		LocalDateTime now = LocalDateTime.now();
		if (now.isAfter(chamado.getPrazoSla())) return "ATRASADO";
		long totalSeconds = Duration.between(chamado.getDataAbertura(), chamado.getPrazoSla()).getSeconds();
		long remainingSeconds = Duration.between(now, chamado.getPrazoSla()).getSeconds();
		if (totalSeconds > 0 && remainingSeconds < totalSeconds / 2) return "ALERTA";
		return "DENTRO_PRAZO";
	}

}

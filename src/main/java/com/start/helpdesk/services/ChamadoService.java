package com.start.helpdesk.services;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import javax.validation.Valid;
import com.start.helpdesk.services.exception.DataIntegrityViolationException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.start.helpdesk.services.EncerrarChamadoEmail.ChamadoEmailService;
import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.Cliente;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.dtos.ChamadoDTO;
import com.start.helpdesk.domain.enums.Classificacao;
import com.start.helpdesk.domain.enums.Prioridade;
import com.start.helpdesk.domain.enums.Status;
import com.start.helpdesk.repositories.ChamadoRepository;
import com.start.helpdesk.services.exception.ObjectnotFoundException;

@Service
public class ChamadoService {

	@Autowired
	private ChamadoRepository chamadoRepository;
	@Autowired
	private TecnicoService tecnicoService;
	@Autowired
	private ClienteService clienteService;
	@Autowired
	private ChamadoEmailService chamadoEmailService;

	public Chamado findById(Integer id) {
		Optional<Chamado> object = chamadoRepository.findById(id);
		return object.orElseThrow(() -> new ObjectnotFoundException("Objeto não econtrado! ID:" + id));
	}

	public List<Chamado> findAll() {
		return chamadoRepository.findAll();
	}

	public List<Chamado> findByClienteId(Integer clienteId) {
		return chamadoRepository.findByClienteId(clienteId);
	}

	public List<Chamado> findByTecnicoId(Integer tecnicoId) {
		return chamadoRepository.findByTecnicoId(tecnicoId);
	}

	public Chamado create(@Valid ChamadoDTO objectDTO) {
		return chamadoRepository.save(newChamado(objectDTO));
	}

	public Chamado update(Integer id, @Valid ChamadoDTO objectDTO) {
		objectDTO.setId(id);
		Chamado oldObject = findById(id);
		/* Chamado ENCERRADO não pode ser reaberto; um novo chamado deve ser criado */
		if (oldObject.getStatus() == Status.ENCERRADO) {
			throw new DataIntegrityViolationException(
				"Chamado encerrado não pode ser reaberto. Crie um novo chamado se necessário.");
		}
		boolean vaiEncerrar = objectDTO.getStatus().equals(Status.ENCERRADO.getCodigo());
		Chamado updated = newChamado(objectDTO);
		// Preserve original opening date and SLA deadline on updates
		updated.setDataAbertura(oldObject.getDataAbertura());
		updated.setPrazoSla(oldObject.getPrazoSla());
		Chamado salvo = chamadoRepository.save(updated);
		if (vaiEncerrar) {
			chamadoEmailService.sendChamadoEncerradoEmail(salvo);
		}
		return salvo;
	}

	/* metodo privado para ATUALIZAR ou CRIAR um novo chamado. */
	private Chamado newChamado(ChamadoDTO object) {
		Tecnico tecnico = tecnicoService.findById(object.getTecnico());
		Cliente cliente = clienteService.findById(object.getCliente());

		Chamado chamado = new Chamado();
		if (object.getId() != null) {
			chamado.setId((object.getId()));
		}
		/* Se o chamado for "ENCERRADO(2)" retorna dia do fechamento */
		if (object.getStatus().equals(2)) {
			chamado.setDataFechamento(LocalDateTime.now());
		}
		/* Calcula prazoSla apenas em novos chamados (sem ID) */
		if (object.getId() == null) {
			chamado.setPrazoSla(calcularPrazoSla(Prioridade.toEnum(object.getPrioridade()), chamado.getDataAbertura()));
		}
		chamado.setTecnico(tecnico);
		chamado.setCliente(cliente);
		chamado.setPrioridade(Prioridade.toEnum(object.getPrioridade()));
		chamado.setStatus(Status.toEnum(object.getStatus()));
		chamado.setClassificacao(Classificacao.toEnum(object.getClassificacao()));
		chamado.setTitulo(object.getTitulo());
		chamado.setObservacoes(object.getObservacoes());
		return chamado;
	}

	/**
	 * Calcula o prazo de SLA com base na prioridade do chamado:
	 * BAIXA → 24h | MEDIA → 8h | ALTA → 4h | CRITICA → 2h
	 */
	public static LocalDateTime calcularPrazoSla(Prioridade prioridade, LocalDateTime dataAbertura) {
		switch (prioridade) {
			case BAIXA:   return dataAbertura.plusHours(24);
			case MEDIA:   return dataAbertura.plusHours(8);
			case ALTA:    return dataAbertura.plusHours(4);
			case CRITICA: return dataAbertura.plusHours(2);
			default:      return dataAbertura.plusHours(8);
		}
	}

}

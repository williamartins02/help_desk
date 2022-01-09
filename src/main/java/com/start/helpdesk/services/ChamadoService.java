package com.start.helpdesk.services;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import javax.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.Cliente;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.dtos.ChamadoDTO;
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
	
	public Chamado findById(Integer id) {
		Optional<Chamado> object = chamadoRepository.findById(id);
		return object.orElseThrow(() ->  new ObjectnotFoundException("Objeto não econtrado! ID:" + id));
	}
	
	public List<Chamado> findAll(){
		return chamadoRepository.findAll();
	}
	
	public Chamado create(@Valid ChamadoDTO objectDTO) {
		return chamadoRepository.save(newChamado(objectDTO));
	}
	
	public Chamado update(Integer id, @Valid ChamadoDTO objectDTO) {
		objectDTO.setId(id);
		Chamado oldObject = findById(id);
		oldObject = newChamado(objectDTO);
		return chamadoRepository.save(oldObject);
	}	
	private Chamado newChamado(ChamadoDTO object) {
		Tecnico tecnico = tecnicoService.findById(object.getTecnico());
		Cliente cliente = clienteService.findById(object.getCliente());
		
		Chamado chamado = new Chamado();
		if(object.getId() != null) {
			chamado.setId((object.getId()));
		}
		/*Se o chamado for "Encerrado" retorna dia do fechamento*/
		 if(object.getStatus().equals(2)){
			 chamado.setDataFechamento(LocalDate.now());
		 }
		
		chamado.setTecnico(tecnico);
		chamado.setCliente(cliente);
		chamado.setPrioridade(Prioridade.toEnum(object.getPrioridade()));
		chamado.setStatus(Status.toEnum(object.getStatus()));
		chamado.setTitulo(object.getTitulo());
		chamado.setObservacoes(object.getObservacoes());
		return chamado;
	}


	
	
	
	
	
	
}

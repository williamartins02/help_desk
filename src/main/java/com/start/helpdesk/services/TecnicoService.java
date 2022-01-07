package com.start.helpdesk.services;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.start.helpdesk.domain.Pessoa;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.dtos.TecnicoDTO;
import com.start.helpdesk.repositories.PessoaRepository;
import com.start.helpdesk.repositories.TecnicoRepository;
import com.start.helpdesk.services.exception.DataIntegrityViolationException;
import com.start.helpdesk.services.exception.ObjectnotFoundException;


@Service
public class TecnicoService {

	@Autowired
	private TecnicoRepository repository;
	@Autowired
	private PessoaRepository pessoaRepository;
	
	//Buscando ID do tecnico no banco
	public Tecnico findById(Integer id) {
		Optional<Tecnico> tecnicoObj = repository.findById(id);
		return tecnicoObj.orElseThrow(() -> new ObjectnotFoundException("Objeto não econtrado! Id: " + id));
	}
	
	/*Listando uma lista de tecnico findAll*/
	public List<Tecnico> findAll() {
		return repository.findAll();
	}

	/*Criando um tecnico novo*/
	public Tecnico create(TecnicoDTO objectDTO) {
		objectDTO.setId(null);/*Assegurando que o ID vai vir nulo,*/
		validationCpfEmail(objectDTO);
	    Tecnico newObject = new Tecnico(objectDTO);
		return repository.save(newObject);
	}
	
	/*Fazendo comparação atraves do ID, se já existe CPF/E-mal já cadastrado*/
	private void validationCpfEmail(TecnicoDTO objectDTO) {
		
		Optional<Pessoa> object = pessoaRepository.findByCpf(objectDTO.getCpf());
			if(object.isPresent() && object.get().getId() != objectDTO.getId()) {
				throw new DataIntegrityViolationException("CPF já cadastrado no sistema!");
			}
			
		object = pessoaRepository.findByEmail(objectDTO.getEmail());
			if(object.isPresent() && object.get().getId() != objectDTO.getId()) {
			    throw new DataIntegrityViolationException("E-mail já cadatrado no sistema!");
		    }
    }
}
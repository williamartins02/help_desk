package com.start.helpdesk.services;

import java.util.List;
import java.util.Optional;
import javax.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.Telefone;
import com.start.helpdesk.domain.dtos.TelefoneDTO;
import com.start.helpdesk.domain.enums.TipoTelefone;
import com.start.helpdesk.repositories.TecnicoRepository;
import com.start.helpdesk.repositories.TelefoneRepository;

import com.start.helpdesk.services.exception.ObjectnotFoundException;

@Service
public class TelefoneService {

	@Autowired
	private TelefoneRepository telefoneRepository;

	@Autowired
	private TecnicoRepository tecnicoRepository;

	@Autowired
	private TecnicoService tecnicoService;

	public List<Telefone> findByTecnicoId(Integer id) {
		Optional<Tecnico> tecnico = tecnicoRepository.findById(id);
		tecnico.orElseThrow(() -> new ObjectnotFoundException("Tecnico não encontrado! ID:" + id));
		List<Telefone> object = telefoneRepository.findByTecnico(tecnico.get());
		return object;
	}

	public Telefone findById(Integer id) {
		Optional<Telefone> telObj = telefoneRepository.findById(id);
		return telObj.orElseThrow(() -> new ObjectnotFoundException("Telefone não econtrado! id: " + id));
	}

	public List<Telefone> findAll() {
		return telefoneRepository.findAll();
	}

	public void delete(Integer id) {
		telefoneRepository.deleteById(id);
	}

	public Telefone create(@Valid TelefoneDTO objectDTO) {
		return telefoneRepository.save(newTelefone(objectDTO));
	}

	public Telefone update(Integer id, @Valid TelefoneDTO objectDTO) {
		objectDTO.setId(id);
		Telefone oldObject = findById(id);
		oldObject = newTelefone(objectDTO);
		return telefoneRepository.save(oldObject);
	}

	private Telefone newTelefone(TelefoneDTO object) {
		Tecnico tecnico = tecnicoService.findById(object.getTecnico());

		Telefone telefone = new Telefone();
		if (object.getId() != null) {
			telefone.setId((object.getId()));
		}

		telefone.setTecnico(tecnico);
		telefone.setTipoTelefone(TipoTelefone.toEnum(object.getTipoTelefone()));
		telefone.setNumero(object.getNumero());
		return telefone;
	}

}
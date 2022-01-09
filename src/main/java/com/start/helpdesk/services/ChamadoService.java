package com.start.helpdesk.services;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.repositories.ChamadoRepository;
import com.start.helpdesk.services.exception.ObjectnotFoundException;

@Service
public class ChamadoService {
	
	@Autowired
	private ChamadoRepository chamadoRepository;
	
	public Chamado findById(Integer id) {
		Optional<Chamado> object = chamadoRepository.findById(id);
		return object.orElseThrow(() ->  new ObjectnotFoundException("Objeto não econtrado! ID:" + id));
	}
	
	public List<Chamado> findAll(){
		return chamadoRepository.findAll();
	}

}

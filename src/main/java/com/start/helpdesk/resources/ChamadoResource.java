package com.start.helpdesk.resources;

import java.net.URI;
import java.util.List;
import java.util.stream.Collectors;


import javax.validation.Valid;


import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.dtos.ChamadoDTO;
import com.start.helpdesk.services.ChamadoService;
import com.start.helpdesk.services.TecnicoService;


@RestController
@RequestMapping(value = "/chamados")
public class ChamadoResource {

	@Autowired
	private ChamadoService service;
	
	@Autowired
	private TecnicoService tecnicoService;


	/*Buscando chamado por ID findById*/
	@GetMapping(value = "/{id}")
	public ResponseEntity<ChamadoDTO> findById(@PathVariable Integer id) {
		Chamado object = service.findById(id);
		return ResponseEntity.ok().body(new ChamadoDTO(object));
	}

	/*BUSCANDO uma lista de chamado findAll*/
	@GetMapping
	public ResponseEntity<List<ChamadoDTO>> findAll() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		String email;
		if (authentication.getPrincipal() instanceof UserDetails) {
			email = ((UserDetails) authentication.getPrincipal()).getUsername();
		} else {
			email = authentication.getPrincipal().toString();
		}

		// Check if user is Técnico
		Tecnico tecnico = null;
		try {
			tecnico = tecnicoService.findByEmail(email);
		} catch (Exception e) {
			// Not a técnico, ignore
		}

		List<ChamadoDTO> listDTO;
		if (tecnico != null) {
			// If técnico, return only their chamados
			listDTO = service.findByTecnicoId(tecnico.getId()).stream()
					.map(ChamadoDTO::new).collect(Collectors.toList());
		} else {
			// Otherwise, return all chamados
			List<Chamado> listChamado = service.findAll();
			listDTO = listChamado.stream().map(object -> new ChamadoDTO(object)).collect(Collectors.toList());
		}
		return ResponseEntity.ok().body(listDTO);
	}

	/* BUSCANDO chamados por cliente */
	@GetMapping("/cliente/{id}")
	public ResponseEntity<List<ChamadoDTO>> findByCliente(@PathVariable Integer id) {
		List<ChamadoDTO> listDTO = service.findByClienteId(id).stream()
				.map(ChamadoDTO::new).collect(Collectors.toList());
		return ResponseEntity.ok().body(listDTO);
	}

	/* BUSCANDO chamados por técnico */
	@GetMapping("/tecnico/{id}")
	public ResponseEntity<List<ChamadoDTO>> findByTecnico(@PathVariable Integer id) {
		List<ChamadoDTO> listDTO = service.findByTecnicoId(id).stream()
				.map(ChamadoDTO::new).collect(Collectors.toList());
		return ResponseEntity.ok().body(listDTO);
	}

	/**
	 * Endpoint seguro: retorna apenas chamados do técnico autenticado
	 */
	@GetMapping("/tecnico/me")
	public ResponseEntity<List<ChamadoDTO>> findMyChamados() {
	    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
	    String email;
	    if (authentication.getPrincipal() instanceof UserDetails) {
	        email = ((UserDetails) authentication.getPrincipal()).getUsername();
	    } else {
	        email = authentication.getPrincipal().toString();
	    }
	    Tecnico tecnico = tecnicoService.findByEmail(email);
	    List<ChamadoDTO> listDTO = service.findByTecnicoId(tecnico.getId()).stream()
	            .map(ChamadoDTO::new).collect(Collectors.toList());
	    return ResponseEntity.ok().body(listDTO);
	}

	/*CRIANDO um chamado novo*/
	@PostMapping
	public ResponseEntity<ChamadoDTO> create(@Valid @RequestBody ChamadoDTO objectDTO) {
		Chamado object = service.create(objectDTO);
		URI uri = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(object.getId()).toUri();
		return ResponseEntity.created(uri).build();
	}

	/*ATUALIZANDO um chamado*/
	@PutMapping(value = "/{id}")
	public ResponseEntity<ChamadoDTO> update(@PathVariable Integer id, @Valid @RequestBody ChamadoDTO objectDTO) {
		Chamado newObject = service.update(id, objectDTO);
		return ResponseEntity.ok().body(new ChamadoDTO(newObject));
	}
	
}

package com.start.helpdesk.resources;

import java.net.URI;
import java.util.List;
import java.util.stream.Collectors;

import javax.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.dtos.TecnicoDTO;
import com.start.helpdesk.services.TecnicoService;

@RestController
@RequestMapping(value = "/tecnicos")
public class TecnicoResource {

	/* representa td resposta HTTP, localhost:8080/tecnicos */

	@Autowired
	private TecnicoService service;

	/* EndPoint para (BUSCAR) tecnicos por ID */
	@GetMapping(value = "/{id}")
	public ResponseEntity<TecnicoDTO> findById(@PathVariable Integer id) {
		Tecnico object = service.findById(id);
		return ResponseEntity.ok().body(new TecnicoDTO(object));
	}

	/* EndPont litar uma (LIST) de tecnico findAll */
	@GetMapping
	public ResponseEntity<List<TecnicoDTO>> findAll() {
		List<Tecnico> list = service.findAll();
		List<TecnicoDTO> listDTO = list.stream().map(object -> new TecnicoDTO(object)).collect(Collectors.toList());
		return ResponseEntity.ok().body(listDTO);
	}

	/*
	 * EndPoint para (CREATE) criar tecnico, criando URI de acesso ao ID.
	 */
	@PostMapping
	public ResponseEntity<TecnicoDTO> create(@Valid @RequestBody TecnicoDTO objectDTO) {
		Tecnico newObject = service.create(objectDTO);
		URI uri = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(newObject.getId()).toUri();
		return ResponseEntity.created(uri).build();
	}

	/* EndPoint (ATUALIZAR) criando um tecnico novo. */
	@PutMapping(value = "/{id}")
	public ResponseEntity<TecnicoDTO> update(@PathVariable Integer id, @Valid @RequestBody TecnicoDTO objectDTO) {
		Tecnico object = service.update(id, objectDTO);
		return ResponseEntity.ok().body(new TecnicoDTO(object));
	}

	/* EndPoint (DELETAR) por ID */
	@DeleteMapping(value = "/{id}")
	public ResponseEntity<TecnicoDTO> delete(@PathVariable Integer id) {
		service.delete(id);
		return ResponseEntity.noContent().build();
	}
}

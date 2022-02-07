package com.start.helpdesk.resources;

import java.net.URI;
import java.util.List;
import java.util.stream.Collectors;

import javax.validation.Valid;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.start.helpdesk.domain.Telefone;
import com.start.helpdesk.domain.dtos.TelefoneDTO;
import com.start.helpdesk.services.TelefoneService;

@RestController
@RequestMapping(value = "/telefones")
public class TelefoneResource {

	/* representa td resposta HTTP, localhost:8080/telefones */

	@Autowired
	private TelefoneService service;

	/* EndPoint para (BUSCAR) telefones por ID */
	@GetMapping(value = "/{id}")
	public ResponseEntity<List<TelefoneDTO>> findById(@PathVariable Integer id) {
		List<Telefone> list = service.findByTecnicoId(id);
		List<TelefoneDTO> listDTO = list.stream().map(object -> new TelefoneDTO(object)).collect(Collectors.toList());
		return ResponseEntity.ok().body(listDTO);
	}
	
	/*EdnPOint para pegar id do tecnico e o ID telefone do tecnico.*/
	@GetMapping(value = "/id/{id}")
	public ResponseEntity<TelefoneDTO> findByTelefoneId(@PathVariable Integer id) {
		Telefone telefone = service.findById(id);
		TelefoneDTO telefoneDTO = new TelefoneDTO(telefone);
		return ResponseEntity.ok().body(telefoneDTO);
	}
	

	/* EndPont litar uma (LIST) de telefone findAll */
	@GetMapping
	public ResponseEntity<List<TelefoneDTO>> findAll() {
		List<Telefone> list = service.findAll();
		List<TelefoneDTO> listDTO = list.stream().map(object -> new TelefoneDTO(object)).collect(Collectors.toList());
		return ResponseEntity.ok().body(listDTO);
	}

	@PreAuthorize("hasAnyRole('ADMIN')")
	@PutMapping(value = "/{id}")
	public ResponseEntity<TelefoneDTO> update(@PathVariable Integer id, @Valid @RequestBody TelefoneDTO objectDTO) {
		Telefone object = service.update(id, objectDTO);
		return ResponseEntity.ok().body(new TelefoneDTO(object));
	}

	@PreAuthorize("hasAnyRole('ADMIN')")
	@DeleteMapping(value = "/{id}")
	public ResponseEntity<TelefoneDTO> delete(@PathVariable("id") Integer id){
		service.delete(id);
		return ResponseEntity.noContent().build();
	}
	
	@PostMapping
	public ResponseEntity<TelefoneDTO> create(@Valid @RequestBody TelefoneDTO objectDTO){
		Telefone newObjCliente = service.create(objectDTO);
		URI uri = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(newObjCliente.getId()).toUri();
		return ResponseEntity.created(uri).build();
	}

}

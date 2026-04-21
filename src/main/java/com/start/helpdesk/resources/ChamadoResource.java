package com.start.helpdesk.resources;

import java.net.URI;
import java.util.List;
import java.util.stream.Collectors;


import javax.validation.Valid;


import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
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
import com.start.helpdesk.services.PessoaService;
import com.start.helpdesk.domain.Pessoa;
import com.start.helpdesk.domain.enums.Perfil;
import com.start.helpdesk.security.SecurityUtils;
import com.start.helpdesk.services.exception.UnauthorizedException;


@RestController
@RequestMapping(value = "/chamados")
public class ChamadoResource {

	@Autowired
	private ChamadoService service;
	
	@Autowired
	private TecnicoService tecnicoService;

    @Autowired
    private PessoaService pessoaService;


	/*Buscando chamado por ID findById*/
	@GetMapping(value = "/{id}")
	public ResponseEntity<ChamadoDTO> findById(@PathVariable Integer id) {
		Chamado object = service.findById(id);
		return ResponseEntity.ok().body(new ChamadoDTO(object));
	}

	/*BUSCANDO uma lista de chamado findAll*/
	@GetMapping
	public ResponseEntity<List<ChamadoDTO>> findAll() {
		String email = SecurityUtils.getAuthenticatedEmail();
		Pessoa pessoa = pessoaService.findByEmail(email);
		if (pessoa == null) {
			throw new UnauthorizedException("Usuário não autenticado");
		}

			List<ChamadoDTO> listDTO;
			if (pessoa.getPerfis().contains(Perfil.ADMIN)) {
				// ADMIN: retorna todos os chamados, prioridade máxima
				List<Chamado> listChamado = service.findAll();
				listDTO = listChamado.stream().map(ChamadoDTO::new).collect(Collectors.toList());
			} else if (pessoa.getPerfis().contains(Perfil.TECNICO)) {
				// Somente técnico (sem ADMIN): retorna apenas seus chamados
				Tecnico tecnico = tecnicoService.findByEmail(email);
				listDTO = service.findByTecnicoId(tecnico.getId()).stream()
						.map(ChamadoDTO::new).collect(Collectors.toList());
			} else {
				// CLIENTE ou outro perfil: não autorizado
				throw new UnauthorizedException("Acesso não permitido para este perfil");
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
	    String email = SecurityUtils.getAuthenticatedEmail();
	    Tecnico tecnico = tecnicoService.findByEmail(email);
	    List<ChamadoDTO> listDTO = service.findByTecnicoId(tecnico.getId()).stream()
	            .map(ChamadoDTO::new).collect(Collectors.toList());
	    return ResponseEntity.ok().body(listDTO);
	}

	/*CRIANDO um chamado novo*/
	@PostMapping
	public ResponseEntity<ChamadoDTO> create(@Valid @RequestBody ChamadoDTO objectDTO) {
		String email = SecurityUtils.getAuthenticatedEmail();
		Pessoa pessoa = pessoaService.findByEmail(email);
		if (pessoa == null) {
			throw new UnauthorizedException("Usuário não autenticado");
		}
			// ADMIN pode criar para qualquer técnico
			if (!pessoa.getPerfis().contains(Perfil.ADMIN)) {
				// Se não for ADMIN, mas for TECNICO, só pode criar para si mesmo
				if (pessoa.getPerfis().contains(Perfil.TECNICO) && !objectDTO.getTecnico().equals(pessoa.getId())) {
					throw new UnauthorizedException("Técnico só pode criar chamados para si mesmo");
				}
			}
		Chamado object = service.create(objectDTO);
		URI uri = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(object.getId()).toUri();
		return ResponseEntity.created(uri).build();
	}

	/*ATUALIZANDO um chamado*/
	@PutMapping(value = "/{id}")
	public ResponseEntity<ChamadoDTO> update(@PathVariable Integer id, @Valid @RequestBody ChamadoDTO objectDTO) {
		String email = SecurityUtils.getAuthenticatedEmail();
		Pessoa pessoa = pessoaService.findByEmail(email);
		if (pessoa == null) {
			throw new UnauthorizedException("Usuário não autenticado");
		}
			// ADMIN pode editar qualquer chamado
			if (!pessoa.getPerfis().contains(Perfil.ADMIN)) {
				// Se não for ADMIN, mas for TECNICO, só pode editar os próprios
				if (pessoa.getPerfis().contains(Perfil.TECNICO)) {
					Chamado chamado = service.findById(id);
					if (!chamado.getTecnico().getId().equals(pessoa.getId())) {
						throw new UnauthorizedException("Técnico só pode editar chamados atribuídos a si mesmo");
					}
				}
			}
		Chamado newObject = service.update(id, objectDTO);
		return ResponseEntity.ok().body(new ChamadoDTO(newObject));
	}

	/**
	 * Endpoint paginado — recomendado para produção com grande volume de dados.
	 * Suporta parâmetros: page, size, sort (ex: /chamados/page?page=0&size=20&sort=dataAbertura,desc)
	 * Retorna Page<ChamadoDTO> com metadados (totalElements, totalPages, etc.).
	 */
	@GetMapping("/page")
	public ResponseEntity<Page<ChamadoDTO>> findAllPaginado(
			@PageableDefault(size = 20, sort = "dataAbertura", direction = Sort.Direction.DESC) Pageable pageable) {

		String email = SecurityUtils.getAuthenticatedEmail();
		Pessoa pessoa = pessoaService.findByEmail(email);
		if (pessoa == null) {
			throw new UnauthorizedException("Usuário não autenticado");
		}

		if (pessoa.getPerfis().contains(Perfil.ADMIN)) {
			return ResponseEntity.ok(service.findAllPaginado(pageable));
		} else if (pessoa.getPerfis().contains(Perfil.TECNICO)) {
			Tecnico tecnico = tecnicoService.findByEmail(email);
			return ResponseEntity.ok(service.findByTecnicoIdPaginado(tecnico.getId(), pageable));
		} else {
			throw new UnauthorizedException("Acesso não permitido para este perfil");
		}
	}

}

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
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.start.helpdesk.domain.Tecnico;
import com.start.helpdesk.domain.dtos.ChamadoPendenteInfoDTO;
import com.start.helpdesk.domain.dtos.ReatribuicaoRequestDTO;
import com.start.helpdesk.domain.dtos.TecnicoDTO;
import com.start.helpdesk.domain.dtos.TecnicoRankingDTO;
import com.start.helpdesk.services.TecnicoService;

@RestController
@RequestMapping(value = "/tecnicos")
public class TecnicoResource {

    @Autowired
    private TecnicoService service;

    @RequestMapping(value = "/{id}", method = RequestMethod.GET)
    public ResponseEntity<TecnicoDTO> findById(@PathVariable Integer id) {
        Tecnico object = service.findById(id);
        return ResponseEntity.ok().body(new TecnicoDTO(object));
    }

    @GetMapping
    public ResponseEntity<List<TecnicoDTO>> findAll() {
        List<Tecnico> list = service.findAll();
        List<TecnicoDTO> listDTO = list.stream().map(TecnicoDTO::new).collect(Collectors.toList());
        return ResponseEntity.ok().body(listDTO);
    }

    @GetMapping("/ativos")
    public ResponseEntity<List<TecnicoDTO>> findAllAtivos() {
        List<Tecnico> list = service.findAllAtivos();
        List<TecnicoDTO> listDTO = list.stream().map(TecnicoDTO::new).collect(Collectors.toList());
        return ResponseEntity.ok().body(listDTO);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'TECNICO')")
    @PostMapping
    public ResponseEntity<TecnicoDTO> create(@Valid @RequestBody TecnicoDTO objectDTO) {
        Tecnico newObject = service.create(objectDTO);
        TecnicoDTO dto = new TecnicoDTO(newObject);
        URI uri = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(newObject.getId()).toUri();
        return ResponseEntity.created(uri).body(dto);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'TECNICO')")
    @PutMapping(value = "/{id}")
    public ResponseEntity<TecnicoDTO> update(@PathVariable Integer id, @Valid @RequestBody TecnicoDTO objectDTO) {
        Tecnico object = service.update(id, objectDTO);
        return ResponseEntity.ok().body(new TecnicoDTO(object));
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'TECNICO')")
    @DeleteMapping(value = "/{id}")
    public ResponseEntity<TecnicoDTO> delete(@PathVariable Integer id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'TECNICO')")
    @GetMapping(value = "/{id}/chamados-pendentes")
    public ResponseEntity<List<ChamadoPendenteInfoDTO>> getChamadosPendentes(@PathVariable Integer id) {
        List<ChamadoPendenteInfoDTO> pendentes = service.getChamadosPendentes(id);
        return ResponseEntity.ok().body(pendentes);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'TECNICO')")
    @PostMapping(value = "/{id}/reatribuir-chamados")
    public ResponseEntity<Void> reatribuirChamados(@PathVariable Integer id,
            @Valid @RequestBody ReatribuicaoRequestDTO request) {
        service.reatribuirChamados(id, request);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'TECNICO')")
    @PostMapping(value = "/{id}/reatribuir-e-inativar")
    public ResponseEntity<Void> reatribuirEInativar(@PathVariable Integer id,
            @Valid @RequestBody ReatribuicaoRequestDTO request) {
        service.reatribuirEInativar(id, request);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'TECNICO')")
    @PostMapping(value = "/{id}/inativar")
    public ResponseEntity<Void> inativarTecnico(@PathVariable Integer id) {
        service.inativarTecnico(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'TECNICO')")
    @PostMapping(value = "/{id}/reativar")
    public ResponseEntity<Void> reativarTecnico(@PathVariable Integer id) {
        service.reativarTecnico(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/ranking")
    public ResponseEntity<List<TecnicoRankingDTO>> getRankingTecnicosMes() {
        List<TecnicoRankingDTO> ranking = service.getRankingTecnicosMes();
        return ResponseEntity.ok().body(ranking);
    }
}

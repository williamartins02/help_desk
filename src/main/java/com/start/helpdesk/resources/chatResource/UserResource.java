package com.start.helpdesk.resources;

import com.start.helpdesk.domain.Pessoa;
import com.start.helpdesk.domain.dtos.PessoaDTO;
import com.start.helpdesk.repositories.PessoaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping(value = "/user")
public class UserResource {

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private PessoaRepository pessoaRepository;

    /**
     * Retorna as authorities (permissões) do usuário pelo e-mail.
     * Chamado pelo frontend após login para carregar as permissões no localStorage.
     */
    @GetMapping("/{email}")
    public ResponseEntity<Map<String, Object>> getPermissions(@PathVariable String email) {
        UserDetails userDetails = userDetailsService.loadUserByUsername(email);

        var authorities = userDetails.getAuthorities().stream()
                .map(authority -> Map.of("authority", authority.getAuthority()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("authorities", authorities));
    }

    /**
     * Lista todos os usuários cadastrados (Técnicos + Clientes).
     * Acessível por qualquer usuário autenticado.
     */
    @GetMapping("/all")
    public ResponseEntity<List<PessoaDTO>> findAll() {
        List<Pessoa> pessoas = pessoaRepository.findAll();
        List<PessoaDTO> dto = pessoas.stream()
                .map(PessoaDTO::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dto);
    }
}

package com.start.helpdesk.resources;

import com.start.helpdesk.domain.Mensagem;
import com.start.helpdesk.services.MensagemPendenteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

/**
 * Endpoints REST para o sistema de mensagens pendentes do chat.
 *
 * GET /api/chat/pendentes
 *   Retorna todas as mensagens enviadas ao usuário autenticado enquanto ele
 *   estava offline e as marca como entregues no banco de dados.
 */
@RestController
@RequestMapping("/api/chat")
public class ChatMensagemResource {

    @Autowired
    private MensagemPendenteService mensagemPendenteService;

    /**
     * Busca e entrega as mensagens pendentes do usuário autenticado.
     * O e-mail é extraído do JWT via {@link Principal}.
     */
    @GetMapping("/pendentes")
    public ResponseEntity<List<Mensagem>> getPendentes(Principal principal) {
        String email = principal.getName();
        List<Mensagem> pendentes = mensagemPendenteService.buscarEMarcarComoEntregues(email);
        return ResponseEntity.ok(pendentes);
    }
}


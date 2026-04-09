package com.start.helpdesk.resources;

import com.start.helpdesk.domain.Mensagem;
import com.start.helpdesk.services.MensagemPendenteService;
import com.start.helpdesk.services.PresenceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

/**
 * Controlador WebSocket/STOMP para o chat em tempo real.
 *
 * Fluxo de mensagens:
 *   Cliente  →  /app/message      →  ChatController#receberMensagem
 *   Broker   →  /chat/message     →  Todos os subscribers
 *
 *   Cliente  →  /app/escrevendo   →  ChatController#escrevendo
 *   Broker   →  /chat/escrevendo  →  Todos os subscribers
 */
@Controller
public class ChatController {

    /** Paleta de cores para distinguir os usuários no chat */
    private static final List<String> CORES = Arrays.asList(
            "#1565c0", "#00838f", "#2e7d32", "#6a1b9a",
            "#c62828", "#f57f17", "#37474f", "#00695c"
    );

    private final Random random = new Random();

    @Autowired
    private PresenceService presenceService;

    @Autowired
    private MensagemPendenteService mensagemPendenteService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Recebe mensagens de /app/message e as broadcast para /chat/message.
     * - NEW_USER : atribui cor ao usuário, registra como online
     * - USER_LEFT: remove do mapa de presença
     * - MENSAGEM : encaminha com timestamp; se o destinatário estiver offline salva no BD
     */
    @MessageMapping("/message")
    @SendTo("/chat/message")
    public Mensagem receberMensagem(Mensagem mensagem) {

        // Garantir que o timestamp sempre esteja preenchido
        if (mensagem.getTimestamp() == null || mensagem.getTimestamp().isBlank()) {
            mensagem.setTimestamp(Instant.now().toString());
        }

        if ("NEW_USER".equals(mensagem.getType())) {
            presenceService.userEntrou(mensagem.getUsername());
            if (mensagem.getColor() == null || mensagem.getColor().isBlank()) {
                mensagem.setColor(CORES.get(random.nextInt(CORES.size())));
            }
            mensagem.setTexto(mensagem.getUsername() + " entrou no chat! 👋");
            // Notifica todos com a lista atualizada
            messagingTemplate.convertAndSend("/chat/online", presenceService.getOnlineUsers());

        } else if ("USER_LEFT".equals(mensagem.getType())) {
            presenceService.userSaiu(mensagem.getUsername());
            messagingTemplate.convertAndSend("/chat/online", presenceService.getOnlineUsers());

        } else if ("MENSAGEM".equals(mensagem.getType())) {
            // Persiste para destinatários offline em conversas DM
            String destinatario = mensagem.getDestinatario();
            if (destinatario != null && !destinatario.isBlank()
                    && !presenceService.estaOnline(destinatario)) {
                mensagemPendenteService.salvar(mensagem, destinatario);
            }
        }

        return mensagem;
    }

    /**
     * Recebe o nome do usuário de /app/escrevendo e o broadcast para
     * /chat/escrevendo, para exibir o indicador "digitando...".
     */
    @MessageMapping("/escrevendo")
    @SendTo("/chat/escrevendo")
    public String escrevendo(String username) {
        return username;
    }

    // Endpoint para fornecer lista de usuários online ao conectar
    @MessageMapping("/online")
    public void enviarOnline() {
        messagingTemplate.convertAndSend("/chat/online", presenceService.getOnlineUsers());
    }

    /**
     * Recebe eventos de leitura de mensagem e faz broadcast do status lido.
     */
    @MessageMapping("/read")
    public void marcarComoLida(Mensagem leitura) {
        // Broadcast para o remetente e destinatário: status = 'read'
        Mensagem lida = new Mensagem();
        lida.setId(leitura.getId());
        lida.setType("LEITURA");
        lida.setStatus("read");
        lida.setUsername(leitura.getUsername()); // quem leu
        lida.setDestinatario(leitura.getDestinatario()); // remetente original
        messagingTemplate.convertAndSend("/chat/read", lida);
    }
}

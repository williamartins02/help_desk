package com.start.helpdesk.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Configura o broker STOMP com fallback SockJS.
 *
 * Endpoint: ws://localhost:8080/chat-websocket
 * Destinos:
 *   /app/**       → mensagens enviadas pelo cliente (handled by @MessageMapping)
 *   /chat/**      → tópicos do broker (subscribed by clients)
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Broker simples em memória para os tópicos /chat/...
        registry.enableSimpleBroker("/chat");
        // Prefixo para métodos @MessageMapping no controller
        registry.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/chat-websocket")
                // Permite conexão de qualquer origem localhost (dev)
                .setAllowedOrigins("*")
                // Fallback SockJS para browsers sem suporte nativo a WebSocket
                .withSockJS();
    }
}


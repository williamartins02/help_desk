package com.start.helpdesk.services;

import com.start.helpdesk.domain.dtos.AgendaEventoDTO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/**
 * Serviço responsável por publicar eventos da Agenda via WebSocket (STOMP).
 *
 * <p>Ao alterar o status de uma Tarefa ou Chamado, este publisher
 * notifica todos os clientes conectados nos respectivos tópicos,
 * garantindo atualização em tempo real sem necessidade de polling.</p>
 *
 * <p>Tópicos publicados:</p>
 * <ul>
 *   <li>{@code /agenda/tarefa-atualizada} — status de uma Tarefa alterado</li>
 *   <li>{@code /agenda/chamado-atualizado} — status de um Chamado alterado</li>
 * </ul>
 */
@Service
public class AgendaEventPublisher {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Publica um evento de atualização de Tarefa para todos os clientes conectados.
     *
     * @param tarefaId  ID da tarefa atualizada
     * @param novoStatus código numérico do novo status (0=PENDENTE, 1=EM_EXECUCAO, 2=CONCLUIDO)
     * @param tecnicoId  ID do técnico dono da tarefa (permite filtragem no frontend)
     */
    public void publicarTarefaAtualizada(Integer tarefaId, Integer novoStatus, Integer tecnicoId) {
        AgendaEventoDTO evento = new AgendaEventoDTO(
            "TAREFA_ATUALIZADA",
            tarefaId,
            novoStatus,
            tecnicoId,
            "Tarefa #" + tarefaId + " atualizada para status " + novoStatus
        );
        messagingTemplate.convertAndSend("/agenda/tarefa-atualizada", evento);
    }

    /**
     * Publica um evento de atualização de Chamado para todos os clientes conectados.
     *
     * @param chamadoId  ID do chamado atualizado
     * @param novoStatus código numérico do novo status (0=ABERTO, 1=ANDAMENTO, 2=ENCERRADO)
     * @param tecnicoId  ID do técnico responsável pelo chamado
     */
    public void publicarChamadoAtualizado(Integer chamadoId, Integer novoStatus, Integer tecnicoId) {
        AgendaEventoDTO evento = new AgendaEventoDTO(
            "CHAMADO_ATUALIZADO",
            chamadoId,
            novoStatus,
            tecnicoId,
            "Chamado #" + chamadoId + " atualizado para status " + novoStatus
        );
        messagingTemplate.convertAndSend("/agenda/chamado-atualizado", evento);
    }
}


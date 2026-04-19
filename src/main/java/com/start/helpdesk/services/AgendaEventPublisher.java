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
        AgendaEventoDTO evento = new AgendaEventoDTO();
        evento.setTipo("TAREFA_ATUALIZADA");
        evento.setEntityId(tarefaId);
        evento.setNovoStatus(novoStatus);
        evento.setTecnicoId(tecnicoId);
        evento.setMensagem("Tarefa #" + tarefaId + " atualizada para status " + novoStatus);
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
        AgendaEventoDTO evento = new AgendaEventoDTO();
        evento.setTipo("CHAMADO_ATUALIZADO");
        evento.setEntityId(chamadoId);
        evento.setNovoStatus(novoStatus);
        evento.setTecnicoId(tecnicoId);
        evento.setMensagem("Chamado #" + chamadoId + " atualizado para status " + novoStatus);
        messagingTemplate.convertAndSend("/agenda/chamado-atualizado", evento);
    }

    /**
     * Publica um evento de criação de Chamado para todos os clientes conectados.
     * Garante que Kanban e Central de Chamados exibam o novo chamado em tempo real.
     *
     * @param chamadoId  ID do chamado criado
     * @param novoStatus código numérico do status inicial (normalmente 0=ABERTO)
     * @param tecnicoId  ID do técnico responsável pelo chamado
     */
    public void publicarChamadoCriado(Integer chamadoId, Integer novoStatus, Integer tecnicoId) {
        AgendaEventoDTO evento = new AgendaEventoDTO();
        evento.setTipo("CHAMADO_CRIADO");
        evento.setEntityId(chamadoId);
        evento.setNovoStatus(novoStatus);
        evento.setTecnicoId(tecnicoId);
        evento.setMensagem("Chamado #" + chamadoId + " criado com status " + novoStatus);
        messagingTemplate.convertAndSend("/agenda/chamado-atualizado", evento);
    }

    /**
     * Publica um evento de redistribuição de Chamado.
     * O Kanban do técnico de origem remove o card; o do destino o exibe automaticamente.
     *
     * @param chamadoId      ID do chamado redistribuído
     * @param novoStatus     Status atual do chamado
     * @param tecnicoOrigemId  ID do técnico que perdeu o chamado
     * @param tecnicoDestinoId ID do técnico que recebeu o chamado
     */
    public void publicarChamadoRedistribuido(Integer chamadoId, Integer novoStatus,
                                              Integer tecnicoOrigemId, Integer tecnicoDestinoId) {
        AgendaEventoDTO evento = new AgendaEventoDTO();
        evento.setTipo("CHAMADO_REDISTRIBUIDO");
        evento.setEntityId(chamadoId);
        evento.setNovoStatus(novoStatus);
        evento.setTecnicoId(tecnicoDestinoId);
        evento.setTecnicoOrigemId(tecnicoOrigemId);
        evento.setMensagem("Chamado #" + chamadoId + " redistribuído do técnico " +
                           tecnicoOrigemId + " para " + tecnicoDestinoId);
        messagingTemplate.convertAndSend("/agenda/chamado-atualizado", evento);
    }
}

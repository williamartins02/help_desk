package com.start.helpdesk.domain.dtos;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

/**
 * Payload enviado via WebSocket quando uma Tarefa ou Chamado é atualizado.
 *
 * <p>Publicado nos tópicos:</p>
 * <ul>
 *   <li>{@code /agenda/tarefa-atualizada} — quando o status de uma Tarefa muda</li>
 *   <li>{@code /agenda/chamado-atualizado} — quando o status de um Chamado muda</li>
 * </ul>
 *
 * <p>O frontend assina esses tópicos e atualiza a interface automaticamente
 * sem necessidade de polling.</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AgendaEventoDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * Tipo do evento para que o frontend saiba qual entidade foi afetada.
     * Valores possíveis: "TAREFA_ATUALIZADA", "CHAMADO_ATUALIZADO"
     */
    private String tipo;

    /** ID da entidade afetada (tarefa ou chamado). */
    private Integer entityId;

    /** Novo status (código numérico) da entidade afetada. */
    private Integer novoStatus;

    /**
     * ID do técnico dono da tarefa (usado para filtrar no cliente —
     * cada técnico só reage aos próprios eventos).
     */
    private Integer tecnicoId;

    /** Mensagem descritiva do evento (para log / exibição). */
    private String mensagem;
}


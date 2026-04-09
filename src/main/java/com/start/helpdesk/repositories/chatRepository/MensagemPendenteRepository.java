package com.start.helpdesk.repositories.chatRepository;

import com.start.helpdesk.domain.chat.MensagemPendente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MensagemPendenteRepository extends JpaRepository<MensagemPendente, Long> {

    /** Busca todas as mensagens não entregues para um destinatário, ordenadas por timestamp. */
    List<MensagemPendente> findByDestinatarioAndEntregueOrderByTimestampAsc(
            String destinatario, boolean entregue);

    /** Deleta mensagens já marcadas como entregues para limpeza periódica opcional. */
    @Modifying
    @Query("DELETE FROM MensagemPendente m WHERE m.destinatario = :dest AND m.entregue = true")
    void deleteEntreguesByDestinatario(@Param("dest") String destinatario);
}


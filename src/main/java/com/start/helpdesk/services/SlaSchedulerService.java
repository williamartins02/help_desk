package com.start.helpdesk.services;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.dtos.SlaAlertDTO;
import com.start.helpdesk.domain.enums.Status;
import com.start.helpdesk.repositories.ChamadoRepository;

/**
 * Verifica periodicamente o SLA dos chamados em aberto/andamento
 * e publica alertas via WebSocket no tópico /sla/alertas.
 */
@Service
public class SlaSchedulerService {

    @Autowired
    private ChamadoRepository chamadoRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * Executa a cada 60 segundos.
     * Verifica chamados que estão com SLA em ALERTA ou ATRASADO.
     */
    @Scheduled(fixedRate = 60000)
    public void verificarSla() {
        List<Chamado> chamados = chamadoRepository.findAll();
        LocalDateTime now = LocalDateTime.now();

        for (Chamado c : chamados) {
            // Ignora encerrados
            if (c.getStatus() == Status.ENCERRADO) continue;
            if (c.getPrazoSla() == null) continue;

            String statusSla = computeStatusSla(c, now);
            if ("ALERTA".equals(statusSla) || "ATRASADO".equals(statusSla)) {
                String tempoRestante = formatTempoRestante(c.getPrazoSla(), now);
                SlaAlertDTO alert = new SlaAlertDTO(
                    c.getId(),
                    c.getTitulo(),
                    statusSla,
                    c.getPrioridade() != null ? c.getPrioridade().getDescricao() : "N/A",
                    c.getTecnico() != null ? c.getTecnico().getNome() : "N/A",
                    tempoRestante
                );
                messagingTemplate.convertAndSend("/sla/alertas", alert);
            }
        }
    }

    private String computeStatusSla(Chamado c, LocalDateTime now) {
        if (now.isAfter(c.getPrazoSla())) return "ATRASADO";
        long totalSeconds = Duration.between(c.getDataAbertura(), c.getPrazoSla()).getSeconds();
        long remainingSeconds = Duration.between(now, c.getPrazoSla()).getSeconds();
        if (totalSeconds > 0 && remainingSeconds < totalSeconds / 2) return "ALERTA";
        return "DENTRO_PRAZO";
    }

    private String formatTempoRestante(LocalDateTime prazoSla, LocalDateTime now) {
        Duration d = Duration.between(now, prazoSla);
        long totalSeconds = Math.abs(d.getSeconds());
        long hh = totalSeconds / 3600;
        long mm = (totalSeconds % 3600) / 60;
        long ss = totalSeconds % 60;
        String sign = d.isNegative() ? "-" : "";
        return String.format("%s%02d:%02d:%02d", sign, hh, mm, ss);
    }
}


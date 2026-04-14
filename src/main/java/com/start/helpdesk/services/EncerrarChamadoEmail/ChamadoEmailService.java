package com.start.helpdesk.services.EncerrarChamadoEmail;

import com.start.helpdesk.domain.Chamado;
import com.start.helpdesk.domain.Cliente;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import javax.mail.MessagingException;
import javax.mail.internet.MimeMessage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class ChamadoEmailService {
    private static final Logger logger = LoggerFactory.getLogger(ChamadoEmailService.class);
    @Autowired
    private JavaMailSender mailSender;

    private static final String EMAIL_TEMPLATE_PATH = "templates/chamado-encerrado-email.html";

    public void sendChamadoEncerradoEmail(Chamado chamado) {
        Cliente cliente = chamado.getCliente();
        if (cliente == null || cliente.getEmail() == null) return;
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setTo(cliente.getEmail());
            helper.setSubject("Seu chamado foi encerrado");
            helper.setText(buildText(chamado), buildHtml(chamado));
            mailSender.send(message);
        } catch (MessagingException ex) {
            logger.error("Erro ao enviar e-mail de chamado encerrado para {}: {}", cliente.getEmail(), ex.getMessage(), ex);
        } catch (Exception ex) {
            logger.error("Erro inesperado ao enviar e-mail de chamado encerrado para {}: {}", cliente.getEmail(), ex.getMessage(), ex);
        }
    }

    private String buildText(Chamado chamado) {
        return "Olá, " + chamado.getCliente().getNome() + "\n\n" +
                "Seu chamado número " + chamado.getId() + " foi encerrado.";
    }

    private String buildHtml(Chamado chamado) {
        String template = loadEmailTemplate();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm");

        String dataAbertura    = chamado.getDataAbertura()   != null ? chamado.getDataAbertura().format(fmt)  : "";
        String dataEncerramento = "";
        String tempoResolucao   = "";

        if (chamado.getDataFechamento() != null) {
            LocalDateTime fechamento = chamado.getDataFechamento();
            dataEncerramento = fechamento.format(fmt);

            if (chamado.getDataAbertura() != null) {
                try {
                    Duration duration = Duration.between(chamado.getDataAbertura(), fechamento);
                    long totalMinutos = duration.toMinutes();
                    if (totalMinutos == 1) {
                        tempoResolucao = "1 minuto";
                    } else if (totalMinutos < 60) {
                        tempoResolucao = totalMinutos + " minutos";
                    } else if (totalMinutos < 120) {
                        tempoResolucao = "1 hora";
                    } else if (totalMinutos < 1440) {
                        tempoResolucao = (totalMinutos / 60) + " horas";
                    } else if (totalMinutos < 2880) {
                        tempoResolucao = "1 dia";
                    } else if (totalMinutos < 43200) {
                        tempoResolucao = (totalMinutos / 1440) + " dias";
                    } else if (totalMinutos < 86400) {
                        tempoResolucao = "1 mes";
                    } else {
                        tempoResolucao = (totalMinutos / 43200) + " meses";
                    }
                } catch (Exception e) {
                    tempoResolucao = "";
                }
            }
        }
        String tecnico = chamado.getTecnico() != null ? chamado.getTecnico().getNome() : "";
        String observacoes = chamado.getObservacoes() != null ? chamado.getObservacoes() : "";
        String anoAtual = String.valueOf(java.time.Year.now().getValue());
        return template
                .replace("{{nome}}", org.springframework.web.util.HtmlUtils.htmlEscape(chamado.getCliente().getNome()))
                .replace("{{numero}}", String.valueOf(chamado.getId()))
                .replace("{{titulo}}", org.springframework.web.util.HtmlUtils.htmlEscape(chamado.getTitulo()))
                .replace("{{descricao}}", org.springframework.web.util.HtmlUtils.htmlEscape(chamado.getObservacoes()))
                .replace("{{status}}", "Encerrado")
                .replace("{{dataAbertura}}", dataAbertura)
                .replace("{{dataEncerramento}}", dataEncerramento)
                .replace("{{tempoResolucao}}", tempoResolucao)
                .replace("{{tecnico}}", tecnico)
                .replace("{{observacoes}}", observacoes)
                .replace("{{anoAtual}}", anoAtual);
    }

    private String loadEmailTemplate() {
        try {
            ClassPathResource resource = new ClassPathResource(EMAIL_TEMPLATE_PATH);
            return StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            return "<p>Seu chamado foi encerrado.</p>";
        }
    }
}

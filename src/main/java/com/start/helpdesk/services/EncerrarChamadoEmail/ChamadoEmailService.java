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
import org.springframework.web.util.HtmlUtils;

import javax.mail.MessagingException;
import javax.mail.internet.MimeMessage;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.sql.Timestamp;

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
        String dataAbertura = chamado.getDataAbertura() != null ? String.valueOf(chamado.getDataAbertura()) : "";
        String dataEncerramento = chamado.getDataFechamento() != null ? String.valueOf(chamado.getDataFechamento()) : "";
        String tempoResolucao = "";
        if (chamado.getDataAbertura() != null && chamado.getDataFechamento() != null) {
            try {
                LocalDateTime abertura = null;
                LocalDateTime fechamento = null;
                Object aberturaObj = chamado.getDataAbertura();
                Object fechamentoObj = chamado.getDataFechamento();
                if (aberturaObj instanceof LocalDateTime) {
                    abertura = (LocalDateTime) aberturaObj;
                } else if (aberturaObj instanceof LocalDate) {
                    abertura = ((LocalDate) aberturaObj).atStartOfDay();
                } else if (aberturaObj instanceof Timestamp) {
                    abertura = ((Timestamp) aberturaObj).toLocalDateTime();
                }
                if (fechamentoObj instanceof LocalDateTime) {
                    fechamento = (LocalDateTime) fechamentoObj;
                } else if (fechamentoObj instanceof LocalDate) {
                    fechamento = ((LocalDate) fechamentoObj).atStartOfDay();
                } else if (fechamentoObj instanceof Timestamp) {
                    fechamento = ((Timestamp) fechamentoObj).toLocalDateTime();
                }
                if (abertura != null && fechamento != null) {
                    Duration duration = Duration.between(abertura, fechamento);
                    long hours = duration.toHours();
                    long minutes = duration.toMinutes() % 60;
                    tempoResolucao = hours + "h " + minutes + "min";
                }
            } catch (Exception e) {
                tempoResolucao = "";
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

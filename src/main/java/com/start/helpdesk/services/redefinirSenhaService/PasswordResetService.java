package com.start.helpdesk.services.redefinirSenhaService;

import com.start.helpdesk.domain.Pessoa;
import com.start.helpdesk.domain.redefinirSenhaEntity.PasswordResetToken;
import com.start.helpdesk.repositories.chatRepository.PasswordResetTokenRepository;
import com.start.helpdesk.repositories.PessoaRepository;
import com.start.helpdesk.services.exception.ObjectnotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

import javax.mail.MessagingException;
import javax.mail.internet.MimeMessage;
import javax.transaction.Transactional;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class PasswordResetService {

    private final PessoaRepository pessoaRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JavaMailSender mailSender;

    @Value("${app.reset-password.base-url:http://localhost:8080/auth/reset-password}")
    private String resetBaseUrl;

    private static final String EMAIL_TEMPLATE_PATH = "templates/password-reset-email.html";

    public PasswordResetService(
            PessoaRepository pessoaRepository,
            PasswordResetTokenRepository tokenRepository,
            BCryptPasswordEncoder passwordEncoder,
            JavaMailSender mailSender) {
        this.pessoaRepository = pessoaRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailSender = mailSender;
    }

    @Transactional
    public void sendResetEmail(String email) {
        Pessoa pessoa = pessoaRepository.findByEmail(email)
                .orElseThrow(() -> new ObjectnotFoundException("E-mail não encontrado."));

        String token = UUID.randomUUID().toString();

        PasswordResetToken prt = new PasswordResetToken();
        prt.setToken(token);
        prt.setUser(pessoa);
        prt.setExpiryDate(LocalDateTime.now().plusMinutes(30));
        tokenRepository.save(prt);

        String resetLink = UriComponentsBuilder.fromUriString(resetBaseUrl)
                .queryParam("token", token)
                .toUriString();

        sendResetMail(pessoa, resetLink);
    }

    private void sendResetMail(Pessoa pessoa, String resetLink) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setTo(pessoa.getEmail());
            helper.setSubject("Redefinição de senha");
            helper.setText(buildResetText(pessoa.getNome(), resetLink), buildResetHtmlFromTemplate(pessoa.getNome(), resetLink));
            mailSender.send(message);
        } catch (MessagingException ex) {
            throw new IllegalStateException("Não foi possível enviar o e-mail de redefinição.", ex);
        }
    }

    private String buildResetText(String nome, String resetLink) {
        return "Olá, " + nome + "\n\n"
                + "Recebemos um pedido para redefinir sua senha.\n"
                + "Use o link abaixo para criar uma nova senha:\n"
                + resetLink + "\n\n"
                + "Este link expira em 30 minutos.";
    }

    private String buildResetHtmlFromTemplate(String nome, String resetLink) {
        String template = loadEmailTemplate();
        return template
                .replace("{{NOME}}", HtmlUtils.htmlEscape(nome))
                .replace("{{RESET_LINK}}", HtmlUtils.htmlEscape(resetLink));
    }

    private String loadEmailTemplate() {
        try {
            ClassPathResource resource = new ClassPathResource(EMAIL_TEMPLATE_PATH);
            return StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Não foi possível carregar o template de e-mail.", ex);
        }
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        PasswordResetToken prt = tokenRepository
                .findByTokenAndExpiryDateAfter(token, LocalDateTime.now())
                .orElseThrow(() -> new IllegalArgumentException("Token inválido ou expirado."));

        Pessoa pessoa = prt.getUser();
        pessoa.setSenha(passwordEncoder.encode(newPassword));
        pessoaRepository.save(pessoa);

        tokenRepository.delete(prt); // invalida token após uso
    }
}

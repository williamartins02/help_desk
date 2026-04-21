package com.start.helpdesk.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * Utilitário para operações comuns relacionadas ao contexto de segurança.
 * Centraliza a extração do e-mail do usuário autenticado, evitando
 * duplicação de código nos controllers.
 */
public final class SecurityUtils {

    private SecurityUtils() {
        // Classe utilitária — não instanciável
    }

    /**
     * Retorna o e-mail (username) do usuário atualmente autenticado
     * a partir do {@link SecurityContextHolder}.
     *
     * @return e-mail do usuário autenticado, nunca {@code null}
     */
    public static String getAuthenticatedEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            throw new IllegalStateException("Nenhuma autenticação encontrada no contexto de segurança.");
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        }
        return principal.toString();
    }
}


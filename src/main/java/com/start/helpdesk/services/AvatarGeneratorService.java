package com.start.helpdesk.services;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.springframework.stereotype.Component;

/**
 * Gera avatares SVG dinâmicos codificados em Base64 a partir do nome do técnico.
 * Usado como foto de perfil padrão quando nenhuma imagem é enviada.
 */
@Component
public class AvatarGeneratorService {

    private static final String[] COLORS = {
        "#1565c0", "#0288d1", "#00838f", "#2e7d32", "#558b2f",
        "#e65100", "#4527a0", "#283593", "#6a1b9a", "#ad1457",
        "#c62828", "#37474f", "#0097a7", "#f57c00", "#455a64"
    };

    /**
     * Gera um avatar SVG com as iniciais do nome e cor aleatória baseada no nome.
     *
     * @param nome nome completo do técnico
     * @return string Base64 no formato "data:image/svg+xml;base64,..."
     */
    public String generateAvatarBase64(String nome) {
        if (nome == null || nome.trim().isEmpty()) {
            nome = "Técnico";
        }

        String initials = getInitials(nome);
        String color = pickColor(nome);

        String svg = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
            "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"120\" viewBox=\"0 0 120 120\">" +
            "<defs>" +
            "<linearGradient id=\"grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">" +
            "<stop offset=\"0%\" style=\"stop-color:" + lighten(color) + ";stop-opacity:1\" />" +
            "<stop offset=\"100%\" style=\"stop-color:" + color + ";stop-opacity:1\" />" +
            "</linearGradient>" +
            "</defs>" +
            "<circle cx=\"60\" cy=\"60\" r=\"60\" fill=\"url(#grad)\"/>" +
            "<text x=\"60\" y=\"60\" font-family=\"Arial,Helvetica,sans-serif\" font-size=\"46\" " +
            "font-weight=\"700\" fill=\"white\" text-anchor=\"middle\" dominant-baseline=\"central\" " +
            "letter-spacing=\"2\">" + initials + "</text>" +
            "</svg>";

        byte[] encoded = Base64.getEncoder().encode(svg.getBytes(StandardCharsets.UTF_8));
        return "data:image/svg+xml;base64," + new String(encoded, StandardCharsets.UTF_8);
    }

    /** Extrai iniciais: primeira letra do primeiro nome + primeira letra do último nome. */
    private String getInitials(String nome) {
        String[] parts = nome.trim().split("\\s+");
        if (parts.length == 1) {
            int len = Math.min(2, parts[0].length());
            return parts[0].substring(0, len).toUpperCase();
        }
        return (String.valueOf(parts[0].charAt(0)) +
                String.valueOf(parts[parts.length - 1].charAt(0))).toUpperCase();
    }

    /** Seleciona cor baseado no hash do nome (determinístico para o mesmo nome). */
    private String pickColor(String nome) {
        int idx = (nome.hashCode() & Integer.MAX_VALUE) % COLORS.length;
        return COLORS[idx];
    }

    /**
     * Gera uma versão ligeiramente mais clara da cor hex para o gradiente.
     * Soma 30 a cada componente R, G, B limitado a 255.
     */
    private String lighten(String hex) {
        try {
            int r = Integer.parseInt(hex.substring(1, 3), 16);
            int g = Integer.parseInt(hex.substring(3, 5), 16);
            int b = Integer.parseInt(hex.substring(5, 7), 16);
            r = Math.min(255, r + 50);
            g = Math.min(255, g + 50);
            b = Math.min(255, b + 50);
            return String.format("#%02x%02x%02x", r, g, b);
        } catch (Exception e) {
            return hex;
        }
    }
}


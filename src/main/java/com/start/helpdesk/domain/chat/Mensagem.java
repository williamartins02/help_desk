package com.start.helpdesk.domain.chat;

/**
 * Modelo de mensagem trocada no chat em tempo real.
 * Não é uma entidade JPA — trafega apenas via WebSocket/STOMP.
 */
public class Mensagem {

    private String texto;
    private String username;
    /** NEW_USER | USER_LEFT | MENSAGEM */
    private String type;
    /** Cor do avatar gerada pelo servidor na entrada do usuário */
    private String color;
    private String timestamp;
    /** sent | delivered | read */
    private String status;
    /** Canal/sala (ex: "geral", "dm_1_2") */
    private String sala;

    /** E-mail do destinatário para mensagens diretas (DM). Null em mensagens de canal. */
    private String destinatario;

    private String id;

    // ── Constructors ──────────────────────────────────────────────────────

    public Mensagem() {}

    public Mensagem(String texto, String username, String type, String color,
                    String timestamp, String status, String sala) {
        this.texto     = texto;
        this.username  = username;
        this.type      = type;
        this.color     = color;
        this.timestamp = timestamp;
        this.status    = status;
        this.sala      = sala;
    }

    // ── Getters & Setters ────────────────────────────────────────────────

    public String getTexto()                    { return texto; }
    public void   setTexto(String texto)        { this.texto = texto; }

    public String getUsername()                 { return username; }
    public void   setUsername(String username)  { this.username = username; }

    public String getType()                     { return type; }
    public void   setType(String type)          { this.type = type; }

    public String getColor()                    { return color; }
    public void   setColor(String color)        { this.color = color; }

    public String getTimestamp()                { return timestamp; }
    public void   setTimestamp(String timestamp){ this.timestamp = timestamp; }

    public String getStatus()                   { return status; }
    public void   setStatus(String status)      { this.status = status; }

    public String getSala()                     { return sala; }
    public void   setSala(String sala)          { this.sala = sala; }

    public String getDestinatario()                    { return destinatario; }
    public void   setDestinatario(String destinatario) { this.destinatario = destinatario; }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
}

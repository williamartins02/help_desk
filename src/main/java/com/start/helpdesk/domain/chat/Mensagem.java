package com.start.helpdesk.domain.chat;

import java.util.List;

/**
 * Modelo de mensagem trocada no chat em tempo real.
 * Não é uma entidade JPA — trafega apenas via WebSocket/STOMP.
 */
public class Mensagem {

    private String texto;
    private String username;
    /** NEW_USER | USER_LEFT | MENSAGEM | REACTION | DELETE_MSG | EDIT_MSG | LEITURA */
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

    // ── Campos de ação (REACTION / DELETE_MSG / EDIT_MSG) ────────────────
    /** Chave da mensagem alvo da ação */
    private String msgId;
    /** Emoji escolhido para REACTION (vazio = remover reação) */
    private String emoji;
    /** Novo texto para EDIT_MSG */
    private String novoTexto;

    // ── Resposta com menção ───────────────────────────────────────────────
    /** Mensagem original citada quando esta é uma resposta */
    private ReplyTo replyTo;

    /** Classe aninhada que representa a mensagem original citada */
    public static class ReplyTo {
        private String id;
        private String username;
        private String texto;

        public ReplyTo() {}

        public String getId()                      { return id; }
        public void   setId(String id)             { this.id = id; }
        public String getUsername()                { return username; }
        public void   setUsername(String username) { this.username = username; }
        public String getTexto()                   { return texto; }
        public void   setTexto(String texto)       { this.texto = texto; }
    }

    // ── Reações ───────────────────────────────────────────────────────────
    /** Lista de reações: { emoji, username } */
    private List<Reaction> reactions;

    /** Representa uma reação de um usuário a uma mensagem */
    public static class Reaction {
        private String emoji;
        private String username;

        public Reaction() {}

        public String getEmoji()                   { return emoji; }
        public void   setEmoji(String emoji)       { this.emoji = emoji; }
        public String getUsername()                { return username; }
        public void   setUsername(String username) { this.username = username; }
    }

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

    public String getId()                       { return id; }
    public void   setId(String id)              { this.id = id; }

    public String getMsgId()                    { return msgId; }
    public void   setMsgId(String msgId)        { this.msgId = msgId; }

    public String getEmoji()                    { return emoji; }
    public void   setEmoji(String emoji)        { this.emoji = emoji; }

    public String getNovoTexto()                      { return novoTexto; }
    public void   setNovoTexto(String novoTexto)      { this.novoTexto = novoTexto; }

    public ReplyTo getReplyTo()                 { return replyTo; }
    public void    setReplyTo(ReplyTo replyTo)  { this.replyTo = replyTo; }

    public List<Reaction> getReactions()                    { return reactions; }
    public void           setReactions(List<Reaction> r)    { this.reactions = r; }
}

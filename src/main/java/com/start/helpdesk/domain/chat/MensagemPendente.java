package com.start.helpdesk.domain;

import javax.persistence.*;
import java.io.Serializable;

/**
 * Mensagem enviada a um usuário que estava offline no momento do envio.
 * Fica armazenada no banco até ser entregue quando o destinatário fizer login.
 */
@Entity
@Table(name = "mensagem_pendente")
public class MensagemPendente implements Serializable {
    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** E-mail do remetente */
    @Column(nullable = false)
    private String remetente;

    /** E-mail do destinatário (usuário que estava offline) */
    @Column(nullable = false)
    private String destinatario;

    @Column(length = 2000)
    private String texto;

    /** Sala de destino (ex: "dm_1_2") */
    private String sala;

    private String timestamp;

    /** Cor do avatar do remetente */
    private String color;

    /** true quando já foi entregue ao destinatário */
    @Column(nullable = false)
    private boolean entregue = false;

    public MensagemPendente() {}

    // ── Getters & Setters ─────────────────────────────────────────────────────

    public Long   getId()                        { return id; }
    public void   setId(Long id)                 { this.id = id; }

    public String getRemetente()                 { return remetente; }
    public void   setRemetente(String remetente) { this.remetente = remetente; }

    public String getDestinatario()                    { return destinatario; }
    public void   setDestinatario(String destinatario) { this.destinatario = destinatario; }

    public String getTexto()                     { return texto; }
    public void   setTexto(String texto)         { this.texto = texto; }

    public String getSala()                      { return sala; }
    public void   setSala(String sala)           { this.sala = sala; }

    public String getTimestamp()                       { return timestamp; }
    public void   setTimestamp(String timestamp)       { this.timestamp = timestamp; }

    public String getColor()                     { return color; }
    public void   setColor(String color)         { this.color = color; }

    public boolean isEntregue()                  { return entregue; }
    public void    setEntregue(boolean entregue) { this.entregue = entregue; }
}


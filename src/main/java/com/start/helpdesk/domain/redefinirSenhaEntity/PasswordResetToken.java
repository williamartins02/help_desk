package com.start.helpdesk.domain.redefinirSenhaEntity;

import com.start.helpdesk.domain.Pessoa;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.ManyToOne;
import java.time.LocalDateTime;

@Entity
public class PasswordResetToken {
    @Id
    private String token;

    @ManyToOne
    private Pessoa user;

    private LocalDateTime expiryDate;

    public LocalDateTime getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(LocalDateTime expiryDate) {
        this.expiryDate = expiryDate;
    }

    public Pessoa getUser() {
        return user;
    }

    public void setUser(Pessoa user) {
        this.user = user;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }
}

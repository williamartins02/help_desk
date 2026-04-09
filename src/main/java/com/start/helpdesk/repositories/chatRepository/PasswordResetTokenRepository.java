package com.start.helpdesk.repositories;

import com.start.helpdesk.domain.redefinirSenhaEntity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, String> {
    Optional<PasswordResetToken> findByTokenAndExpiryDateAfter(String token, LocalDateTime now);
}


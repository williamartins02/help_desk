CREATE TABLE IF NOT EXISTS password_reset_token (
    token VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    expiry_date DATETIME NOT NULL,
    PRIMARY KEY (token),
    CONSTRAINT fk_password_reset_user
        FOREIGN KEY (user_id) REFERENCES pessoa(id)
        ON DELETE CASCADE,
    INDEX idx_password_reset_user_id (user_id),
    INDEX idx_password_reset_expiry (expiry_date)
);


package com.start.helpdesk.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Executa a migração do campo prazo_sla na inicialização da aplicação.
 * Preenche chamados existentes que ainda não têm prazo_sla calculado.
 */
@Component
public class SlaMigrationRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SlaMigrationRunner.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            // Verifica se a coluna prazo_sla já existe (ddl-auto=update cria, mas pode estar vazia)
            int updated = jdbcTemplate.update(
                "UPDATE chamado SET prazo_sla = " +
                "CASE " +
                "  WHEN prioridade = 3 THEN DATE_ADD(data_abertura, INTERVAL 2  HOUR) " +
                "  WHEN prioridade = 2 THEN DATE_ADD(data_abertura, INTERVAL 4  HOUR) " +
                "  WHEN prioridade = 1 THEN DATE_ADD(data_abertura, INTERVAL 8  HOUR) " +
                "  WHEN prioridade = 0 THEN DATE_ADD(data_abertura, INTERVAL 24 HOUR) " +
                "  ELSE DATE_ADD(data_abertura, INTERVAL 8 HOUR) " +
                "END " +
                "WHERE prazo_sla IS NULL"
            );
            if (updated > 0) {
                log.info("SLA Migration: prazo_sla calculado para {} chamado(s) existente(s).", updated);
            }
        } catch (Exception e) {
            log.warn("SLA Migration skipped: {}", e.getMessage());
        }
    }
}


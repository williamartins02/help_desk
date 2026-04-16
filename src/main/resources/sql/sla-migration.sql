-- Migração SLA: calcula e preenche prazo_sla para chamados existentes que ainda não têm
-- BAIXA=24h | MEDIA=8h | ALTA=4h | CRITICA=2h
UPDATE chamado
SET prazo_sla = CASE
    WHEN prioridade = 3 THEN DATE_ADD(data_abertura, INTERVAL 2  HOUR)   -- CRITICA
    WHEN prioridade = 2 THEN DATE_ADD(data_abertura, INTERVAL 4  HOUR)   -- ALTA
    WHEN prioridade = 1 THEN DATE_ADD(data_abertura, INTERVAL 8  HOUR)   -- MEDIA
    WHEN prioridade = 0 THEN DATE_ADD(data_abertura, INTERVAL 24 HOUR)   -- BAIXA
    ELSE DATE_ADD(data_abertura, INTERVAL 8 HOUR)
END
WHERE prazo_sla IS NULL;


-- ============================================================
-- MIGRAÇÃO: data_fechamento  DATE → DATETIME
-- Execute este script no MySQL ANTES de reiniciar a aplicação.
-- ============================================================

-- 1. Altera o tipo da coluna de DATE para DATETIME
ALTER TABLE chamado MODIFY COLUMN data_fechamento DATETIME;

-- 2. Corrige os registros antigos que foram salvos com horário 00:00:00
--    (fechamentos registrados pela versão anterior que só gravava a data).
--    Ajusta para o final do dia (23:59:59) para evitar tempo negativo
--    em chamados abertos e fechados no mesmo dia.
UPDATE chamado
SET    data_fechamento = CONCAT(DATE(data_fechamento), ' 23:59:59')
WHERE  status          = 2
  AND  data_fechamento IS NOT NULL
  AND  HOUR(data_fechamento)   = 0
  AND  MINUTE(data_fechamento) = 0
  AND  SECOND(data_fechamento) = 0;


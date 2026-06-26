-- ════════════════════════════════════════════════════════════
-- FEATURE: SORTEIO DE TIMES (turma fechada)
-- Idempotente. Rodar em TESTE primeiro, depois produção.
-- ════════════════════════════════════════════════════════════

-- 1) Força oficial do jogador (1=Iniciante, 2=Mediano, 3=Bom, 4=Craque)
--    Default 2 (Mediano) para quem não tem nota.
ALTER TABLE jogador ADD COLUMN IF NOT EXISTS forca INTEGER DEFAULT 2;

-- Garante que ninguém fique nulo (jogadores já existentes viram Mediano)
UPDATE jogador SET forca = 2 WHERE forca IS NULL;

-- 2) Ajustes "do dia" no encontro_participacao (sem alterar o cadastro oficial)
--    Se nulos, o sorteio usa os valores oficiais do jogador.
ALTER TABLE encontro_participacao ADD COLUMN IF NOT EXISTS forca_dia INTEGER;       -- força só para este encontro
ALTER TABLE encontro_participacao ADD COLUMN IF NOT EXISTS id_posicao_dia INTEGER;  -- posição só para este encontro

-- FK opcional para a posição do dia (não quebra se a posição for removida)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_ep_posicao_dia'
  ) THEN
    ALTER TABLE encontro_participacao
      ADD CONSTRAINT fk_ep_posicao_dia
      FOREIGN KEY (id_posicao_dia) REFERENCES posicao(id_posicao) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Marca no encontro se os times foram ajustados manualmente após o sorteio
--    (para o selo de "ajustado manualmente" no card — sem dizer quem)
ALTER TABLE encontro ADD COLUMN IF NOT EXISTS times_ajustados_manual BOOLEAN DEFAULT FALSE;

-- Observação: a atribuição do jogador a um time interno usa a coluna
-- encontro_participacao.id_time_interno, que JÁ EXISTE. O sorteio só preenche ela.

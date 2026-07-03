-- ════════════════════════════════════════════════════════════
-- FEATURE: AVALIAÇÕES / DEPOIMENTOS (moderadas)
-- Idempotente. Rodar em TESTE primeiro, depois produção.
-- Reusa as funções is_superadmin() e tem_acesso_time() já existentes.
-- ════════════════════════════════════════════════════════════

-- 1) Tabela de avaliações
CREATE TABLE IF NOT EXISTS avaliacao (
  id                    SERIAL PRIMARY KEY,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  id_time               INTEGER REFERENCES time(id_time) ON DELETE SET NULL,
  nota                  INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  texto                 TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 500),
  publicar_identidade   BOOLEAN NOT NULL DEFAULT FALSE,
  nome_exibicao         TEXT,        -- snapshot do nome/apelido no envio
  nome_time             TEXT,        -- snapshot do nome do time no envio
  status                TEXT NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente','aprovado','recusado')),
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  moderado_em           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_avaliacao_status ON avaliacao(status);
CREATE INDEX IF NOT EXISTS idx_avaliacao_user ON avaliacao(user_id);

-- 2) Habilitar RLS
ALTER TABLE avaliacao ENABLE ROW LEVEL SECURITY;

-- Limpa políticas antigas (idempotente)
DROP POLICY IF EXISTS "aval_leitura_publica" ON avaliacao;
DROP POLICY IF EXISTS "aval_leitura_propria" ON avaliacao;
DROP POLICY IF EXISTS "aval_leitura_super" ON avaliacao;
DROP POLICY IF EXISTS "aval_insert" ON avaliacao;
DROP POLICY IF EXISTS "aval_update_super" ON avaliacao;

-- 3) LEITURA
-- 3a) Qualquer um (inclusive anônimo/público) lê as APROVADAS
CREATE POLICY "aval_leitura_publica" ON avaliacao
  FOR SELECT USING (status = 'aprovado');

-- 3b) O autor lê as próprias (pra ver o status: pendente/recusado)
CREATE POLICY "aval_leitura_propria" ON avaliacao
  FOR SELECT USING (user_id = auth.uid());

-- 3c) Superadmin lê todas (pra moderar)
CREATE POLICY "aval_leitura_super" ON avaliacao
  FOR SELECT USING (is_superadmin());

-- 4) INSERÇÃO
-- Só quem é admin de ALGUM time pode criar, e só em nome de si mesmo,
-- sempre entrando como 'pendente' (não dá pra auto-aprovar).
CREATE POLICY "aval_insert" ON avaliacao
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND status = 'pendente'
    AND EXISTS (
      SELECT 1 FROM usuario_time
      WHERE user_id = auth.uid()
    )
  );

-- 5) MODERAÇÃO (mudar status: aprovar/recusar/revogar)
-- Só superadmin.
CREATE POLICY "aval_update_super" ON avaliacao
  FOR UPDATE USING (is_superadmin());

-- 6) View auxiliar para a média (opcional, facilita o front)
--    Retorna média e contagem só das aprovadas.
CREATE OR REPLACE VIEW avaliacao_resumo AS
  SELECT
    COUNT(*)                       AS total,
    ROUND(AVG(nota)::numeric, 1)   AS media
  FROM avaliacao
  WHERE status = 'aprovado';

-- Nota: a view herda o RLS da tabela; como a policy pública lê aprovadas,
-- o resumo funciona para todos.

-- Observação sobre o escudo: NÃO guardamos o escudo aqui. Ele é buscado em
-- tempo real via join com time(id_time) → escudo_url no momento de exibir.

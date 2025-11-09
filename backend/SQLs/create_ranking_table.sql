-- Tabela para armazenar rankings de partidas
-- Esta tabela armazena o histórico de pontuações de cada jogador por partida
-- Execute este script no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS ranking (
  ranking_id SERIAL PRIMARY KEY,
  jogador_id INTEGER NOT NULL REFERENCES jogador(jogador_id) ON DELETE CASCADE,
  sala_id INTEGER NOT NULL REFERENCES sala(sala_id) ON DELETE CASCADE,
  pontuacao_total INTEGER NOT NULL DEFAULT 0,
  vencedor BOOLEAN NOT NULL DEFAULT FALSE,
  data_partida TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Garante que não há duplicatas de jogador por partida
  UNIQUE(jogador_id, sala_id)
);

-- Índices para melhorar performance das consultas
CREATE INDEX IF NOT EXISTS idx_ranking_jogador_id ON ranking(jogador_id);
CREATE INDEX IF NOT EXISTS idx_ranking_sala_id ON ranking(sala_id);
CREATE INDEX IF NOT EXISTS idx_ranking_pontuacao ON ranking(pontuacao_total DESC);
CREATE INDEX IF NOT EXISTS idx_ranking_data_partida ON ranking(data_partida DESC);

-- Comentários para documentação (PostgreSQL)
COMMENT ON TABLE ranking IS 'Armazena o histórico de pontuações dos jogadores por partida para gerar rankings';
COMMENT ON COLUMN ranking.vencedor IS 'Indica se o jogador foi vencedor desta partida';
COMMENT ON COLUMN ranking.pontuacao_total IS 'Pontuação total obtida pelo jogador nesta partida';


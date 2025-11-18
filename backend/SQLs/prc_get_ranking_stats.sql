CREATE OR REPLACE FUNCTION get_ranking_stats(p_jogador_id BIGINT)
RETURNS TABLE(partidas_jogadas BIGINT, vitorias BIGINT, pontuacao_total BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(r.ranking_id) AS partidas_jogadas,
        COUNT(r.ranking_id) FILTER (WHERE r.vencedor = true) AS vitorias,
        COALESCE(SUM(r.pontuacao_total), 0) AS pontuacao_total
    FROM
        public.ranking r
    WHERE
        r.jogador_id = p_jogador_id;
END;
$$ LANGUAGE plpgsql;

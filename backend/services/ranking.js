// backend/services/ranking.js
import { supa } from './supabase.js'

/**
 * Salva o ranking de uma partida finalizada
 * @param {number} salaId - ID da sala
 * @param {Object} totais - Objeto com pontuações totais { jogador_id: pontuacao }
 * @param {Object} winnerInfo - Informações do vencedor (de computeWinner)
 */
export async function saveRanking({ salaId, totais, winnerInfo }) {
  try {
    const jogadores = Object.keys(totais || {}).map(Number)
    if (!jogadores.length) {
      console.warn(`[saveRanking] Nenhum jogador encontrado para sala ${salaId}`)
      return
    }

    const records = []
    for (const jogadorId of jogadores) {
      const pontuacao = totais[jogadorId] || 0
      // Em caso de empate, nenhum jogador recebe vitória
      const isWinner = !winnerInfo?.empate && winnerInfo?.jogador_id === jogadorId

      records.push({
        jogador_id: jogadorId,
        sala_id: salaId,
        pontuacao_total: pontuacao,
        vencedor: isWinner,
        data_partida: new Date().toISOString()
      })
    }

    // Usa insert para garantir que cada partida seja um novo registro
    const { error } = await supa
      .from('ranking')
      .insert(records)

    if (error) {
      console.error(`[saveRanking] Erro ao salvar ranking para sala ${salaId}:`, error)
      throw error
    }

    console.log(`[saveRanking] Ranking salvo para sala ${salaId} com ${records.length} jogadores`)
  } catch (error) {
    console.error(`[saveRanking] Erro ao processar ranking:`, error)
    throw error
  }
}

/**
 * Busca o ranking global (top 10 jogadores)
 * @param {number} limit - Limite de resultados (padrão: 10)
 */
export async function getGlobalRanking(limit = 10) {
  try {
    // Agrega pontuações por jogador (soma ou média, dependendo da lógica desejada)
    // Aqui vamos usar a SOMA de todas as pontuações
    const { data, error } = await supa
      .from('ranking')
      .select(`
        jogador_id,
        pontuacao_total,
        vencedor,
        jogador:jogador_id (
          jogador_id,
          nome_de_usuario
        )
      `)

    if (error) throw error

    // Agrupa por jogador e soma as pontuações
    const aggregated = {}
    for (const record of data || []) {
      const jId = record.jogador_id
      if (!aggregated[jId]) {
        aggregated[jId] = {
          jogador_id: jId,
          nome_de_usuario: record.jogador?.nome_de_usuario || `Jogador ${jId}`,
          pontuacao_total: 0,
          partidas_jogadas: 0,
          vitorias: 0
        }
      }
      aggregated[jId].pontuacao_total += record.pontuacao_total || 0
      aggregated[jId].partidas_jogadas += 1
      if (record.vencedor) {
        aggregated[jId].vitorias += 1
      }
    }

    // Converte para array e ordena por pontuação total
    const ranking = Object.values(aggregated)
      .sort((a, b) => b.pontuacao_total - a.pontuacao_total)
      .slice(0, limit)
      .map((item, index) => ({
        posicao: index + 1,
        jogador_id: item.jogador_id,
        nome_de_usuario: item.nome_de_usuario,
        pontuacao_total: item.pontuacao_total,
        partidas_jogadas: item.partidas_jogadas,
        vitorias: item.vitorias
      }))

    return ranking
  } catch (error) {
    console.error('[getGlobalRanking] Erro ao buscar ranking global:', error)
    throw error
  }
}

/**
 * Busca o ranking de uma sala específica (top 10 da sala)
 * @param {number} salaId - ID da sala
 * @param {number} limit - Limite de resultados (padrão: 10)
 */
export async function getSalaRanking(salaId, limit = 10) {
  try {
    const { data, error } = await supa
      .from('ranking')
      .select(`
        jogador_id,
        pontuacao_total,
        vencedor,
        data_partida,
        jogador:jogador_id (
          jogador_id,
          nome_de_usuario
        )
      `)
      .eq('sala_id', salaId)
      .order('pontuacao_total', { ascending: false })
      .limit(limit)

    if (error) throw error

    const ranking = (data || []).map((record, index) => ({
      posicao: index + 1,
      jogador_id: record.jogador_id,
      nome_de_usuario: record.jogador?.nome_de_usuario || `Jogador ${record.jogador_id}`,
      pontuacao_total: record.pontuacao_total || 0,
      vencedor: record.vencedor || false,
      data_partida: record.data_partida
    }))

    return ranking
  } catch (error) {
    console.error(`[getSalaRanking] Erro ao buscar ranking da sala ${salaId}:`, error)
    throw error
  }
}

/**
 * Busca a posição de um jogador específico no ranking global
 * @param {number} jogadorId - ID do jogador
 */
export async function getPlayerGlobalPosition(jogadorId) {
  try {
    const ranking = await getGlobalRanking(1000) // Busca muitos para encontrar a posição
    const position = ranking.findIndex(r => r.jogador_id === jogadorId)
    return position >= 0 ? position + 1 : null
  } catch (error) {
    console.error(`[getPlayerGlobalPosition] Erro ao buscar posição do jogador ${jogadorId}:`, error)
    return null
  }
}


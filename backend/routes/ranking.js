// backend/routes/ranking.js
import { Router } from 'express'
import { getGlobalRanking, getSalaRanking, getPlayerGlobalPosition } from '../services/ranking.js'

const router = Router()

/**
 * GET /ranking/global
 * Retorna o top 10 (ou limit) jogadores do ranking global
 * Query params: ?limit=10 (opcional)
 */
router.get('/global', async (req, res) => {
  try {
    const limit = Number(req.query.limit || 10)
    const ranking = await getGlobalRanking(limit)
    res.json({ ranking, count: ranking.length })
  } catch (error) {
    console.error('[GET /ranking/global] Erro:', error)
    res.status(500).json({ error: error.message || 'Erro ao buscar ranking global' })
  }
})

/**
 * GET /ranking/sala/:salaId
 * Retorna o top 10 (ou limit) jogadores de uma sala específica
 * Query params: ?limit=10 (opcional)
 */
router.get('/sala/:salaId', async (req, res) => {
  try {
    const salaId = Number(req.params.salaId)
    if (!salaId) {
      return res.status(400).json({ error: 'salaId inválido' })
    }

    const limit = Number(req.query.limit || 10)
    const ranking = await getSalaRanking(salaId, limit)
    res.json({ ranking, salaId, count: ranking.length })
  } catch (error) {
    console.error(`[GET /ranking/sala/${req.params.salaId}] Erro:`, error)
    res.status(500).json({ error: error.message || 'Erro ao buscar ranking da sala' })
  }
})

/**
 * GET /ranking/player/:jogadorId
 * Retorna a posição de um jogador específico no ranking global
 */
router.get('/player/:jogadorId', async (req, res) => {
  try {
    const jogadorId = Number(req.params.jogadorId)
    if (!jogadorId) {
      return res.status(400).json({ error: 'jogadorId inválido' })
    }

    const position = await getPlayerGlobalPosition(jogadorId)
    res.json({ jogadorId, posicao: position })
  } catch (error) {
    console.error(`[GET /ranking/player/${req.params.jogadorId}] Erro:`, error)
    res.status(500).json({ error: error.message || 'Erro ao buscar posição do jogador' })
  }
})

export default router


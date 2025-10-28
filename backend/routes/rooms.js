// routes/rooms.js
import { Router } from 'express'
import { supa } from '../services/supabase.js'
import { requireAuth } from '../middlewares/requireAuth.js'

const router = Router()

// Criar sala — usa jogador autenticado
router.post('/', requireAuth, async (req, res) => {
  try {
    const jogador_id = req.user.jogador_id
    const { nome_sala = 'Sala' } = req.body

    const { data: sala, error } = await supa.from('sala')
      .insert({ jogador_criador_id: jogador_id, nome_sala, status: 'waiting' })
      .select('*').single()
    if (error) throw error

    await supa.from('jogador_sala').insert({ jogador_id, sala_id: sala.sala_id })

    res.json({ sala_id: sala.sala_id, host_user: jogador_id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Entrar sala — usa jogador autenticado
router.post('/join', requireAuth, async (req, res) => {
  try {
    const jogador_id = req.user.jogador_id
    const { sala_id } = req.body
    if (!sala_id) return res.status(400).json({ error: 'sala_id required' })

    await supa.from('jogador_sala').insert({ jogador_id, sala_id })
    await supa.from('sala').update({ status: 'ready' }).eq('sala_id', sala_id)

    res.json({ sala_id, guest_user: jogador_id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router

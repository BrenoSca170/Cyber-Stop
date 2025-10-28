// backend/routes/matches.js
import { Router } from 'express'
import { supa } from '../services/supabase.js'
import { getIO, scheduleRoundCountdown } from '../src/sockets.js'
import { pickLettersNoRepeat, buildRoundPayload } from '../services/game.js'

const router = Router()

// helper: garante tempo_id para uma duração
async function ensureTempoId(durationSeconds) {
  let { data, error } = await supa
    .from('tempo')
    .select('tempo_id, valor')
    .eq('valor', durationSeconds)
    .maybeSingle()
  if (error) throw error
  if (data) return data.tempo_id

  const ins = await supa
    .from('tempo')
    .insert({ valor: durationSeconds })
    .select('tempo_id')
    .maybeSingle()
  if (ins.error) throw ins.error
  return ins.data.tempo_id
}

// helper: letra_id por caractere
async function getLetraIdByChar(ch) {
  const q = await supa
    .from('letra')
    .select('letra_id, letra_caractere')
    .eq('letra_caractere', ch)
    .maybeSingle()
  if (q.error) throw q.error
  if (!q.data) throw new Error(`Letra '${ch}' não encontrada na tabela letra`)
  return q.data.letra_id
}

router.post('/start', async (req, res) => {
  try {
    const sala_id = Number(req.body.sala_id)
    if (!sala_id) throw new Error('sala_id é obrigatório')

    const ROUNDS = Number(req.body.rounds || 5)
    const DURATION = Number(req.body.duration || 20)

    // se já existem rodadas prontas/andando, reutiliza
    const qExisting = await supa
      .from('rodada')
      .select('rodada_id, numero_da_rodada, status')
      .eq('sala_id', sala_id)
      .in('status', ['ready','in_progress'])
      .order('numero_da_rodada', { ascending: true })
    if (qExisting.error) throw qExisting.error

    if ((qExisting.data || []).length > 0) {
      const first = qExisting.data[0]
      const io = getIO()
      if (io) {
        const payload = await buildRoundPayload(first.rodada_id)
        // marca como in_progress antes de começar
        await supa.from('rodada').update({ status: 'in_progress' }).eq('rodada_id', payload.rodada_id)
        io.to(String(sala_id)).emit('round:ready', payload)
        io.to(String(sala_id)).emit('round:started', { roundId: payload.rodada_id, duration: DURATION })
        scheduleRoundCountdown({ salaId: sala_id, roundId: payload.rodada_id, duration: DURATION })
      }
      return res.json({ ok: true, reused: true })
    }

    // precisa de pelo menos 2 jogadores vinculados
    const qPlayersJS = await supa.from('jogador_sala').select('jogador_id').eq('sala_id', sala_id)
    const qPlayersPS = await supa.from('participante_sala').select('jogador_id').eq('sala_id', sala_id)
    const ids = [
      ...(qPlayersJS.data || []).map(r => Number(r.jogador_id)),
      ...(qPlayersPS.data || []).map(r => Number(r.jogador_id)),
    ]
    const unique = [...new Set(ids)].filter(Boolean)
    if (unique.length < 2) {
      return res.status(400).json({ error: 'A sala precisa ter exatamente 2 jogadores antes de iniciar a partida.' })
    }

    const tempo_id = await ensureTempoId(DURATION)

    const { data: allTemas, error: tErr } = await supa.from('tema').select('tema_id, tema_nome')
    if (tErr) throw tErr
    if (!allTemas || allTemas.length < 4) throw new Error('Necessário >= 4 temas cadastrados')

    // letras sem repetição
    const letras = pickLettersNoRepeat({ total: ROUNDS })
    const created = []

    for (let i = 0; i < ROUNDS; i++) {
      const letraChar = letras[i]
      const letra_id = await getLetraIdByChar(letraChar)

      const ins = await supa.from('rodada').insert({
        sala_id,
        numero_da_rodada: i + 1,
        letra_id,
        tempo_id,
        status: 'ready'
      }).select('rodada_id').maybeSingle()
      if (ins.error) throw ins.error
      const rodada_id = ins.data.rodada_id

      const shuffled = [...allTemas].sort(() => Math.random() - 0.5)
      const chosen = shuffled.slice(0, 4)

      const payloadTema = chosen.map(t => ({ rodada_id, tema_id: t.tema_id }))
      const insTema = await supa.from('rodada_tema').insert(payloadTema)
      if (insTema.error) throw insTema.error

      created.push({
        rodada_id,
        sala_id,
        letra: letraChar,
        temas: chosen.map(t => ({ id: t.tema_id, nome: t.tema_nome }))
      })
    }

    const io = getIO()
    if (io && created.length) {
      // marca primeira como in_progress
      await supa.from('rodada').update({ status: 'in_progress' }).eq('rodada_id', created[0].rodada_id)

      io.to(String(sala_id)).emit('round:ready', created[0])
      io.to(String(sala_id)).emit('round:started', { roundId: created[0].rodada_id, duration: DURATION })
      scheduleRoundCountdown({ salaId: sala_id, roundId: created[0].rodada_id, duration: DURATION })
    }

    return res.json({ ok: true, rounds: created })
  } catch (e) {
    console.error('/matches/start failed', e)
    res.status(500).json({ error: e.message })
  }
})

export default router

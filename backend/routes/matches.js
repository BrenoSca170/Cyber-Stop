// backend/routes/matches.js
import { Router } from 'express';
import { supa } from '../services/supabase.js';
import { getIO, scheduleRoundCountdown, getTimeLeftForSala } from '../src/sockets.js';
import { buildRoundPayload, generateCoherentRounds } from '../services/game.js';
import requireAuth from '../middlewares/requireAuth.js';

const router = Router();

// Rota para buscar rodada atual sem reiniciar timer (usado quando alguém recarrega)
router.get('/current/:salaId', requireAuth, async (req, res) => {
  try {
    const sala_id = Number(req.params.salaId);
    if (!sala_id) throw new Error('sala_id é obrigatório');

    // Busca rodada atual em andamento
    const qCurrent = await supa
      .from('rodada')
      .select('rodada_id, numero_da_rodada, status, tempo:tempo_id(valor)')
      .eq('sala_id', sala_id)
      .eq('status', 'in_progress')
      .order('numero_da_rodada', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (qCurrent.error) throw qCurrent.error;

    if (!qCurrent.data) {
      // Não há rodada em andamento
      return res.json({ ok: true, hasActiveRound: false });
    }

    const io = getIO();
    if (io) {
      const payload = await buildRoundPayload(qCurrent.data.rodada_id);
      const duration = qCurrent.data.tempo?.valor || 20;
      const timeLeft = getTimeLeftForSala(sala_id, duration);
      
      console.log(`[MATCHES/CURRENT] Enviando rodada atual ${qCurrent.data.rodada_id} para sala ${sala_id} (timeLeft: ${timeLeft}s)`);
      
      // Emite apenas para o socket que solicitou (não para toda a sala)
      // Mas como não temos o socket aqui, vamos emitir para a sala mesmo
      // O importante é que não reinicia o timer
      io.to(String(sala_id)).emit('round:ready', payload);
      io.to(String(sala_id)).emit('round:started', { 
        roundId: payload.rodada_id, 
        duration: duration, 
        timeLeft: timeLeft 
      });
    }

    return res.json({ ok: true, hasActiveRound: true, roundId: qCurrent.data.rodada_id });
  } catch (e) {
    console.error('/matches/current failed', e);
    res.status(500).json({ error: e.message });
  }
});

// helper: garante tempo_id para uma duração
async function ensureTempoId(durationSeconds) {
  let { data, error } = await supa
    .from('tempo')
    .select('tempo_id, valor')
    .eq('valor', durationSeconds)
    .maybeSingle();
  if (error) throw error;
  if (data) return data.tempo_id;

  const ins = await supa
    .from('tempo')
    .insert({ valor: durationSeconds })
    .select('tempo_id')
    .maybeSingle();
  if (ins.error) throw ins.error;
  return ins.data.tempo_id;
}

export default router;
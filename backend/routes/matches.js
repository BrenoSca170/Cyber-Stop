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

router.post('/start', requireAuth, async (req, res) => {
  try {
    const sala_id = Number(req.body.sala_id);
    if (!sala_id) throw new Error('sala_id é obrigatório');

    const ROUNDS = Number(req.body.rounds || 5);
    const DURATION = Number(req.body.duration || 20);

    // 1) Reutiliza rodadas existentes (ready/in_progress) se houver
    const qExisting = await supa
      .from('rodada')
      .select('rodada_id, numero_da_rodada, status')
      .eq('sala_id', sala_id)
      .not('status', 'eq', 'done') // ignora partidas já encerradas
      .order('numero_da_rodada', { ascending: true });

    if (qExisting.error) throw qExisting.error;

    if ((qExisting.data || []).length > 0) {
      const first = qExisting.data[0];
      
      // Se a rodada já está em andamento, NÃO reinicia o timer, apenas emite os eventos
      if (first.status === 'in_progress') {
        const io = getIO();
        if (io) {
          const payload = await buildRoundPayload(first.rodada_id);
          const qTempo = await supa.from('rodada').select('tempo:tempo_id(valor)').eq('rodada_id', first.rodada_id).single();
          const duration = qTempo.data?.tempo?.valor || DURATION;
          const timeLeft = getTimeLeftForSala(sala_id, duration);
          
          console.log(`[MATCHES/START] Rodada ${first.rodada_id} já está em andamento. Emitindo eventos sem reiniciar timer (timeLeft: ${timeLeft}s)`);
          
          // Emite eventos sem reiniciar o timer
          setTimeout(() => {
            io.to(String(sala_id)).emit('round:ready', payload);
            io.to(String(sala_id)).emit('round:started', { roundId: payload.rodada_id, duration: duration, timeLeft: timeLeft });
          }, 100);
          
          setTimeout(() => {
            const currentTimeLeft = getTimeLeftForSala(sala_id, duration);
            io.to(String(sala_id)).emit('round:ready', payload);
            io.to(String(sala_id)).emit('round:started', { roundId: payload.rodada_id, duration: duration, timeLeft: currentTimeLeft });
          }, 500);
        }
        return res.json({ ok: true, reused: true, alreadyInProgress: true });
      }
      
      // Se a rodada está 'ready', inicia normalmente
      const io = getIO();
      if (io) {
        const payload = await buildRoundPayload(first.rodada_id);

        // ATUALIZA O STATUS DA SALA ANTES DE INICIAR A RODADA
        const { error: updateSalaError } = await supa
          .from('sala')
          .update({ status: 'in_progress' })
          .eq('sala_id', sala_id);
        if (updateSalaError) {
            console.error(`Erro ao atualizar status da sala ${sala_id} para in_progress:`, updateSalaError);
        }

        // marca como in_progress antes de começar
        await supa
          .from('rodada')
          .update({ status: 'in_progress' })
          .eq('rodada_id', payload.rodada_id);

        // Emite eventos múltiplas vezes com delays maiores para garantir que todos os sockets estejam na sala
        setTimeout(() => {
          const timeLeft = getTimeLeftForSala(sala_id, DURATION);
          console.log(`[MATCHES/START] Emitindo round:ready e round:started para sala ${sala_id} (reuso - tentativa 1, timeLeft: ${timeLeft}s)`);
          io.to(String(sala_id)).emit('round:ready', payload);
          io.to(String(sala_id)).emit('round:started', { roundId: payload.rodada_id, duration: DURATION, timeLeft: timeLeft });
        }, 500);
        
        setTimeout(() => {
          const timeLeft = getTimeLeftForSala(sala_id, DURATION);
          console.log(`[MATCHES/START] Emitindo round:ready e round:started para sala ${sala_id} (reuso - tentativa 2, timeLeft: ${timeLeft}s)`);
          io.to(String(sala_id)).emit('round:ready', payload);
          io.to(String(sala_id)).emit('round:started', { roundId: payload.rodada_id, duration: DURATION, timeLeft: timeLeft });
        }, 1000);
        
        setTimeout(() => {
          const timeLeft = getTimeLeftForSala(sala_id, DURATION);
          console.log(`[MATCHES/START] Emitindo round:ready e round:started para sala ${sala_id} (reuso - tentativa 3 - fallback, timeLeft: ${timeLeft}s)`);
          io.to(String(sala_id)).emit('round:ready', payload);
          io.to(String(sala_id)).emit('round:started', { roundId: payload.rodada_id, duration: DURATION, timeLeft: timeLeft });
        }, 2000);
        
        scheduleRoundCountdown({ salaId: sala_id, roundId: payload.rodada_id, duration: DURATION });
      }
      return res.json({ ok: true, reused: true });
    }

    // 2) Precisa de pelo menos 2 jogadores na sala
    const qPlayersJS = await supa.from('jogador_sala').select('jogador_id').eq('sala_id', sala_id);

    const ids = (qPlayersJS.data || []).map(r => Number(r.jogador_id));
    const unique = [...new Set(ids)].filter(Boolean);

    if (unique.length < 2) {
      return res.status(400).json({ error: 'A sala precisa ter exatamente 2 jogadores para iniciar a partida.' });
    }
    if (unique.length > 2) {
      return res.status(400).json({ error: 'A sala tem mais jogadores do que o permitido. Máximo de 2 jogadores.' });
    }

    // 3) Tempo configurado para as rodadas
    const tempo_id = await ensureTempoId(DURATION);

    // 4) NOVO SORTEIO COERENTE (letra com ≥4 temas; 4 temas com palavras)
    const roundsInfo = await generateCoherentRounds({ totalRounds: ROUNDS });

    console.log('[SORTEIO_COERENTE]', {
    sala_id,
    rounds: roundsInfo.map((r, i) => ({
      n: i + 1,
      letra_id: r.letra_id,
      letra: r.letra_char,
      temas: r.temas.map(t => `${t.tema_id}:${t.tema_nome}`)
      }))
    });

    // 5) Persistir rodadas e temas sorteados
    const created = [];
    for (let i = 0; i < Math.min(roundsInfo.length, ROUNDS); i++) {
      const { letra_id, letra_char, temas } = roundsInfo[i];

      const ins = await supa
        .from('rodada')
        .insert({
          sala_id,
          numero_da_rodada: i + 1,
          letra_id,
          tempo_id,
          status: 'ready'
        })
        .select('rodada_id')
        .maybeSingle();
      if (ins.error) throw ins.error;
      const rodada_id = ins.data.rodada_id;

      // vincula temas
      const payloadTema = temas.map(t => ({
        rodada_id,
        tema_id: t.tema_id
      }));
      const insTema = await supa.from('rodada_tema').insert(payloadTema);
      if (insTema.error) throw insTema.error;

      created.push({
        rodada_id,
        sala_id,
        letra: letra_char,
        temas: temas.map(t => ({ id: t.tema_id, nome: t.tema_nome }))
      });
    }

    // 6) Dispara primeira rodada via Socket.IO
    const io = getIO();
    if (io && created.length) {
      // ATUALIZA O STATUS DA SALA ANTES DE INICIAR A RODADA
      const { error: updateSalaError } = await supa
        .from('sala')
        .update({ status: 'in_progress' }) // Ou o status que indica jogo ativo
        .eq('sala_id', sala_id);
      if (updateSalaError) {
          console.error(`Erro ao atualizar status da sala ${sala_id} para in_progress:`, updateSalaError);
          // Considerar se deve retornar erro ou continuar
      }

      // Atualiza status da RODADA
      await supa
        .from('rodada')
        .update({ status: 'in_progress' })
        .eq('rodada_id', created[0].rodada_id);

      // Emite eventos múltiplas vezes com delays maiores para garantir que todos os sockets estejam na sala
      // Importa a função para calcular tempo restante
      const { getTimeLeftForSala } = await import('../src/sockets.js');
      
      // Primeira emissão após 500ms
      setTimeout(() => {
        const timeLeft = getTimeLeftForSala(sala_id, DURATION);
        console.log(`[MATCHES/START] Emitindo round:ready e round:started para sala ${sala_id} (tentativa 1, timeLeft: ${timeLeft}s)`);
        io.to(String(sala_id)).emit('round:ready', created[0]);
        io.to(String(sala_id)).emit('round:started', { roundId: created[0].rodada_id, duration: DURATION, timeLeft: timeLeft });
      }, 500);
      
      // Segunda emissão após 1s
      setTimeout(() => {
        const timeLeft = getTimeLeftForSala(sala_id, DURATION);
        console.log(`[MATCHES/START] Emitindo round:ready e round:started para sala ${sala_id} (tentativa 2, timeLeft: ${timeLeft}s)`);
        io.to(String(sala_id)).emit('round:ready', created[0]);
        io.to(String(sala_id)).emit('round:started', { roundId: created[0].rodada_id, duration: DURATION, timeLeft: timeLeft });
      }, 1000);
      
      // Terceira emissão após 2s (fallback)
      setTimeout(() => {
        const timeLeft = getTimeLeftForSala(sala_id, DURATION);
        console.log(`[MATCHES/START] Emitindo round:ready e round:started para sala ${sala_id} (tentativa 3 - fallback, timeLeft: ${timeLeft}s)`);
        io.to(String(sala_id)).emit('round:ready', created[0]);
        io.to(String(sala_id)).emit('round:started', { roundId: created[0].rodada_id, duration: DURATION, timeLeft: timeLeft });
      }, 2000);
      
      scheduleRoundCountdown({ salaId: sala_id, roundId: created[0].rodada_id, duration: DURATION });
    }

    return res.json({ ok: true, rounds: created });
  } catch (e) {
    console.error('/matches/start failed', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
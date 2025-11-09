// backend/routes/matches.js
import express from 'express'
import { supa } from '../services/supabase.js'
import requireAuth from '../middlewares/requireAuth.js'
// (NOVO) Importar getIO e a nova função
import { getIO } from '../src/sockets.js'
import { prepararRodada } from '../services/game.js'

const router = express.Router()

// Rota para iniciar uma partida (mudar status da sala, carregar 1ª rodada)
router.post('/start', requireAuth, async (req, res) => {
  const { sala_id } = req.body
  const jogadorId = req.jogadorId

  if (!sala_id) {
    return res.status(400).json({ error: 'ID da sala é obrigatório' })
  }

  try {
    // 1. Verifica se o usuário é o criador da sala
    const { data: salaData, error: salaError } = await supa
      .from('sala')
      .select('jogador_criador_id, status')
      .eq('sala_id', sala_id)
      .single()

    if (salaError) throw salaError
    if (!salaData) {
      return res.status(404).json({ error: 'Sala não encontrada' })
    }
    if (salaData.jogador_criador_id !== jogadorId) {
      return res.status(403).json({ error: 'Apenas o criador pode iniciar a partida' })
    }
    if (salaData.status !== 'open') {
      return res.status(400).json({ error: 'Esta partida não está aberta ou já foi iniciada' })
    }

    // 2. Busca a *primeira* rodada da sala
    const { data: firstRound, error: roundError } = await supa
      .from('rodada')
      .select('rodada_id, tempo:tempo_id(valor), letra:letra_id(letra_caractere), rodada_tema(tema:tema_id(tema_id, tema_nome))')
      .eq('sala_id', sala_id)
      .order('numero_da_rodada', { ascending: true })
      .limit(1)
      .maybeSingle()
      
    if (roundError) throw roundError
    if (!firstRound) {
        return res.status(500).json({ error: 'Nenhuma rodada encontrada para esta sala' })
    }

    // 3. (NOVO) CHAMA A FUNÇÃO DE PREPARAÇÃO DA RODADA
    // Isso popula jogador_sala_rodada e participacao_rodada_tema
    try {
        await prepararRodada(firstRound.rodada_id, sala_id);
    } catch (err) {
        console.error(`[API /start] Falha ao preparar a primeira rodada:`, err);
        return res.status(500).json({ error: 'Falha ao preparar a partida. Tente novamente.' });
    }

    // 4. Atualiza o status da sala para 'playing'
    const { error: updateError } = await supa
      .from('sala')
      .update({ status: 'playing' })
      .eq('sala_id', sala_id)

    if (updateError) throw updateError

    // 5. Formata o payload da primeira rodada para o frontend
    const payload = {
        rodada_id: firstRound.rodada_id,
        letra: firstRound.letra.letra_caractere,
        temas: firstRound.rodada_tema.map(rt => ({
            id: rt.tema.tema_id,
            nome: rt.tema.tema_nome
        })),
        duration: firstRound.tempo.valor || 20
    }

    // 6. Emite o evento para a sala via Socket.IO
    const io = getIO() // Pega a instância do IO
    if (io) {
      const salaIdStr = String(sala_id)
      console.log(`[API /start] Emitindo 'round:ready' e 'round:started' para sala ${salaIdStr}`);
      // Emite 'round:ready' (para carregar dados)
      io.to(salaIdStr).emit('round:ready', payload)
      // Emite 'round:started' (para iniciar timer) - *scheduleRoundCountdown* será chamado pelo frontend
      // Mas vamos chamar o scheduleRoundCountdown aqui também para garantir
      io.to(salaIdStr).emit('round:started', { roundId: payload.rodada_id, duration: payload.duration });
      
      // (REMOVIDO - Deixar o 'round:started' do 'useGameSocket' no frontend cuidar disso)
      // scheduleRoundCountdown({ salaId: salaIdStr, roundId: payload.rodada_id, duration: payload.duration });
    }

    res.status(200).json({ message: 'Partida iniciada com sucesso', firstRound: payload })

  } catch (error) {
    console.error('Erro ao iniciar partida:', error.message)
    res.status(500).json({ error: error.message || 'Erro interno do servidor' })
  }
})

export default router
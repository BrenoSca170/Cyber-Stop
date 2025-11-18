// backend/src/sockets.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { supa } from '../services/supabase.js'; //
import { endRoundAndScore, getNextRoundForSala, getJogadoresDaSala, getRoundResults, buildRoundPayload, generateCoherentRounds } from '../services/game.js'; //
import { saveRanking } from '../services/ranking.js'; //

const JWT_SECRET = process.env.JWT_SECRET || 'developer_secret_key'; //

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

const sleep = (ms) => new Promise(r => setTimeout(r, ms)); //
const GRACE_MS = 3000; //

const MOEDAS_VITORIA = 50; //
const MOEDAS_EMPATE = 25; //
const MOEDAS_PARTICIPACAO = 5; //

let io; //



// ===== Armazenamento para palavras puladas (SKIP_WORD) =====
// Formato: Map<salaId, Map<roundId, Set<string>>> onde string = "jogadorId-temaNome"
const skippedWords = new Map(); //

function addSkippedWord(salaId, roundId, jogadorId, temaNome) { //
    const key = `${salaId}-${roundId}`; //
    if (!skippedWords.has(key)) { //
        skippedWords.set(key, new Set()); //
    }
    skippedWords.get(key).add(`${jogadorId}-${temaNome}`); //
    console.log(`[SKIP_WORD] Jogador ${jogadorId} pulou palavra ${temaNome} na rodada ${roundId}`); //
}

function getSkippedWords(salaId, roundId) { //
    const key = `${salaId}-${roundId}`; //
    const words = skippedWords.get(key); //
    return words || new Set(); //
}

function clearSkippedWords(salaId, roundId) { //
    const key = `${salaId}-${roundId}`; //
    skippedWords.delete(key); //
}

function isWordSkipped(salaId, roundId, jogadorId, temaNome) { //
    const key = `${salaId}-${roundId}`; //
    const words = skippedWords.get(key); //
    if (!words) return false; //
    return words.has(`${jogadorId}-${temaNome}`); //
}
// ======================================================================

// ===== Armazenamento para palavras desconsideradas do oponente (DISREGARD_OPPONENT_WORD) =====
// Formato: Map<salaId, Map<roundId, Set<string>>> onde string = "jogadorId-temaNome"
// Diferente de SKIP_WORD, aqui o jogador NÃO ganha pontos pela palavra desconsiderada
const disregardedOpponentWords = new Map(); //

function addDisregardedOpponentWord(salaId, roundId, targetJogadorId, temaNome) { //
    const key = `${salaId}-${roundId}`; //
    if (!disregardedOpponentWords.has(key)) { //
        disregardedOpponentWords.set(key, new Set()); //
    }
    disregardedOpponentWords.get(key).add(`${targetJogadorId}-${temaNome}`); //
    console.log(`[DISREGARD_OPPONENT_WORD] Palavra "${temaNome}" do jogador ${targetJogadorId} foi desconsiderada na rodada ${roundId}`); //
}

function getDisregardedOpponentWords(salaId, roundId) { //
    const key = `${salaId}-${roundId}`; //
    const words = disregardedOpponentWords.get(key); //
    return words || new Set(); //
}

function clearDisregardedOpponentWords(salaId, roundId) { //
    const key = `${salaId}-${roundId}`; //
    disregardedOpponentWords.delete(key); //
}

function isOpponentWordDisregarded(salaId, roundId, jogadorId, temaNome) { //
    const key = `${salaId}-${roundId}`; //
    const words = disregardedOpponentWords.get(key); //
    if (!words) return false; //
    return words.has(`${jogadorId}-${temaNome}`); //
}
// ======================================================================

// Map para guardar informações dos timers ativos por sala
const roomTimers = new Map(); //

// Função para limpar/cancelar um timer existente para uma sala
function clearTimerForSala(salaId) {
    salaId = String(salaId); //
    if (roomTimers.has(salaId)) {
        const { interval } = roomTimers.get(salaId); //
        clearInterval(interval); //
        roomTimers.delete(salaId); //
        console.log(`[TIMER] Timer for sala ${salaId} cleared.`);
    }
}

// Função para calcular o tempo restante de uma rodada em andamento
export function getTimeLeftForSala(salaId, defaultDuration = 20) {
    salaId = String(salaId); //
    const timer = roomTimers.get(salaId); //
    if (timer && timer.endsAt) {
        const now = Date.now(); //
        const left = Math.max(0, Math.ceil((timer.endsAt - now) / 1000)); //
        console.log(`[TIMER] Tempo restante calculado para sala ${salaId}: ${left}s`);
        return left; //
    }
    // Se não há timer ativo, retorna a duração padrão (rodada ainda não começou)
    return defaultDuration; //
}

// Set para guardar rodadas já pontuadas (evitar pontuação dupla)
const scoredRounds = new Set(); //

// Função para verificar se uma rodada já foi pontuada
function alreadyScored(salaId, roundId) {
    const key = `${salaId}-${roundId}`; //
    if (scoredRounds.has(key)) { //
        console.warn(`[SCORE CHECK] Rodada ${roundId} da sala ${salaId} já foi pontuada.`);
        return true; //
    }
    scoredRounds.add(key); // Marca como pontuada
     // Limpa a marcação após um tempo para permitir jogar novamente (se aplicável)
    setTimeout(() => scoredRounds.delete(key), 5 * 60 * 1000); // Limpa após 5 minutos
    return false; //
}

// Função para adicionar moedas a um jogador
// Moedas são armazenadas na tabela 'inventario' com item_id: 11 (item MOEDA)
async function adicionarMoedas(jogadorId, quantidade) {
    if (!jogadorId || quantidade <= 0) return;
    try {
      console.log(`[MOEDAS] Adicionando ${quantidade} moedas para jogador ${jogadorId}...`);

      // Primeiro, tenta buscar o saldo atual de moedas
      const { data: inventarioAtual, error: selectError } = await supa
        .from('inventario')
        .select('qtde')
        .eq('jogador_id', jogadorId)
        .eq('item_id', 11)
        .single();

      if (selectError && selectError.code !== 'PGRST116') throw selectError; // PGRST116 = não encontrado

      // Calcula o novo saldo (se não existe, começa com 0)
      const saldoAtual = inventarioAtual?.qtde || 0;
      const novoSaldo = saldoAtual + quantidade;

      // Agora faz o upsert com o novo saldo
      const { error: upsertError } = await supa
        .from('inventario')
        .upsert({
          jogador_id: jogadorId,
          item_id: 11, // item_id da MOEDA
          qtde: novoSaldo,
          data_hora_ultima_atualizacao: new Date().toISOString()
        }, {
          onConflict: 'jogador_id,item_id'
        });

      if (upsertError) throw upsertError;
      console.log(`[MOEDAS] ${quantidade} moedas adicionadas para jogador ${jogadorId}. Novo saldo: ${novoSaldo}`);

      // Opcional: Notificar o jogador sobre o ganho de moedas via socket
      // const socketId = await getSocketIdByPlayerId(jogadorId);
      // if (socketId) io.to(socketId).emit('player:coins_updated', { novo_saldo: novoSaldo });

    } catch(e) {
        console.error(`[MOEDAS] Erro ao adicionar ${quantidade} moedas para jogador ${jogadorId}:`, e.message);
    }
}

// Função auxiliar para obter ID de socket por jogador_id
async function getSocketIdByPlayerId(targetPlayerId) { //
    if (!io) return null; // Garante que io existe
    const sockets = await io.fetchSockets(); //
    for (const socket of sockets) { //
        // Comparar como números para evitar problemas de tipo
        if (Number(socket.data.jogador_id) === Number(targetPlayerId)) { //
            return socket.id; //
        }
    }
    return null; //
}


export function scheduleRoundCountdown({ salaId, roundId, duration = 20 }) { //
  salaId = String(salaId); //
  roundId = Number(roundId); //
  // Limpa timer anterior ANTES de setar novo
  clearTimerForSala(salaId); //
  console.log(`[TIMER] Scheduling countdown for sala ${salaId}, round ${roundId}, duration ${duration}s`);
  console.log(`[TIMER-SCHED] endsAt will be ${new Date(Date.now() + duration * 1000).toISOString()}`);

  const endsAt = Date.now() + duration * 1000; //
  const interval = setInterval(async () => { //
    // Verifica se este timer ainda é o ativo para esta sala/rodada
    const currentTimer = roomTimers.get(salaId);
    if (!currentTimer || currentTimer.roundId !== roundId || currentTimer.interval !== interval) {
        console.warn(`[TIMER] Stale timer detected for sala ${salaId}, round ${roundId}. Clearing.`);
        clearInterval(interval);
        return;
    }

    const now = Date.now(); //
    const left = Math.max(0, Math.ceil((endsAt - now) / 1000)); //

    console.log(`[TIMER-TICK] sala=${salaId} round=${roundId} timeLeft=${left}s endsAt=${new Date(endsAt).toISOString()}`);
    io.to(salaId).emit('round:tick', left); //

    if (left <= 0) { //
      // Limpa o timer ANTES de processar o fim da rodada
      clearTimerForSala(salaId); //
      try {
        // Verifica se já foi pontuado (importante por causa do sleep)
        if (alreadyScored(salaId, roundId)) { return; } //

        console.log(`[TIMER->STOP] sala=${salaId} round=${roundId}`); //
        io.to(salaId).emit('round:stopping', { roundId }); //
        await sleep(GRACE_MS); //

        // --- CORREÇÃO APLICADA ---
        // O bloco 'if (scoredRounds.has(...))' que estava aqui foi REMOVIDO.
        // Ele fazia o timer se auto-bloquear.
        // --- FIM DA CORREÇÃO ---

        // *** MODIFICADO PELO PASSO 4: `endRoundAndScore` agora retorna `roundDetails` ***
        const payload = await endRoundAndScore({ 
          salaId, 
          roundId, 
          skippedWordsSet: getSkippedWords(salaId, roundId),
          disregardedOpponentWordsSet: getDisregardedOpponentWords(salaId, roundId)
        }); //

        // Limpa as palavras puladas após pontuar
        clearSkippedWords(salaId, roundId);
        // Limpa as palavras desconsideradas do oponente após pontuar
        clearDisregardedOpponentWords(salaId, roundId);



        // *** O 'payload' agora contém 'roundDetails' ***
        io.to(salaId).emit('round:end', payload); // Emite o resultado NORMALMENTE

        const next = await getNextRoundForSala({ salaId, afterRoundId: roundId }); //
        if (next) { //
            // Aguarda 10 segundos antes de iniciar a próxima rodada
            console.log(`[TIMER->NEXT_ROUND] Aguardando 10 segundos antes de iniciar próxima rodada ${next.rodada_id} para sala ${salaId}`);
            setTimeout(async () => {
                // Verifica se ainda existe próxima rodada (pode ter mudado durante o delay)
                const nextCheck = await getNextRoundForSala({ salaId, afterRoundId: roundId });
                if (!nextCheck || nextCheck.rodada_id !== next.rodada_id) {
                    console.log(`[TIMER->NEXT_ROUND] Próxima rodada mudou durante o delay, abortando.`);
                    return;
                }
                // Código para iniciar a próxima rodada
                console.log(`[TIMER->NEXT_ROUND] Iniciando próxima rodada ${next.rodada_id} para sala ${salaId}`);
                // Atualiza status da próxima rodada para 'in_progress'
                await supa.from('rodada').update({ status: 'in_progress' }).eq('rodada_id', next.rodada_id); //
                // Emite eventos múltiplas vezes para garantir que todos recebam
                setTimeout(() => {
                  const timeLeft = getTimeLeftForSala(salaId, duration);
                  io.to(salaId).emit('round:ready', next); //
                  io.to(salaId).emit('round:started', { roundId: next.rodada_id, duration: duration, timeLeft: timeLeft }); // Usar a mesma duração
                }, 100);
                setTimeout(() => {
                  const timeLeft = getTimeLeftForSala(salaId, duration);
                  io.to(salaId).emit('round:ready', next); //
                  io.to(salaId).emit('round:started', { roundId: next.rodada_id, duration: duration, timeLeft: timeLeft }); // Usar a mesma duração
                }, 500);
                scheduleRoundCountdown({ salaId: salaId, roundId: next.rodada_id, duration: duration }); //
            }, 10000); // Delay de 10 segundos (10000ms)
        } else { //
          // --- LÓGICA DE FIM DE PARTIDA E MOEDAS (TIMER) ---
          const winnerInfo = computeWinner(payload.totais); //
          const todosJogadoresIds = Object.keys(payload.totais || {}).map(Number); //

          // Adicionar Moedas pela participação/vitória/empate
          for (const jId of todosJogadoresIds) {
              let moedasGanhas = MOEDAS_PARTICIPACAO; //
              if (winnerInfo?.empate && winnerInfo.jogadores.includes(jId)) { //
                  moedasGanhas += MOEDAS_EMPATE; //
              } else if (!winnerInfo?.empate && winnerInfo?.jogador_id === jId) { //
                  moedasGanhas += MOEDAS_VITORIA; //
              }
              await adicionarMoedas(jId, moedasGanhas); //
          }

          // ATUALIZA STATUS DA SALA PARA 'terminada'
          console.log(`[TIMER->MATCH_END] Atualizando sala ${salaId} para 'terminada'`);
          const { error: updateSalaError } = await supa
            .from('sala') //
            .update({ status: 'terminada' }) // Novo status
            .eq('sala_id', salaId); //
          if (updateSalaError) {
              console.error(`[TIMER] Erro ao atualizar status da sala ${salaId} para terminada:`, updateSalaError);
          }

          // Salva ranking da partida
          try {
              await saveRanking({ salaId, totais: payload.totais, winnerInfo });
          } catch (rankingError) {
              console.error(`[TIMER->MATCH_END] Erro ao salvar ranking para sala ${salaId}:`, rankingError);
          }

          io.to(salaId).emit('match:end', { //
                totais: payload.totais, // Envia totais
                vencedor: winnerInfo // Envia info do vencedor
          });
          console.log(`[TIMER->MATCH_END] Fim de partida para sala ${salaId}`); // Log de fim de partida
          // ----------------------------------------------------
        }
      } catch (e) {
         console.error(`[TIMER ${salaId} ${roundId}] Error during countdown end:`, e);
         io.to(salaId).emit('app:error', { context: 'timer-end', message: e.message }); //
      }
    }
  }, 1000); //

  // Armazena o timer atual
  roomTimers.set(salaId, { interval, endsAt, roundId }); //
}


export function initSockets(httpServer) { //
  io = new Server(httpServer, { cors: { origin: '*' } }); //

  // Middleware de Autenticação Socket.IO (pega token da handshake)
  io.use((socket, next) => { //
    const token = socket.handshake.auth.token; // Pega token da propriedade 'auth'
    if (!token) { //
      console.warn("Socket connection attempt without token");
      return next(new Error('Authentication error: Token missing'));
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET); //
      // Adiciona jogador_id aos dados do socket para uso posterior
      socket.data.jogador_id = payload.sub; //
      console.log(`Socket authenticated for jogador_id: ${socket.data.jogador_id}`);
      next();
    } catch (err) { //
      console.warn(`Socket connection attempt with invalid token: ${err.message}`);
      return next(new Error('Authentication error: Invalid token')); //
    }
  });

  io.on('connection', (socket) => { //
    console.log('a user connected:', socket.id, 'jogador_id:', socket.data.jogador_id); //

    socket.on('join-room', async (salaId) => { //
        salaId = String(salaId); // Garante que é string

        // Leave all other rooms
        for (const room of socket.rooms) {
            if (room !== socket.id && room !== salaId) {
                socket.leave(room);
                console.log(`Socket ${socket.id} left room ${room}`);
            }
        }

        console.log(`Socket ${socket.id} (jogador ${socket.data.jogador_id}) joining room ${salaId}`);
        socket.join(salaId); //
        // Guarda a sala no socket data para referência futura (ex: disconnect)
        socket.data.salaId = salaId; //
        // Confirma que entrou (opcional)
        socket.emit('joined', { salaId }); //

        // Emit players update
        const io = getIO();
        if (io) {
            try {
                const { data: salaData, error: salaError } = await supa
                    .from('sala')
                    .select(`
                        sala_id, nome_sala, status, jogador_criador_id,
                        jogador:jogador_criador_id ( nome_de_usuario ),
                        temas_excluidos, letras_excluidas
                    `)
                    .eq('sala_id', salaId)
                    .single();

                if (salaError) throw salaError;

                const { data: jogadoresData, error: jogadoresError } = await supa
                    .from('jogador_sala')
                    .select(`
                        jogador:jogador_id (
                            jogador_id,
                            nome_de_usuario,
                            avatar_nome,
                            personagem_nome,
                            ranking (pontuacao_total)
                        )
                    `)
                    .eq('sala_id', salaId);

                if (jogadoresError) throw jogadoresError;

                const jogadoresInfo = (jogadoresData || []).map(js => ({
                    jogador_id: js.jogador.jogador_id,
                    nome_de_usuario: js.jogador.nome_de_usuario,
                    avatar_nome: js.jogador.avatar_nome,
                    personagem_nome: js.jogador.personagem_nome,
                    ranking: js.jogador.ranking?.pontuacao_total,
                    is_creator: js.jogador.jogador_id === salaData.jogador_criador_id
                }));

                const jogadoresNaSala = jogadoresInfo.map(j => j.nome_de_usuario);

                const responseData = {
                    sala_id: salaData.sala_id,
                    nome_sala: salaData.nome_sala,
                    status: salaData.status,
                    jogador_criador_id: salaData.jogador_criador_id,
                    jogador: {
                        jogador_id: salaData.jogador_criador_id,
                        nome_de_usuario: salaData.jogador?.nome_de_usuario || 'Desconhecido'
                    },
                    jogadores: jogadoresNaSala,
                    jogadores_info: jogadoresInfo,
                    temas_excluidos: salaData.temas_excluidos || [],
                    letras_excluidas: salaData.letras_excluidas || []
                };

                io.to(String(salaId)).emit('room:players_updated', responseData);
            } catch (error) {
                console.error(`[join-room] Error emitting players update for sala ${salaId}:`, error);
            }
        }
    });

    socket.on('player:react', ({ salaId, emojiId }) => {
        const fromPlayerId = socket.data.jogador_id;
        if (!salaId || !emojiId || !fromPlayerId) {
            console.warn(`[player:react] Invalid payload: salaId=${salaId}, emojiId=${emojiId}, fromPlayerId=${fromPlayerId}`);
            return;
        }
        io.to(String(salaId)).emit('player:reacted', {
            fromPlayerId,
            emojiId,
        });
    });

    socket.on('player_wants_to_stop', async ({ salaId, roundId }) => {
      salaId = String(salaId || socket.data.salaId);
      roundId = Number(roundId);
      const stoppedBy = socket.data.jogador_id;

      if (!salaId || !roundId) return;

      console.log(`[PLAYER_WANTS_TO_STOP] sala=${salaId} round=${roundId} by=${stoppedBy}`);
      io.to(salaId).emit('show_stop_overlay', { roundId, by: stoppedBy });

      setTimeout(() => {
        socket.emit('round:stop', { salaId, roundId, by: stoppedBy });
      }, 2000);
    });

    socket.on('round:stop', async ({ salaId, roundId, by }) => {
  try {
    salaId = String(salaId || socket.data.salaId);
    roundId = Number(roundId);
    const stoppedBy = by || socket.data.jogador_id;

    if (!salaId || !roundId) return;

    // --- Função auxiliar: o que acontece depois que já temos o payload (placar da rodada) ---
    const processAfterScoring = async (payload, sourceLabel = 'STOP') => {
      // payload: { roundId, roundDetails, totais }

      // 1) Enviar resultado da rodada
      io.to(salaId).emit('round:end', payload);

      // 2) Ver se existe próxima rodada
      const next = await getNextRoundForSala({ salaId, afterRoundId: roundId });

      if (next) {
        console.log(
          `[${sourceLabel}->NEXT_ROUND] Aguardando 10 segundos antes de iniciar próxima rodada ${next.rodada_id} para sala ${salaId}`
        );
        setTimeout(async () => {
          const nextCheck = await getNextRoundForSala({ salaId, afterRoundId: roundId });
          if (!nextCheck || nextCheck.rodada_id !== next.rodada_id) {
            console.log(
              `[${sourceLabel}->NEXT_ROUND] Próxima rodada mudou durante o delay, abortando.`
            );
            return;
          }

          console.log(
            `[${sourceLabel}->NEXT_ROUND] Iniciando próxima rodada ${next.rodada_id} para sala ${salaId}`
          );

          // Marca próxima rodada como em progresso
          await supa.from('rodada').update({ status: 'in_progress' }).eq('rodada_id', next.rodada_id);

          // Busca duração da rodada anterior (ou default)
          const qTempo = await supa
            .from('rodada')
            .select('tempo:tempo_id(valor)')
            .eq('rodada_id', roundId)
            .single();
          const duration = qTempo.data?.tempo?.valor || 20;

          // Emite eventos de início de rodada (duas vezes, como antes)
          setTimeout(() => {
            const timeLeft = getTimeLeftForSala(salaId, duration);
            io.to(salaId).emit('round:ready', next);
            io.to(salaId).emit('round:started', {
              roundId: next.rodada_id,
              duration,
              timeLeft
            });
          }, 100);

          setTimeout(() => {
            const timeLeft = getTimeLeftForSala(salaId, duration);
            io.to(salaId).emit('round:ready', next);
            io.to(salaId).emit('round:started', {
              roundId: next.rodada_id,
              duration,
              timeLeft
            });
          }, 500);

          // Inicia countdown da próxima rodada
          scheduleRoundCountdown({ salaId, roundId: next.rodada_id, duration });
        }, 10000);
      } else {
        // 3) Não há próxima rodada → FIM DE PARTIDA
        const winnerInfo = computeWinner(payload.totais);
        const todosJogadoresIds = Object.keys(payload.totais || {}).map(Number);

        // Distribui moedas
        for (const jId of todosJogadoresIds) {
          let moedasGanhas = MOEDAS_PARTICIPACAO;
          if (winnerInfo?.empate && winnerInfo.jogadores.includes(jId)) {
            moedasGanhas += MOEDAS_EMPATE;
          } else if (!winnerInfo?.empate && winnerInfo?.jogador_id === jId) {
            moedasGanhas += MOEDAS_VITORIA;
          }
          await adicionarMoedas(jId, moedasGanhas);
        }

        console.log(`[${sourceLabel}->MATCH_END] Atualizando sala ${salaId} para 'terminada'`);
        const { error: updateSalaError } = await supa
          .from('sala')
          .update({ status: 'terminada' })
          .eq('sala_id', salaId);
        if (updateSalaError) {
          console.error(
            `[${sourceLabel}] Erro ao atualizar status da sala ${salaId} para terminada:`,
            updateSalaError
          );
        }

        // Salva ranking da partida
        try {
          await saveRanking({ salaId, totais: payload.totais, winnerInfo });
        } catch (rankingError) {
          console.error(`[${sourceLabel}->MATCH_END] Erro ao salvar ranking para sala ${salaId}:`, rankingError);
        }

        // Emite evento de fim de partida
        io.to(salaId).emit('match:end', {
          totais: payload.totais,
          vencedor: winnerInfo
        });
        console.log(`[${sourceLabel}->MATCH_END] Fim de partida para sala ${salaId}`);
      }
    };
    // --- Fim da função auxiliar ---

    

    // 2) STOP "normal": esta chamada é quem realmente vai pontuar
    console.log(`[CLICK STOP] sala=${salaId} round=${roundId} by=${stoppedBy}`);
    io.to(salaId).emit('round:stopping', { roundId, by: stoppedBy });

    // Para o timer para evitar concorrência
    clearTimerForSala(salaId);
    await sleep(GRACE_MS);

    // Se durante o GRACE_MS alguém já pontuou, reaproveita os resultados
    const scoreKey = `${salaId}-${roundId}`;

    // Se DURANTE o GRACE_MS o TIMER ou outro STOP já pontuou essa rodada
    if (scoredRounds.has(scoreKey)) {
      console.warn(
        `[STOP] Rodada ${roundId} já foi pontuada (timer ou outro STOP). Buscando resultados existentes.`
      );
      const payload = await getRoundResults({ salaId, roundId });
      await processAfterScoring(payload, 'STOP');
      return;
    }

    // Se chegou aqui, ESTE STOP é quem vai pontuar primeiro
    scoredRounds.add(scoreKey);
    // Remove a trava depois de 5 minutos, igual ao alreadyScored
    setTimeout(() => scoredRounds.delete(scoreKey), 5 * 60 * 1000);


    // 3) Pontua de fato a rodada
    const payload = await endRoundAndScore({
      salaId,
      roundId,
      skippedWordsSet: getSkippedWords(salaId, roundId),
      disregardedOpponentWordsSet: getDisregardedOpponentWords(salaId, roundId)
    });

    // Limpa SKIPs da rodada
    clearSkippedWords(salaId, roundId);
    clearDisregardedOpponentWords(salaId, roundId);



    // 4) Depois de pontuar + aplicar efeitos, processa próxima rodada / fim da partida
    await processAfterScoring(payload, 'STOP');
  } catch (e) {
    console.error(`[STOP ${salaId} ${roundId}] Error during stop handling:`, e);
    io.to(salaId).emit('app:error', { context: 'stop-handler', message: e.message });
  }
});


    // ==================================================================
    // ===               MANIPULADOR DE USO DE POWER-UP               ===
    // ==================================================================
    socket.on('powerup:use', async ({ powerUpId, targetPlayerId = null, targetTemaNome = null, salaId: salaIdFromClient = null }) => {
    
    // --- INÍCIO DA CORREÇÃO ---
    // 1. Definição das variáveis no escopo correto
    const salaId = socket.data.salaId || salaIdFromClient; // Garante que temos a sala
    const usuarioJogadorId = socket.data.jogador_id;
    
    // 2. Definição de currentRoundId (A CAUSA DO SEU ERRO)
    // Esta linha estava faltando ou no lugar errado no seu arquivo local
    const currentRoundId = roomTimers.get(salaId)?.roundId; 
    // --- FIM DA CORREÇÃO ---


    if (!usuarioJogadorId || !salaId || !powerUpId) {
        socket.emit('powerup:error', { message: 'Faltando parâmetros para usar power-up.' });
        return;
    }
    
    // Agora esta verificação funciona, pois currentRoundId está definido
    if (!currentRoundId) {
        socket.emit('powerup:error', { message: 'Não é possível usar power-ups fora de uma rodada ativa.' });
        return;
    }

    try {
        // --- INÍCIO DA VERIFICAÇÃO/DECREMENTO ---
        // Busca o item na tabela 'inventario' e faz join com 'item' para pegar o código
        const { data: itemInventario, error: checkError } = await supa
            .from('inventario') // Tabela 'inventario'
            .select(`
                inventario_id,  
                qtde,           
                item ( codigo_identificador ) 
            `)
            .eq('jogador_id', usuarioJogadorId)
            .eq('item_id', powerUpId) // 'powerUpId' (do frontend) é o 'item_id' (do DB)
            .maybeSingle(); 

        if (checkError && checkError.code !== 'PGRST116') { throw checkError; }

        if (!itemInventario || itemInventario.qtde <= 0) {
            socket.emit('powerup:error', { message: 'Você não possui este power-up ou quantidade insuficiente.' });
            return;
        }

        const novaQuantidade = itemInventario.qtde - 1;
        const { error: decrementError } = await supa
            .from('inventario') // Tabela 'inventario'
            .update({ qtde: novaQuantidade }) // Coluna 'qtde'
            .eq('inventario_id', itemInventario.inventario_id); // PK correta

        if (decrementError) { throw decrementError; }

        socket.emit('inventory:updated');
        // --- FIM DA VERIFICAÇÃO/DECREMENTO ---

        // Validação de segurança para o 'efeito'
        if (!itemInventario.item || !itemInventario.item.codigo_identificador) {
            console.error(`[powerup:use] Falha crítica: Item ${powerUpId} não tem um 'codigo_identificador' na tabela 'item'.`);
            socket.emit('powerup:error', { message: `Item ${powerUpId} não está configurado corretamente no DB.` });
            return;
        }

        const efeito = itemInventario.item.codigo_identificador; // Caminho do objeto
        // --- FIM DA CORREÇÃO ---

        console.log(`[powerup:use] Sucesso: Jogador ${usuarioJogadorId} usou ${efeito} na sala ${salaId}, rodada ${currentRoundId}`);

        switch (efeito) {
            case 'BLUR_OPPONENT_SCREEN_5S':
            case 'JUMPSCARE':
              const jumpscares = [
                  { gif: '/jumpscarelist/exo.gif', sound: '/jumpscarelist/exo.mp3' },
                  { gif: '/jumpscarelist/foxy.gif', sound: '/jumpscarelist/foxy.mp3' },
                  { gif: '/jumpscarelist/mangle.gif', sound: '/jumpscarelist/mangle.mp3' },
                  { gif: '/jumpscarelist/puppet.gif', sound: '/jumpscarelist/puppet.mp3' }
              ];

              // escolhe 1 jumpscare aleatório
              const random = jumpscares[Math.floor(Math.random() * jumpscares.length)];

              // envia para todos os oponentes (exceto quem usou)
              socket.to(salaId).emit('effect:jumpscare', {
                  attackerId: usuarioJogadorId,
                  image: random.gif,
                  sound: random.sound,
                  duration: 3
              });

              console.log(`[JUMPSCARE-EMITTED] sala=${salaId} round=${currentRoundId} by=${usuarioJogadorId} at time=${new Date().toISOString()}`);
              console.log(`[JUMPSCARE-TIMER-STATE] endsAt=${roomTimers.get(salaId)?.endsAt} roundId=${roomTimers.get(salaId)?.roundId}`);

              // mensagem de sucesso
              socket.emit('powerup:ack', {
                  codigo: efeito,
                  message: 'Jumpscare enviado!'
              });

              break;
            case 'SKIP_OWN_CATEGORY':
                // Se um tema alvo for fornecido, executa o pulo. Senão, apenas ativa o modo.
                if (targetTemaNome) {
                    try {
                        // Valida se o tema é válido para a rodada
                        const { data: temasRodada, error: temasError } = await supa
                            .from('rodada_tema')
                            .select('tema:tema_id(tema_nome)')
                            .eq('rodada_id', currentRoundId);
                        if (temasError) throw temasError;

                        const temasValidos = (temasRodada || []).map(t => t.tema.tema_nome);
                        if (!temasValidos.includes(targetTemaNome)) {
                            socket.emit('powerup:error', { message: 'Tema inválido para esta rodada.' });
                            return;
                        }

                        // Adiciona a palavra à lista de puladas para pontuação posterior
                        addSkippedWord(salaId, currentRoundId, usuarioJogadorId, targetTemaNome);
                        
                        // Confirma o sucesso para o usuário
                        socket.emit('powerup:ack', { 
                            codigo: 'SKIP_OWN_CATEGORY', 
                            message: `Palavra "${targetTemaNome}" foi pulada! Você ganhará pontos automaticamente.` 
                        });
                        
                        console.log(`[SKIP_OWN_CATEGORY] Jogador ${usuarioJogadorId} pulou palavra ${targetTemaNome} na rodada ${currentRoundId}`);

                    } catch (err) {
                        console.error('[SKIP_OWN_CATEGORY] Erro ao pular palavra:', err);
                        socket.emit('powerup:error', { message: 'Erro ao pular palavra.' });
                    }
                } else {
                    // Apenas ativa o modo de pulo no frontend
                    socket.emit('effect:enable_skip', { powerUpId: powerUpId });
                }
                break;

            case 'BLOCK_OPPONENT_TYPE_5S':
                try {
                    const todosJogadores = await getJogadoresDaSala(salaId);
                    const oponentesIds = todosJogadores.filter(id => id !== usuarioJogadorId);

                    if (oponentesIds.length === 0) {
                        socket.emit('powerup:error', { message: 'Não há oponentes na sala para bloquear.' });
                        return;
                    }
                    let targetId = targetPlayerId ? Number(targetPlayerId) : oponentesIds[Math.floor(Math.random() * oponentesIds.length)];
                    if (!oponentesIds.includes(targetId)) {
                        targetId = oponentesIds[0];
                    }

                    const targetSocketId = await getSocketIdByPlayerId(targetId);
                    if (targetSocketId) {
                        io.to(targetSocketId).emit('effect:block_typing', { duration: 5, attackerId: usuarioJogadorId });
                        socket.emit('powerup:ack', { codigo: efeito, message: `Digitação do adversário bloqueada por 5 segundos!` });
                        console.log(`[BLOCK_TYPE] Jogador ${usuarioJogadorId} bloqueou digitação de ${targetId} por 5s`);
                    } else {
                        socket.emit('powerup:error', { message: 'Oponente não está conectado.' });
                    }
                } catch (err) {
                    console.error('[BLOCK_TYPE] Erro:', err);
                    socket.emit('powerup:error', { message: 'Erro ao aplicar bloqueio de digitação.' });
                }
                break;


            case 'DISREGARD_OPPONENT_WORD':
            case 'SKIP_OPPONENT_CATEGORY':
                try {
                    const todosJogadores = await getJogadoresDaSala(salaId);
                    const oponentesIds = todosJogadores.filter(id => id !== usuarioJogadorId);

                    if (oponentesIds.length === 0) {
                        socket.emit('powerup:error', { message: 'Não há oponentes na sala para afetar.' });
                        return;
                    }
                    if (targetTemaNome) {
                        let targetId = targetPlayerId ? Number(targetPlayerId) : oponentesIds[Math.floor(Math.random() * oponentesIds.length)];
                        if (!oponentesIds.includes(targetId)) {
                            targetId = oponentesIds[0];
                        }
                        const { data: temasRodada, error: temasError } = await supa
                            .from('rodada_tema')
                            .select('tema:tema_id(tema_nome)')
                            .eq('rodada_id', currentRoundId);
                        if (temasError) throw temasError;
                        const temasValidos = (temasRodada || []).map(t => t.tema.tema_nome);
                        if (!temasValidos.includes(targetTemaNome)) {
                            socket.emit('powerup:error', { message: 'Tema inválido para esta rodada.' });
                            return;
                        }
                        addDisregardedOpponentWord(salaId, currentRoundId, targetId, targetTemaNome);

                        const targetSocketId = await getSocketIdByPlayerId(targetId);
                        if (targetSocketId) {
                            const { data: temasRodadaFull, error: temasErrFull } = await supa
                                .from('rodada_tema')
                                .select('tema_id, tema:tema_id(tema_nome)')
                                .eq('rodada_id', currentRoundId);

                            let temaId = null;
                            if (!temasErrFull && temasRodadaFull) {
                                const temaFound = temasRodadaFull.find(t => t.tema?.tema_nome === targetTemaNome);
                                if (temaFound) temaId = temaFound.tema_id;
                            }

                            if (temaId) {
                                io.to(targetSocketId).emit('effect:category_disregarded', {
                                    temaId: temaId,
                                    temaNome: targetTemaNome,
                                    attackerId: usuarioJogadorId
                                });
                            }
                        }

                        socket.emit('powerup:ack', { codigo: efeito, message: `Palavra "${targetTemaNome}" do oponente foi desconsiderada! Ele não ganhará pontos por ela.` });
                        console.log(`[DISREGARD_OPPONENT_WORD] Jogador ${usuarioJogadorId} desconsiderou palavra "${targetTemaNome}" do jogador ${targetId} na rodada ${currentRoundId}`);
                    } else {
                        socket.emit('effect:enable_skip_opponent', { powerUpId: powerUpId });
                    }
                } catch (err) {
                    console.error('[DISREGARD_OPPONENT_WORD] Erro:', err);
                    socket.emit('powerup:error', { message: 'Erro ao ativar desconsideração de palavra do oponente.' });
                }
                break;
                case 'SCREEN_DIRECTION_MOD':
                  try {
                    const todosJogadores = await getJogadoresDaSala(salaId);
                    const oponentesIds = todosJogadores.filter(id => id !== usuarioJogadorId);

                    if (oponentesIds.length === 0) {
                      socket.emit('powerup:error', { message: 'Não há oponentes na sala para afetar.' });
                      break;
                    }

                    // Escolhe alvo (pode vir targetPlayerId ou aleatório)
                    let targetId = targetPlayerId ? Number(targetPlayerId) : oponentesIds[Math.floor(Math.random() * oponentesIds.length)];
                    if (!oponentesIds.includes(targetId)) targetId = oponentesIds[0];

                    const targetSocketId = await getSocketIdByPlayerId(targetId);
                    if (targetSocketId) {
                      // envia evento para o front do alvo
                      io.to(targetSocketId).emit('effect:invert_screen', { duration: 5000, attackerId: usuarioJogadorId });
                      socket.emit('powerup:ack', { codigo: efeito, message: 'Tela do oponente foi virada por alguns segundos!' });
                      console.log(`[SCREEN_DIRECTION_MOD] Jogador ${usuarioJogadorId} alterou a direção da tela do jogador ${targetId}`);
                    } else {
                      socket.emit('powerup:error', { message: 'Oponente não está conectado.' });
                    }
                  } catch (err) {
                    console.error('[SCREEN_DIRECTION_MOD] Erro:', err);
                    socket.emit('powerup:error', { message: 'Erro ao aplicar rotação de tela.' });
                  }
                  break;

            default:
                console.warn(`[powerup:use] Efeito desconhecido: ${efeito}`);
                socket.emit('powerup:error', { message: `Efeito não implementado: ${efeito}` });
        }
    } catch (e) {
        console.error(`[powerup:use ${usuarioJogadorId} ${powerUpId}] Error:`, e);
        socket.emit('powerup:error', { message: e.message || 'Erro ao processar power-up.' });
    }
});
    // *** FIM DA MODIFICAÇÃO DO PASSO 5 ***

    socket.on('match:start', async ({ salaId, rounds, duration }) => {
      try {
        const sala_id = Number(salaId);
        if (!sala_id) throw new Error('sala_id é obrigatório');

        const jogador_id = socket.data.jogador_id;

        // Check if the player who is starting the game is the host
        const { data: salaData, error: salaError } = await supa
          .from('sala')
          .select('jogador_criador_id')
          .eq('sala_id', sala_id)
          .single();

        if (salaError) throw salaError;
        if (salaData.jogador_criador_id !== jogador_id) {
          throw new Error('Apenas o host pode iniciar a partida.');
        }

        const ROUNDS = Number(rounds || 5);
        const DURATION = Number(duration || 20);

        const qExisting = await supa
          .from('rodada')
          .select('rodada_id, numero_da_rodada, status')
          .eq('sala_id', sala_id)
          .not('status', 'eq', 'done')
          .order('numero_da_rodada', { ascending: true });

        if (qExisting.error) throw qExisting.error;

        if ((qExisting.data || []).length > 0) {
          const first = qExisting.data[0];
          
          if (first.status === 'in_progress') {
            const io = getIO();
            if (io) {
              const payload = await buildRoundPayload(first.rodada_id);
              const qTempo = await supa.from('rodada').select('tempo:tempo_id(valor)').eq('rodada_id', first.rodada_id).single();
              const duration = qTempo.data?.tempo?.valor || DURATION;
              const timeLeft = getTimeLeftForSala(sala_id, duration);
              
              io.to(String(sala_id)).emit('round:ready', payload);
              io.to(String(sala_id)).emit('round:started', { roundId: payload.rodada_id, duration: duration, timeLeft: timeLeft });
            }
            return;
          }
          
          const io = getIO();
          if (io) {
            const payload = await buildRoundPayload(first.rodada_id);

            const { error: updateSalaError } = await supa
              .from('sala')
              .update({ status: 'in_progress' })
              .eq('sala_id', sala_id);
            if (updateSalaError) {
                console.error(`Erro ao atualizar status da sala ${sala_id} para in_progress:`, updateSalaError);
            }

            await supa
              .from('rodada')
              .update({ status: 'in_progress' })
              .eq('rodada_id', payload.rodada_id);

            const timeLeft = getTimeLeftForSala(sala_id, DURATION);
            io.to(String(sala_id)).emit('round:ready', payload);
            io.to(String(sala_id)).emit('round:started', { roundId: payload.rodada_id, duration: DURATION, timeLeft: timeLeft });
            
            scheduleRoundCountdown({ salaId: sala_id, roundId: payload.rodada_id, duration: DURATION });
          }
          return;
        }

        const qPlayersJS = await supa.from('jogador_sala').select('jogador_id').eq('sala_id', sala_id);

        const ids = (qPlayersJS.data || []).map(r => Number(r.jogador_id));
        const unique = [...new Set(ids)].filter(Boolean);

        if (unique.length < 2) {
          socket.emit('app:error', { context: 'match-start', message: 'A sala precisa ter exatamente 2 jogadores para iniciar a partida.' });
          return;
        }
        if (unique.length > 2) {
          socket.emit('app:error', { context: 'match-start', message: 'A sala tem mais jogadores do que o permitido. Máximo de 2 jogadores.' });
          return;
        }

        const tempo_id = await ensureTempoId(DURATION);

        const roundsInfo = await generateCoherentRounds({ totalRounds: ROUNDS });

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

        const io = getIO();
        if (io && created.length) {
          const { error: updateSalaError } = await supa
            .from('sala')
            .update({ status: 'in_progress' })
            .eq('sala_id', sala_id);
          if (updateSalaError) {
              console.error(`Erro ao atualizar status da sala ${sala_id} para in_progress:`, updateSalaError);
          }

          await supa
            .from('rodada')
            .update({ status: 'in_progress' })
            .eq('rodada_id', created[0].rodada_id);

          const timeLeft = getTimeLeftForSala(sala_id, DURATION);
          io.to(String(sala_id)).emit('round:ready', created[0]);
          io.to(String(sala_id)).emit('round:started', { roundId: created[0].rodada_id, duration: DURATION, timeLeft: timeLeft });
          
          scheduleRoundCountdown({ salaId: sala_id, roundId: created[0].rodada_id, duration: DURATION });
        }
      } catch (e) {
        console.error('/matches/start failed', e);
        socket.emit('app:error', { context: 'match-start', message: e.message });
      }
    });

    socket.on('disconnect', (reason) => { //
        console.log('user disconnected:', socket.id, 'jogador_id:', socket.data.jogador_id, 'reason:', reason); //
        // Lógica para remover jogador da sala no disconnect (simplificado)
        const salaId = socket.data.salaId; //
        const jogadorId = socket.data.jogador_id; //
        if (salaId && jogadorId) {
           console.log(`[DISCONNECT] Removendo jogador ${jogadorId} da sala ${salaId} (se existir)...`);
           supa.from('jogador_sala').delete().match({ sala_id: salaId, jogador_id: jogadorId })
             .then(({ error }) => {
                 if (error) {
                     console.error(`[DISCONNECT] Erro ao remover jogador ${jogadorId} da sala ${salaId}:`, error);
                 } else {
                     console.log(`[DISCONNECT] Jogador ${jogadorId} removido da sala ${salaId} (ou já não estava).`);
                     // Emitir atualização de jogadores para a sala
                     const io = getIO();
                     if (io) {
                        supa.from('jogador_sala')
                            .select('jogador:jogador_id(nome_de_usuario)')
                            .eq('sala_id', salaId)
                            .then(({ data: playersData, error: playersError }) => {
                                if (!playersError) {
                                    const playerNames = (playersData || []).map(p => p.jogador?.nome_de_usuario || 'Desconhecido');
                                    console.log(`[DISCONNECT] Emitindo players_updated para sala ${salaId}:`, playerNames);
                                    io.to(salaId).emit('room:players_updated', { jogadores: playerNames });
                                }
                            });
                     }
                 }
             });
        }
    });

  });

  return io; //
}

export function getIO() { return io; } //


function computeWinner(totaisObj = {}) { //
     const entries = Object.entries(totaisObj).map(([id, total]) => [Number(id), Number(total || 0)]); //
  if (!entries.length) return null; //

  entries.sort((a, b) => b[1] - a[1]); //
  const topScore = entries[0][1]; //

  const empatados = entries.filter(([, total]) => total === topScore).map(([id]) => id); //

  if (empatados.length > 1) { //
    return { //
      empate: true, //
      jogadores: empatados, //
      total: topScore //
    };
  }

  return { //
    empate: false, //
    jogador_id: entries[0][0], //
    total: topScore //
  };
}
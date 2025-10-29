// backend/src/sockets.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { supa } from '../services/supabase.js'; //
import { endRoundAndScore, getNextRoundForSala, getJogadoresDaSala } from '../services/game.js'; //

const JWT_SECRET = process.env.JWT_SECRET || 'developer_secret_key'; //

const sleep = (ms) => new Promise(r => setTimeout(r, ms)); //
const GRACE_MS = 3000; //

const MOEDAS_VITORIA = 50; //
const MOEDAS_EMPATE = 25; //
const MOEDAS_PARTICIPACAO = 5; //

let io; //

// ===== Armazenamento em Memória para Power-ups Ativos na Rodada =====
// Guarda quem ativou a revelação em qual rodada. Formato: Map<salaId, Map<roundId, Set<jogadorId>>>
const activeRevealRequests = new Map(); //

function addRevealRequest(salaId, roundId, jogadorId) { //
    if (!activeRevealRequests.has(salaId)) { //
        activeRevealRequests.set(salaId, new Map()); //
    }
    const salaMap = activeRevealRequests.get(salaId); //
    if (!salaMap.has(roundId)) { //
        salaMap.set(roundId, new Set()); //
    }
    salaMap.get(roundId).add(jogadorId); //
    console.log(`[REVEAL] Jogador ${jogadorId} ativou revelação para sala ${salaId}, rodada ${roundId}`); //
}

function getAndClearRevealRequests(salaId, roundId) { //
    const salaMap = activeRevealRequests.get(salaId); //
    if (!salaMap || !salaMap.has(roundId)) { //
        return new Set(); // Nenhum pedido para esta rodada/sala
    }
    const requests = salaMap.get(roundId); //
    salaMap.delete(roundId); // Limpa após obter
    if (salaMap.size === 0) { //
        activeRevealRequests.delete(salaId); // Limpa o mapa da sala se vazio
    }
    return requests || new Set(); //
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
async function adicionarMoedas(jogadorId, quantidade) {
    if (!jogadorId || quantidade <= 0) return; //
    try {
      console.log(`[MOEDAS] Adicionando ${quantidade} moedas para jogador ${jogadorId}...`);
      // Usando rpc para chamar uma função SQL 'adicionar_moedas' (mais seguro contra race conditions)
      // Você precisará criar essa função no Supabase SQL Editor:
      /*
      CREATE OR REPLACE FUNCTION adicionar_moedas(jogador_id_param int, quantidade_param int)
      RETURNS void AS $$
      BEGIN
        UPDATE public.jogador
        SET moedas = COALESCE(moedas, 0) + quantidade_param
        WHERE jogador_id = jogador_id_param;
      END;
      $$ LANGUAGE plpgsql;
      */
      const { error } = await supa.rpc('adicionar_moedas', {
          jogador_id_param: jogadorId,
          quantidade_param: quantidade
      });
      if (error) throw error;
      console.log(`[MOEDAS] ${quantidade} moedas adicionadas para jogador ${jogadorId}.`);

      // Opcional: Notificar o jogador sobre o ganho de moedas via socket?
      // const socketId = await getSocketIdByPlayerId(jogadorId);
      // if (socketId) io.to(socketId).emit('player:coins_updated', { /* novo saldo? */ });

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

        // Re-verifica se pontuou durante o sleep (ex: por um clique STOP)
        if (scoredRounds.has(`${salaId}-${roundId}`)) {
             console.warn(`[TIMER->STOP] Rodada ${roundId} pontuada durante GRACE_MS. Abortando pontuação do timer.`);
             return;
        }

        const payload = await endRoundAndScore({ salaId, roundId }); //

        // --- LÓGICA DE REVELAÇÃO (APÓS PONTUAÇÃO) ---
        const revealRequesters = getAndClearRevealRequests(salaId, roundId); //
        if (revealRequesters.size > 0) { //
             const { data: respostasFinais, error: errRespostas } = await supa //
                .from('participacao_rodada') //
                .select('jogador_id, tema_nome, resposta') //
                .eq('rodada_id', roundId); //

             if (errRespostas) { //
                 console.error("[REVEAL ERRO] Falha ao buscar respostas finais:", errRespostas); //
             } else { //
                 const todosJogadoresSala = await getJogadoresDaSala(salaId); //

                 for (const requesterId of revealRequesters) { //
                     const oponentesIds = todosJogadoresSala.filter(id => id !== requesterId); //
                     if (oponentesIds.length > 0 && respostasFinais && respostasFinais.length > 0) { //
                         const oponenteAlvoId = oponentesIds[Math.floor(Math.random() * oponentesIds.length)]; //
                         const respostasOponente = respostasFinais.filter(r => r.jogador_id === oponenteAlvoId && r.resposta && r.resposta.trim() !== ''); //

                         if (respostasOponente.length > 0) { //
                             const respostaRevelada = respostasOponente[Math.floor(Math.random() * respostasOponente.length)]; //
                             const requesterSocketId = await getSocketIdByPlayerId(requesterId); //
                             if (requesterSocketId) { //
                                 io.to(requesterSocketId).emit('effect:answer_revealed', { //
                                     temaNome: respostaRevelada.tema_nome, //
                                     resposta: respostaRevelada.resposta, //
                                     oponenteId: oponenteAlvoId //
                                 });
                                 console.log(`[REVEAL] Resposta enviada para jogador ${requesterId} (socket ${requesterSocketId})`); //
                             } else { //
                                  console.warn(`[REVEAL] Socket não encontrado para jogador ${requesterId}`); //
                             }
                         } else { //
                              console.log(`[REVEAL] Oponente ${oponenteAlvoId} não teve respostas válidas para revelar.`); //
                               const requesterSocketId = await getSocketIdByPlayerId(requesterId); //
                                if (requesterSocketId) io.to(requesterSocketId).emit('powerup:info', { message: 'Nenhuma resposta válida do oponente para revelar.'}); //
                         }
                     } else { //
                          console.log(`[REVEAL] Não há oponentes ou respostas para revelar para jogador ${requesterId}.`); //
                     }
                 }
             }
        }
        // --- FIM LÓGICA REVELAÇÃO ---

        io.to(salaId).emit('round:end', payload); // Emite o resultado NORMALMENTE

        const next = await getNextRoundForSala({ salaId, afterRoundId: roundId }); //
        if (next) { //
            // Código para iniciar a próxima rodada
             console.log(`[TIMER->NEXT_ROUND] Próxima rodada ${next.rodada_id} para sala ${salaId}`);
             // Atualiza status da próxima rodada para 'in_progress'
             await supa.from('rodada').update({ status: 'in_progress' }).eq('rodada_id', next.rodada_id); //
             io.to(salaId).emit('round:ready', next); //
             io.to(salaId).emit('round:started', { roundId: next.rodada_id, duration: duration }); // Usar a mesma duração
             scheduleRoundCountdown({ salaId: salaId, roundId: next.rodada_id, duration: duration }); //
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

    socket.on('join-room', (salaId) => { //
        salaId = String(salaId); // Garante que é string
        console.log(`Socket ${socket.id} (jogador ${socket.data.jogador_id}) joining room ${salaId}`);
        socket.join(salaId); //
        // Guarda a sala no socket data para referência futura (ex: disconnect)
        socket.data.salaId = salaId; //
        // Confirma que entrou (opcional)
        socket.emit('joined', { salaId }); //
    });

    socket.on('round:stop', async ({ salaId, roundId, by }) => { //
       try { //
        salaId = String(salaId || socket.data.salaId); //
        roundId = Number(roundId); //
        const stoppedBy = by || socket.data.jogador_id; //

        if (!salaId || !roundId) { /* Não fazer nada se IDs inválidos */ return; } //
        // Verifica se JÁ FOI PONTUADO antes de fazer qualquer coisa
        if (alreadyScored(salaId, roundId)) { return; } //

        console.log(`[CLICK STOP] sala=${salaId} round=${roundId} by=${stoppedBy}`); //
        io.to(salaId).emit('round:stopping', { roundId, by: stoppedBy }); //

        // Limpa o timer imediatamente para evitar que ele também tente pontuar
        clearTimerForSala(salaId); //
        await sleep(GRACE_MS); //

        // Re-verifica se pontuou durante o sleep (caso MUITO raro de concorrência extrema)
         if (scoredRounds.has(`${salaId}-${roundId}`)) {
             console.warn(`[STOP] Rodada ${roundId} pontuada durante GRACE_MS (concorrência?). Abortando pontuação do stop.`);
             return;
         }

        const payload = await endRoundAndScore({ salaId, roundId }); //

        // --- LÓGICA DE REVELAÇÃO (APÓS PONTUAÇÃO - igual ao timer) ---
         const revealRequesters = getAndClearRevealRequests(salaId, roundId); //
        if (revealRequesters.size > 0) { //
            // ... (código de revelação igual ao do timer) ...
             const { data: respostasFinais, error: errRespostas } = await supa //
                .from('participacao_rodada') //
                .select('jogador_id, tema_nome, resposta') //
                .eq('rodada_id', roundId); //

             if (errRespostas) { //
                 console.error("[REVEAL ERRO] Falha ao buscar respostas finais:", errRespostas); //
             } else { //
                 const todosJogadoresSala = await getJogadoresDaSala(salaId); //

                 for (const requesterId of revealRequesters) { //
                     const oponentesIds = todosJogadoresSala.filter(id => id !== requesterId); //
                     if (oponentesIds.length > 0 && respostasFinais && respostasFinais.length > 0) { //
                         const oponenteAlvoId = oponentesIds[Math.floor(Math.random() * oponentesIds.length)]; //
                         const respostasOponente = respostasFinais.filter(r => r.jogador_id === oponenteAlvoId && r.resposta && r.resposta.trim() !== ''); //

                         if (respostasOponente.length > 0) { //
                             const respostaRevelada = respostasOponente[Math.floor(Math.random() * respostasOponente.length)]; //
                             const requesterSocketId = await getSocketIdByPlayerId(requesterId); //
                             if (requesterSocketId) { //
                                 io.to(requesterSocketId).emit('effect:answer_revealed', { //
                                     temaNome: respostaRevelada.tema_nome, //
                                     resposta: respostaRevelada.resposta, //
                                     oponenteId: oponenteAlvoId //
                                 });
                                 console.log(`[REVEAL] Resposta enviada para jogador ${requesterId} (socket ${requesterSocketId})`); //
                             } else { console.warn(`[REVEAL] Socket não encontrado para jogador ${requesterId}`); } //
                         } else { //
                              console.log(`[REVEAL] Oponente ${oponenteAlvoId} não teve respostas válidas para revelar.`); //
                               const requesterSocketId = await getSocketIdByPlayerId(requesterId); //
                                if (requesterSocketId) io.to(requesterSocketId).emit('powerup:info', { message: 'Nenhuma resposta válida do oponente para revelar.'}); //
                         }
                     } else { console.log(`[REVEAL] Não há oponentes ou respostas para revelar para jogador ${requesterId}.`); } //
                 }
             }
        }
        // --- FIM LÓGICA REVELAÇÃO ---

        io.to(salaId).emit('round:end', payload); // Emite resultado NORMALMENTE

        const next = await getNextRoundForSala({ salaId, afterRoundId: roundId }); //
        if (next) { //
            // Código para iniciar a próxima rodada
            console.log(`[STOP->NEXT_ROUND] Próxima rodada ${next.rodada_id} para sala ${salaId}`);
            await supa.from('rodada').update({ status: 'in_progress' }).eq('rodada_id', next.rodada_id); //
            io.to(salaId).emit('round:ready', next); //
            // Precisa pegar a duração original da rodada anterior ou ter um padrão
            const qTempo = await supa.from('rodada').select('tempo:tempo_id(valor)').eq('rodada_id', roundId).single(); //
            const duration = qTempo.data?.tempo?.valor || 20; // Default 20s
            io.to(salaId).emit('round:started', { roundId: next.rodada_id, duration: duration }); //
            scheduleRoundCountdown({ salaId: salaId, roundId: next.rodada_id, duration: duration }); //
        } else { //
          // --- LÓGICA DE FIM DE PARTIDA E MOEDAS (STOP) ---
          const winnerInfo = computeWinner(payload.totais); //
          const todosJogadoresIds = Object.keys(payload.totais || {}).map(Number); //
          // Adicionar Moedas
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
          console.log(`[STOP->MATCH_END] Atualizando sala ${salaId} para 'terminada'`);
          const { error: updateSalaStopError } = await supa
            .from('sala') //
            .update({ status: 'terminada' }) // Novo status
            .eq('sala_id', salaId); //
          if (updateSalaStopError) {
               console.error(`[STOP] Erro ao atualizar status da sala ${salaId} para terminada:`, updateSalaStopError);
          }

          io.to(salaId).emit('match:end', { //
                 totais: payload.totais, //
                 vencedor: winnerInfo //
          });
          console.log(`[STOP->MATCH_END] Fim de partida para sala ${salaId}`); // Log de fim de partida
          // --------------------------------------------------
        }
      } catch (e) {
          console.error(`[STOP ${salaId} ${roundId}] Error during stop handling:`, e);
          io.to(salaId).emit('app:error', { context: 'stop-handler', message: e.message }); //
      }
    });

    socket.on('powerup:use', async ({ powerUpId, targetPlayerId = null }) => { //
        const salaId = socket.data.salaId; //
        const usuarioJogadorId = socket.data.jogador_id; //
        const currentRoundId = roomTimers.get(salaId)?.roundId; //

        if (!usuarioJogadorId || !salaId || !powerUpId) { /* Retorna erro de parâmetros */ //
             socket.emit('powerup:error', { message: 'Faltando parâmetros para usar power-up.' }); //
             return; //
        }
        if (!currentRoundId) { //
             socket.emit('powerup:error', { message: 'Não é possível usar power-ups fora de uma rodada ativa.' }); //
             return; //
        }


        try { //
          // --- Verificar inventário e decrementar ---
          // Busca o item e o power-up associado para pegar o código
          const { data: itemInventario, error: checkError } = await supa //
              .from('jogador_power_up') //
              .select(`
                  jogador_power_up_id,
                  quantidade,
                  power_up ( codigo_identificador )
              `) //
              .eq('jogador_id', usuarioJogadorId) //
              .eq('power_up_id', powerUpId) //
              .maybeSingle(); // Usar maybeSingle se for possível não ter o item

          if (checkError && checkError.code !== 'PGRST116') { throw checkError; } // // Ignora erro "not found"
          if (!itemInventario || itemInventario.quantidade <= 0) { //
             socket.emit('powerup:error', { message: 'Você não possui este power-up ou quantidade insuficiente.' }); //
             return; //
          }
          const novaQuantidade = itemInventario.quantidade - 1; //
          const { error: decrementError } = await supa //
              .from('jogador_power_up') //
              .update({ quantidade: novaQuantidade }) //
              .eq('jogador_power_up_id', itemInventario.jogador_power_up_id); // Usa a chave primária da tabela de inventário
          if (decrementError) { throw decrementError; } //
          // Emite evento para o cliente atualizar o inventário visualmente
          socket.emit('inventory:updated'); //
          // --- Fim da verificação/decremento ---

          const efeito = itemInventario.power_up.codigo_identificador; //
          console.log(`[powerup:use] Sucesso: Jogador ${usuarioJogadorId} usou ${efeito} na sala ${salaId}, rodada ${currentRoundId}`); //

          switch (efeito) { //
            case 'BLUR_OPPONENT_SCREEN_5S': //
              // Emite para todos os outros na sala
              socket.to(salaId).emit('effect:jumpscare', { attackerId: usuarioJogadorId /*, image, sound */ }); //
              socket.emit('powerup:ack', { codigo: efeito, message: 'Jumpscare enviado!' }); // Confirma para quem usou //
              break;
            case 'SKIP_OWN_CATEGORY': //
              // Emite apenas para o socket que usou o power-up
              socket.emit('effect:enable_skip', { powerUpId: powerUpId }); //
              // Não precisa de 'powerup:ack' aqui pois o 'effect:enable_skip' já é a confirmação
              break;
            case 'REVEAL_OPPONENT_ANSWER': //
              addRevealRequest(salaId, currentRoundId, usuarioJogadorId); //
              socket.emit('powerup:ack', { codigo: efeito, message: 'Revelação de resposta ativada para o final desta rodada.' }); //
              break;
            case 'BLOCK_OPPONENT_TYPE_5S': //
              // Bloqueia digitação do adversário por 5 segundos
              try {
                const todosJogadores = await getJogadoresDaSala(salaId);
                const oponentesIds = todosJogadores.filter(id => id !== usuarioJogadorId);
                
                if (oponentesIds.length === 0) {
                  socket.emit('powerup:error', { message: 'Não há oponentes na sala para bloquear.' });
                  return;
                }
                
                // Se targetPlayerId foi especificado, usa ele; senão seleciona aleatório
                let targetId = targetPlayerId ? Number(targetPlayerId) : oponentesIds[Math.floor(Math.random() * oponentesIds.length)];
                
                // Verifica se o alvo é válido
                if (!oponentesIds.includes(targetId)) {
                  targetId = oponentesIds[0]; // Fallback para primeiro oponente
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
            case 'CLEAR_OPPONENT_ANSWERS': //
              // Apaga os campos já escritos do adversário
              try {
                const todosJogadores = await getJogadoresDaSala(salaId);
                const oponentesIds = todosJogadores.filter(id => id !== usuarioJogadorId);
                
                if (oponentesIds.length === 0) {
                  socket.emit('powerup:error', { message: 'Não há oponentes na sala para afetar.' });
                  return;
                }
                
                // Se targetPlayerId foi especificado, usa ele; senão seleciona aleatório
                let targetId = targetPlayerId ? Number(targetPlayerId) : oponentesIds[Math.floor(Math.random() * oponentesIds.length)];
                
                // Verifica se o alvo é válido
                if (!oponentesIds.includes(targetId)) {
                  targetId = oponentesIds[0]; // Fallback para primeiro oponente
                }
                
                // Apaga as respostas do adversário no banco de dados para a rodada atual
                const { error: clearError } = await supa
                  .from('participacao_rodada')
                  .update({ resposta: '' })
                  .eq('rodada_id', currentRoundId)
                  .eq('jogador_id', targetId);
                
                if (clearError) {
                  console.error('[CLEAR_ANSWERS] Erro ao limpar respostas:', clearError);
                  socket.emit('powerup:error', { message: 'Erro ao apagar respostas do adversário.' });
                  return;
                }
                
                // Envia evento para o frontend do adversário limpar os campos
                const targetSocketId = await getSocketIdByPlayerId(targetId);
                if (targetSocketId) {
                  io.to(targetSocketId).emit('effect:clear_answers', { attackerId: usuarioJogadorId });
                  socket.emit('powerup:ack', { codigo: efeito, message: `Campos do adversário foram apagados!` });
                  console.log(`[CLEAR_ANSWERS] Jogador ${usuarioJogadorId} apagou respostas de ${targetId}`);
                } else {
                  // Mesmo que não encontre socket, as respostas já foram apagadas do banco
                  socket.emit('powerup:ack', { codigo: efeito, message: `Campos do adversário foram apagados!` });
                  console.log(`[CLEAR_ANSWERS] Respostas de ${targetId} apagadas (jogador offline)`);
                }
              } catch (err) {
                console.error('[CLEAR_ANSWERS] Erro:', err);
                socket.emit('powerup:error', { message: 'Erro ao apagar campos do adversário.' });
              }
              break;
            default: //
              console.warn(`[powerup:use] Efeito desconhecido: ${efeito}`); //
              socket.emit('powerup:error', { message: `Efeito não implementado: ${efeito}`}); //
          }
        } catch (e) {
            console.error(`[powerup:use ${usuarioJogadorId} ${powerUpId}] Error:`, e); //
            socket.emit('powerup:error', { message: e.message || 'Erro ao processar power-up.' }); //
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
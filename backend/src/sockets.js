// backend/src/sockets.js
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { supa } from '../services/supabase.js';
// (NOVO) Importar prepararRodada
import { endRoundAndScore, getNextRoundForSala, getJogadoresDaSala, getRoundResults, prepararRodada } from '../services/game.js';

const JWT_SECRET = process.env.JWT_SECRET || 'developer_secret_key'; 

const sleep = (ms) => new Promise(r => setTimeout(r, ms)); 
const GRACE_MS = 3000; 

const MOEDAS_VITORIA = 50; 
const MOEDAS_EMPATE = 25; 
const MOEDAS_PARTICIPACAO = 5; 

let io; 

// (NOVO) Adicionar função normalize
function normalize(txt = '') {
  return String(txt)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
}

// ===== Armazenamento em Memória para Power-ups Ativos na Rodada =====
// (Manter código existente)
const activeRevealRequests = new Map(); 

function addRevealRequest(salaId, roundId, jogadorId) { 
    if (!activeRevealRequests.has(salaId)) { 
        activeRevealRequests.set(salaId, new Map()); 
    }
    const salaMap = activeRevealRequests.get(salaId); 
    if (!salaMap.has(roundId)) { 
        salaMap.set(roundId, new Set()); 
    }
    salaMap.get(roundId).add(jogadorId); 
    console.log(`[REVEAL] Jogador ${jogadorId} ativou revelação para sala ${salaId}, rodada ${roundId}`); 
}

function getAndClearRevealRequests(salaId, roundId) { 
    const salaMap = activeRevealRequests.get(salaId); 
    if (!salaMap || !salaMap.has(roundId)) { 
        return new Set(); 
    }
    const requests = salaMap.get(roundId); 
    salaMap.delete(roundId); 
    if (salaMap.size === 0) { 
        activeRevealRequests.delete(salaId); 
    }
    return requests || new Set(); 
}

// ===== Armazenamento para palavras puladas (SKIP_WORD) =====
// (Manter código existente)
const skippedWords = new Map(); 

function addSkippedWord(salaId, roundId, jogadorId, temaNome) { 
    const key = `${salaId}-${roundId}`; 
    if (!skippedWords.has(key)) { 
        skippedWords.set(key, new Set()); 
    }
    skippedWords.get(key).add(`${jogadorId}-${temaNome}`); 
    console.log(`[SKIP_WORD] Jogador ${jogadorId} pulou palavra ${temaNome} na rodada ${roundId}`); 
}

function getSkippedWords(salaId, roundId) { 
    const key = `${salaId}-${roundId}`; 
    const words = skippedWords.get(key); 
    return words || new Set(); 
}

function clearSkippedWords(salaId, roundId) { 
    const key = `${salaId}-${roundId}`; 
    skippedWords.delete(key); 
}

function isWordSkipped(salaId, roundId, jogadorId, temaNome) { 
    const key = `${salaId}-${roundId}`; 
    const words = skippedWords.get(key); 
    if (!words) return false; 
    return words.has(`${jogadorId}-${temaNome}`); 
}
// ======================================================================

// ===== Armazenamento para palavras desconsideradas do oponente (DISREGARD_OPPONENT_WORD) =====
// (Manter código existente)
const disregardedOpponentWords = new Map(); 

function addDisregardedOpponentWord(salaId, roundId, targetJogadorId, temaNome) { 
    const key = `${salaId}-${roundId}`; 
    if (!disregardedOpponentWords.has(key)) { 
        disregardedOpponentWords.set(key, new Set()); 
    }
    disregardedOpponentWords.get(key).add(`${targetJogadorId}-${temaNome}`); 
    console.log(`[DISREGARD_OPPONENT_WORD] Palavra "${temaNome}" do jogador ${targetJogadorId} foi desconsiderada na rodada ${roundId}`); 
}

function getDisregardedOpponentWords(salaId, roundId) { 
    const key = `${salaId}-${roundId}`; 
    const words = disregardedOpponentWords.get(key); 
    return words || new Set(); 
}

function clearDisregardedOpponentWords(salaId, roundId) { 
    const key = `${salaId}-${roundId}`; 
    disregardedOpponentWords.delete(key); 
}

function isOpponentWordDisregarded(salaId, roundId, jogadorId, temaNome) { 
    const key = `${salaId}-${roundId}`; 
    const words = disregardedOpponentWords.get(key); 
    if (!words) return false; 
    return words.has(`${jogadorId}-${temaNome}`); 
}
// ======================================================================

// Map para guardar informações dos timers ativos por sala
const roomTimers = new Map(); 

// =======================================================
// === INÍCIO DAS NOVAS ALTERAÇÕES (CORREÇÃO F5) ===
// =======================================================

// Mapa para guardar timers de desconexão
// Formato: Map<jogadorId, NodeJS.Timeout>
const disconnectTimers = new Map();
// Tempo que esperamos antes de remover o jogador (ex: 7 segundos)
const DISCONNECT_GRACE_MS = 7000;

// =======================================================
// === FIM DAS NOVAS ALTERAÇÕES ===
// =======================================================


// Função para limpar/cancelar um timer existente para uma sala
function clearTimerForSala(salaId) {
    salaId = String(salaId); 
    if (roomTimers.has(salaId)) { 
        const { interval } = roomTimers.get(salaId); 
        clearInterval(interval); 
        roomTimers.delete(salaId); 
        console.log(`[TIMER] Timer for sala ${salaId} cleared.`); 
    }
}

// Função para obter o tempo restante de um timer ativo
// (Manter código existente)
export function getTimerTimeLeft(salaId, roundId) {
    salaId = String(salaId);
    roundId = Number(roundId);
    
    if (!roomTimers.has(salaId)) {
        return null;
    }
    
    const timer = roomTimers.get(salaId);
    
    // Verifica se o timer é para a mesma rodada
    if (timer.roundId !== roundId) {
        return null;
    }
    
    // Calcula o tempo restante
    const now = Date.now();
    const timeLeft = Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
    
    // Se o tempo já acabou, retorna null (timer não está mais ativo)
    if (timeLeft <= 0) {
        return null;
    }
    
    return { timeLeft, roundId: timer.roundId };
}

// Set para guardar rodadas já pontuadas (evitar pontuação dupla)
const scoredRounds = new Set(); 

// Função para verificar se uma rodada já foi pontuada
function alreadyScored(salaId, roundId) {
    const key = `${salaId}-${roundId}`; 
    if (scoredRounds.has(key)) { 
        console.warn(`[SCORE CHECK] Rodada ${roundId} da sala ${salaId} já foi pontuada.`);
        return true; 
    }
    scoredRounds.add(key); 
    setTimeout(() => scoredRounds.delete(key), 5 * 60 * 1000); // Limpa após 5 minutos
    return false; 
}

// Função para adicionar moedas a um jogador
async function adicionarMoedas(jogadorId, quantidade) {
    if (!jogadorId || quantidade <= 0) return; 
    try {
      console.log(`[MOEDAS] Adicionando ${quantidade} moedas para jogador ${jogadorId}...`);
      
      // (NOVO) Esta função agora adiciona moedas no INVENTÁRIO
      // Precisamos de uma RPC para isso
      /* CREATE OR REPLACE FUNCTION adicionar_moedas_inventario(p_jogador_id bigint, p_quantidade bigint)
      RETURNS void AS $$
      DECLARE
          v_moeda_item_id bigint;
      BEGIN
          SELECT item_id INTO v_moeda_item_id FROM public.item WHERE codigo_identificador = 'MOEDA' LIMIT 1;
          IF v_moeda_item_id IS NULL THEN
              RAISE EXCEPTION 'Item "MOEDA" não encontrado.';
          END IF;
          
          INSERT INTO public.inventario (jogador_id, item_id, qtde)
          VALUES (p_jogador_id, v_moeda_item_id, p_quantidade)
          ON CONFLICT (jogador_id, item_id)
          DO UPDATE SET qtde = public.inventario.qtde + p_quantidade;
      END;
      $$ LANGUAGE plpgsql;
      */
      
      const { error } = await supa.rpc('adicionar_moedas_inventario', {
          p_jogador_id: jogadorId,
          p_quantidade: quantidade
      });
      if (error) throw error;
      console.log(`[MOEDAS] ${quantidade} moedas adicionadas (inventário) para jogador ${jogadorId}.`);

    } catch(e) {
        console.error(`[MOEDAS] Erro ao adicionar ${quantidade} moedas (inventário) para jogador ${jogadorId}:`, e.message);
    }
}

// Função auxiliar para obter ID de socket por jogador_id
async function getSocketIdByPlayerId(targetPlayerId) { 
    if (!io) return null; 
    const sockets = await io.fetchSockets(); 
    for (const socket of sockets) { 
        // Comparar como números para evitar problemas de tipo
        if (Number(socket.data.jogador_id) === Number(targetPlayerId)) { 
            return socket.id; 
        }
    }
    return null; 
}


export function scheduleRoundCountdown({ salaId, roundId, duration = 20 }) { 
  salaId = String(salaId); 
  roundId = Number(roundId); 
  // Limpa timer anterior ANTES de setar novo
  clearTimerForSala(salaId); 
  console.log(`[TIMER] Scheduling countdown for sala ${salaId}, round ${roundId}, duration ${duration}s`);

  const endsAt = Date.now() + duration * 1000; 
  const interval = setInterval(async () => { 
    // Verifica se este timer ainda é o ativo para esta sala/rodada
    const currentTimer = roomTimers.get(salaId);
    if (!currentTimer || currentTimer.roundId !== roundId || currentTimer.interval !== interval) {
        console.warn(`[TIMER] Stale timer detected for sala ${salaId}, round ${roundId}. Clearing.`);
        clearInterval(interval);
        return;
    }

    const now = Date.now(); 
    const left = Math.max(0, Math.ceil((endsAt - now) / 1000)); 

    io.to(salaId).emit('round:tick', left); 

    if (left <= 0) { 
      // Limpa o timer ANTES de processar o fim da rodada
      clearTimerForSala(salaId); 
      try {
        // Verifica se já foi pontuado (importante por causa do sleep)
        if (alreadyScored(salaId, roundId)) { return; } 

        console.log(`[TIMER->STOP] sala=${salaId} round=${roundId}`); 
        io.to(salaId).emit('round:stopping', { roundId }); 
        await sleep(GRACE_MS); 

        // (ALTERADO) endRoundAndScore agora usa o novo schema
        const payload = await endRoundAndScore({ 
          salaId, 
          roundId, 
          skippedWordsSet: getSkippedWords(salaId, roundId),
          disregardedOpponentWordsSet: getDisregardedOpponentWords(salaId, roundId)
        }); 

        // Limpa as palavras puladas após pontuar
        clearSkippedWords(salaId, roundId);
        // Limpa as palavras desconsideradas do oponente após pontuar
        clearDisregardedOpponentWords(salaId, roundId);

        // --- LÓGICA DE REVELAÇÃO (APÓS PONTUAÇÃO) ---
        // (ALTERADO) Query de busca de respostas atualizada
        const revealRequesters = getAndClearRevealRequests(salaId, roundId); 
        if (revealRequesters.size > 0) { 
             
             // (NOVA QUERY)
             const { data: respostasFinais, error: errRespostas } = await supa
                .from('participacao_rodada_tema')
                .select(`
                    resposta_do_jogador,
                    jogador_sala_rodada:jogador_sala_rodada_id (
                        rodada_id,
                        jogador_sala:jogador_sala (
                            jogador_id
                        )
                    ),
                    rodada_tema:rodada_tema_id (
                        tema:tema_id (
                            tema_nome
                        )
                    )
                `)
                .eq('jogador_sala_rodada.rodada_id', roundId); // Filtra pela rodada_id

             if (errRespostas) { 
                 console.error("[REVEAL ERRO] Falha ao buscar respostas finais:", errRespostas); 
             } else { 
                 const todosJogadoresSala = await getJogadoresDaSala(salaId); 

                 for (const requesterId of revealRequesters) { 
                     const oponentesIds = todosJogadoresSala.filter(id => id !== requesterId); 
                     if (oponentesIds.length > 0 && respostasFinais && respostasFinais.length > 0) { 
                         const oponenteAlvoId = oponentesIds[Math.floor(Math.random() * oponentesIds.length)];
                         
                         // (NOVO) Mapeia a estrutura da nova query
                         const respostasMapeadas = respostasFinais
                             .map(r => ({
                                 jogador_id: r.jogador_sala_rodada?.jogador_sala?.jogador_id,
                                 tema_nome: r.rodada_tema?.tema?.tema_nome,
                                 resposta: r.resposta_do_jogador
                             }))
                             .filter(r => 
                                 r.jogador_id === oponenteAlvoId && 
                                 r.resposta && 
                                 r.resposta.trim() !== ''
                             );
                         
                         const respostasOponente = respostasMapeadas; // Usa os dados mapeados

                         if (respostasOponente.length > 0) { 
                             const respostaRevelada = respostasOponente[Math.floor(Math.random() * respostasOponente.length)]; 
                             const requesterSocketId = await getSocketIdByPlayerId(requesterId); 
                             if (requesterSocketId) { 
                                 io.to(requesterSocketId).emit('effect:answer_revealed', { 
                                     temaNome: respostaRevelada.tema_nome, 
                                     resposta: respostaRevelada.resposta, 
                                     oponenteId: oponenteAlvoId 
                                 });
                                 console.log(`[REVEAL] Resposta enviada para jogador ${requesterId} (socket ${requesterSocketId})`); 
                             } else { 
                                  console.warn(`[REVEAL] Socket não encontrado para jogador ${requesterId}`); 
                             }
                         } else { 
                              console.log(`[REVEAL] Oponente ${oponenteAlvoId} não teve respostas válidas para revelar.`); 
                               const requesterSocketId = await getSocketIdByPlayerId(requesterId); 
                                if (requesterSocketId) io.to(requesterSocketId).emit('powerup:info', { message: 'Nenhuma resposta válida do oponente para revelar.'}); 
                         }
                     } else { 
                          console.log(`[REVEAL] Não há oponentes ou respostas para revelar para jogador ${requesterId}.`); 
                     }
                 }
             }
        }
        // --- FIM LÓGICA REVELAÇÃO ---

        io.to(salaId).emit('round:end', payload); // Emite o resultado NORMALMENTE

        const next = await getNextRoundForSala({ salaId, afterRoundId: roundId }); 
        if (next) { 
            // Aguarda 10 segundos antes de iniciar a próxima rodada
            console.log(`[TIMER->NEXT_ROUND] Aguardando 10 segundos antes de iniciar próxima rodada ${next.rodada_id} para sala ${salaId}`);
            setTimeout(async () => {
                // Verifica se ainda existe próxima rodada (pode ter mudado durante o delay)
                const nextCheck = await getNextRoundForSala({ salaId, afterRoundId: roundId });
                if (!nextCheck || nextCheck.rodada_id !== next.rodada_id) {
                    console.log(`[TIMER->NEXT_ROUND] Próxima rodada mudou durante o delay, abortando.`);
                    return;
                }
                
                // (NOVO) CHAMA A FUNÇÃO DE PREPARAÇÃO
                try {
                    await prepararRodada(next.rodada_id, salaId);
                } catch (err) {
                    console.error(`[TIMER->PREPARAR_RODADA] Falha ao preparar rodada ${next.rodada_id}:`, err);
                    io.to(salaId).emit('app:error', { context: 'preparar-rodada', message: 'Falha ao preparar próxima rodada.' });
                    return; // Não continua se a preparação falhar
                }
                
                // Código para iniciar a próxima rodada
                console.log(`[TIMER->NEXT_ROUND] Iniciando próxima rodada ${next.rodada_id} para sala ${salaId}`);
                // Atualiza status da próxima rodada para 'in_progress'
                await supa.from('rodada').update({ status: 'in_progress' }).eq('rodada_id', next.rodada_id); 
                io.to(salaId).emit('round:ready', next); // Emitir DEPOIS de preparar
                io.to(salaId).emit('round:started', { roundId: next.rodada_id, duration: duration }); // Usar a mesma duração
                scheduleRoundCountdown({ salaId: salaId, roundId: next.rodada_id, duration: duration }); 
            }, 10000); // Delay de 10 segundos (10000ms)
        } else { 
          // --- LÓGICA DE FIM DE PARTIDA E MOEDAS (TIMER) ---
          const winnerInfo = computeWinner(payload.totais); 
          const todosJogadoresIds = Object.keys(payload.totais || {}).map(Number); 

          // Adicionar Moedas pela participação/vitória/empate
          for (const jId of todosJogadoresIds) {
              let moedasGanhas = MOEDAS_PARTICIPACAO; 
              if (winnerInfo?.empate && winnerInfo.jogadores.includes(jId)) { 
                  moedasGanhas += MOEDAS_EMPATE; 
              } else if (!winnerInfo?.empate && winnerInfo?.jogador_id === jId) { 
                  moedasGanhas += MOEDAS_VITORIA; 
              }
              await adicionarMoedas(jId, moedasGanhas); // (NOVO) Chama a função de inventário
          }

          // ATUALIZA STATUS DA SALA PARA 'closed'
          console.log(`[TIMER->MATCH_END] Atualizando sala ${salaId} para 'closed'`);
          const { error: updateSalaError } = await supa
            .from('sala') 
            .update({ status: 'closed' }) // Novo status
            .eq('sala_id', salaId); 
          if (updateSalaError) {
              console.error(`[TIMER] Erro ao atualizar status da sala ${salaId} para closed:`, updateSalaError);
          }

          io.to(salaId).emit('match:end', { 
                totais: payload.totais, // Envia totais
                vencedor: winnerInfo // Envia info do vencedor
          });
          console.log(`[TIMER->MATCH_END] Fim de partida para sala ${salaId}`); 
          // ----------------------------------------------------
        }
      } catch (e) {
         console.error(`[TIMER ${salaId} ${roundId}] Error during countdown end:`, e);
         io.to(salaId).emit('app:error', { context: 'timer-end', message: e.message }); 
      }
    }
  }, 1000); 

  // Armazena o timer atual
  roomTimers.set(salaId, { interval, endsAt, roundId }); 
}


export function initSockets(httpServer) { 
  io = new Server(httpServer, { cors: { origin: '*' } }); 

  // Middleware de Autenticação Socket.IO (pega token da handshake)
  io.use((socket, next) => { 
    const token = socket.handshake.auth.token; 
    if (!token) { 
      console.warn("Socket connection attempt without token");
      return next(new Error('Authentication error: Token missing'));
    }
    try {
      // O 'sub' no token DEVE ser o 'jogador_id' da tabela 'jogador'
      const payload = jwt.verify(token, JWT_SECRET); 
      socket.data.jogador_id = payload.sub; 
      console.log(`Socket authenticated for jogador_id: ${socket.data.jogador_id}`);
      next();
    } catch (err) { 
      console.warn(`Socket connection attempt with invalid token: ${err.message}`);
      return next(new Error('Authentication error: Invalid token')); 
    }
  });

  io.on('connection', (socket) => { 
    console.log('a user connected:', socket.id, 'jogador_id:', socket.data.jogador_id); 

    // =======================================================
    // === (ALTERADO) 'join-room' (POPULANDO 'jogador_sala') ===
    // =======================================================
    socket.on('join-room', async (salaId) => { // 1. Torne a função async
        salaId = String(salaId); 
        const jogadorId = socket.data.jogador_id; 

        console.log(`Socket ${socket.id} (jogador ${jogadorId}) joining room ${salaId}`);

        // --- INÍCIO DA LÓGICA DE RECONEXÃO --- (Manter o código existente)
        if (disconnectTimers.has(jogadorId)) {
            clearTimeout(disconnectTimers.get(jogadorId));
            disconnectTimers.delete(jogadorId);
            console.log(`[RECONNECT] Jogador ${jogadorId} reconectou. Timer de desconexão cancelado.`);
        }
        // --- FIM DA LÓGICA DE RECONEXÃO ---
        
        // --- (NOVO) POPULAR A TABELA 'jogador_sala' ---
        try {
            const { data: jogadorSalaData, error } = await supa
                .from('jogador_sala')
                .insert({
                    jogador_id: jogadorId,
                    sala_id: Number(salaId),
                    status_jogador: 'jogando' // ou 'esperando' dependendo da lógica
                })
                .select('jogador_sala_id') // Pega o ID de volta
                .single(); // Espera um único resultado

            if (error) {
                // Se for erro de violação de constraint (PK ou UK), o jogador já está na sala
                if (error.code === '23505') { // unique_violation
                    console.log(`[JOIN-ROOM] Jogador ${jogadorId} já estava na sala ${salaId}.`);
                    // Busca o ID existente para armazenar no socket
                    const { data: existingData, error: fetchError } = await supa
                        .from('jogador_sala')
                        .select('jogador_sala_id')
                        .eq('jogador_id', jogadorId)
                        .eq('sala_id', Number(salaId))
                        .single();
                    if (fetchError) throw fetchError;
                    socket.data.jogador_sala_id = existingData.jogador_sala_id; // 2. Armazena o ID existente
                } else {
                    throw error; // Lança outros erros
                }
            } else {
                // Se foi um novo insert, armazena o novo ID
                socket.data.jogador_sala_id = jogadorSalaData.jogador_sala_id; // 2. Armazena o novo ID
                console.log(`[JOIN-ROOM] Jogador ${jogadorId} inserido em jogador_sala. ID: ${jogadorSalaData.jogador_sala_id}`);
            }
        } catch (err) {
            console.error(`[JOIN-ROOM] Erro ao inserir em jogador_sala:`, err.message);
            socket.emit('app:error', { context: 'join-room', message: 'Erro ao registrar entrada na sala.' });
            return; // Impede de continuar se a inserção falhar
        }
        // --- FIM DA NOVA LÓGICA ---

        socket.join(salaId); 
        socket.data.salaId = salaId; 
        socket.emit('joined', { salaId }); 
    });
    // =======================================================
    // === FIM DA ALTERAÇÃO EM 'join-room' ===
    // =======================================================
    
    // =======================================================
    // === (NOVO) Handler para salvar respostas ===
    // =======================================================
    socket.on('round:submit_answers', async ({ rodadaId, answers }) => {
        try {
            const jogadorId = socket.data.jogador_id;
            const jogadorSalaId = socket.data.jogador_sala_id; // Pegamos no 'join-room'
            
            if (!jogadorSalaId) {
                 console.warn(`[SUBMIT] Jogador ${jogadorId} sem jogador_sala_id. Socket pode ter reconectado.`)
                 // Tenta buscar o ID de novo
                 const { data: jsData, error: jsError } = await supa.from('jogador_sala')
                    .select('jogador_sala_id')
                    .eq('jogador_id', jogadorId)
                    .eq('sala_id', Number(socket.data.salaId))
                    .single();
                 if (jsError || !jsData) throw new Error('Referência de jogador_sala não encontrada.');
                 socket.data.jogador_sala_id = jsData.jogador_sala_id;
            }

            // 1. Achar o 'jogador_sala_rodada_id'
            const { data: jsrData, error: jsrError } = await supa
                .from('jogador_sala_rodada')
                .select('jogador_sala_rodada_id')
                .eq('jogador_sala', socket.data.jogador_sala_id)
                .eq('rodada_id', rodadaId)
                .single();
            if (jsrError || !jsrData) throw new Error(`Participação na rodada ${rodadaId} não encontrada para jogador ${jogadorId}.`);
            
            const jsrId = jsrData.jogador_sala_rodada_id;

            // 2. Achar os 'rodada_tema_id' (para mapear tema_id -> rodada_tema_id)
            const { data: temasData, error: temasError } = await supa
                .from('rodada_tema')
                .select('rodada_tema_id, tema_id') // Pega o tema_id
                .eq('rodada_id', rodadaId);
            if (temasError) throw temasError;

            // 3. Preparar os 'updates'
            // 'answers' vem como { [temaId]: "resposta" }
            const updates = [];
            for (const temaId in answers) {
                const resposta = answers[temaId] || '';
                const temaMatch = temasData.find(t => t.tema_id == temaId); // Compara tema_id
                
                if (temaMatch) {
                    updates.push({
                        // Chaves de conflito
                        jogador_sala_rodada_id: jsrId,
                        rodada_tema_id: temaMatch.rodada_tema_id,
                        // Dados para atualizar
                        resposta_do_jogador: resposta,
                        resposta_do_jogador_normalizada: normalize(resposta), // Use a função normalize
                        data_hora_submissao: new Date().toISOString()
                    });
                }
            }

            if (updates.length === 0) {
                 console.log(`[SUBMIT] Jogador ${jogadorId} não enviou respostas válidas para rodada ${rodadaId}.`);
                 return;
            }
            
            // 4. Fazer Upsert (Atualiza ou insere)
            const { error: upsertError } = await supa
                .from('participacao_rodada_tema')
                .upsert(updates, { onConflict: 'jogador_sala_rodada_id, rodada_tema_id' }); // Conflito na chave única

            if (upsertError) throw upsertError;

            console.log(`[SUBMIT] Jogador ${jogadorId} salvou ${updates.length} respostas para rodada ${rodadaId}.`);
        } catch(e) {
            console.error(`[SUBMIT] Erro ao salvar respostas:`, e.message);
            socket.emit('app:error', { context: 'submit-answers', message: 'Falha ao salvar respostas.' });
        }
    });

    socket.on('round:stop', async ({ salaId, roundId, by }) => { 
       try { 
        salaId = String(salaId || socket.data.salaId); 
        roundId = Number(roundId); 
        const stoppedBy = by || socket.data.jogador_id; 

        if (!salaId || !roundId) { /* Não fazer nada se IDs inválidos */ return; } 
        
        // Verifica se JÁ FOI PONTUADO antes de fazer qualquer coisa
        if (alreadyScored(salaId, roundId)) {
            console.warn(`[STOP] Rodada ${roundId} já foi pontuada. Buscando resultados existentes para mostrar placar.`);
            // (ALTERADO) Busca os resultados já calculados (nova função)
            const payload = await getRoundResults({ salaId, roundId });
            io.to(salaId).emit('round:end', payload);
            
            // Continua com a lógica de próxima rodada
            const next = await getNextRoundForSala({ salaId, afterRoundId: roundId });
            if (next) {
                console.log(`[STOP->NEXT_ROUND] Aguardando 10 segundos antes de iniciar próxima rodada ${next.rodada_id} para sala ${salaId}`);
                setTimeout(async () => {
                    const nextCheck = await getNextRoundForSala({ salaId, afterRoundId: roundId });
                    if (!nextCheck || nextCheck.rodada_id !== next.rodada_id) {
                        console.log(`[STOP->NEXT_ROUND] Próxima rodada mudou durante o delay, abortando.`);
                        return;
                    }
                    
                    // (NOVO) CHAMA A FUNÇÃO DE PREPARAÇÃO
                    try {
                        await prepararRodada(next.rodada_id, salaId);
                    } catch (err) {
                        console.error(`[STOP->PREPARAR_RODADA] Falha ao preparar rodada ${next.rodada_id}:`, err);
                        io.to(salaId).emit('app:error', { context: 'preparar-rodada', message: 'Falha ao preparar próxima rodada.' });
                        return; // Não continua se a preparação falhar
                    }
                    
                    console.log(`[STOP->NEXT_ROUND] Iniciando próxima rodada ${next.rodada_id} para sala ${salaId}`);
                    await supa.from('rodada').update({ status: 'in_progress' }).eq('rodada_id', next.rodada_id);
                    io.to(salaId).emit('round:ready', next); // Emitir DEPOIS de preparar
                    const qTempo = await supa.from('rodada').select('tempo:tempo_id(valor)').eq('rodada_id', roundId).single();
                    const duration = qTempo.data?.tempo?.valor || 20;
                    io.to(salaId).emit('round:started', { roundId: next.rodada_id, duration: duration });
                    scheduleRoundCountdown({ salaId: salaId, roundId: next.rodada_id, duration: duration });
                }, 10000);
            }
            return; // Retorna aqui para não processar novamente
        }

        console.log(`[CLICK STOP] sala=${salaId} round=${roundId} by=${stoppedBy}`); 
        io.to(salaId).emit('round:stopping', { roundId, by: stoppedBy }); 

        // Limpa o timer imediatamente para evitar que ele também tente pontuar
        clearTimerForSala(salaId); 
        await sleep(GRACE_MS); 

        // Re-verifica se pontuou durante o sleep (caso MUITO raro de concorrência extrema)
         if (scoredRounds.has(`${salaId}-${roundId}`)) {
             console.warn(`[STOP] Rodada ${roundId} já foi pontuada durante GRACE_MS (concorrência?). Buscando resultados existentes.`);
             // (ALTERADO) Busca os resultados já calculados (nova função)
             const payload = await getRoundResults({ salaId, roundId });
             io.to(salaId).emit('round:end', payload);
             
             // Continua com a lógica de próxima rodada
             const next = await getNextRoundForSala({ salaId, afterRoundId: roundId });
             if (next) {
                 // Aguarda 10 segundos antes de iniciar a próxima rodada
                 console.log(`[STOP->NEXT_ROUND] Aguardando 10 segundos antes de iniciar próxima rodada ${next.rodada_id} para sala ${salaId}`);
                 setTimeout(async () => {
                     const nextCheck = await getNextRoundForSala({ salaId, afterRoundId: roundId });
                     if (!nextCheck || nextCheck.rodada_id !== next.rodada_id) {
                         console.log(`[STOP->NEXT_ROUND] Próxima rodada mudou durante o delay, abortando.`);
                         return;
                     }
                     
                     // (NOVO) CHAMA A FUNÇÃO DE PREPARAÇÃO
                     try {
                        await prepararRodada(next.rodada_id, salaId);
                     } catch (err) {
                        console.error(`[STOP->PREPARAR_RODADA] Falha ao preparar rodada ${next.rodada_id}:`, err);
                        io.to(salaId).emit('app:error', { context: 'preparar-rodada', message: 'Falha ao preparar próxima rodada.' });
                        return; // Não continua se a preparação falhar
                     }
                     
                     console.log(`[STOP->NEXT_ROUND] Iniciando próxima rodada ${next.rodada_id} para sala ${salaId}`);
                     await supa.from('rodada').update({ status: 'in_progress' }).eq('rodada_id', next.rodada_id); 
                     io.to(salaId).emit('round:ready', next); // Emitir DEPOIS de preparar
                     const qTempo = await supa.from('rodada').select('tempo:tempo_id(valor)').eq('rodada_id', roundId).single();
                     const duration = qTempo.data?.tempo?.valor || 20;
                     io.to(salaId).emit('round:started', { roundId: next.rodada_id, duration: duration });
                     scheduleRoundCountdown({ salaId: salaId, roundId: next.rodada_id, duration: duration });
                 }, 10000);
             }
             return; // Retorna aqui para não processar novamente
         }

        // (ALTERADO) endRoundAndScore agora usa o novo schema
        const payload = await endRoundAndScore({ 
          salaId, 
          roundId, 
          skippedWordsSet: getSkippedWords(salaId, roundId),
          disregardedOpponentWordsSet: getDisregardedOpponentWords(salaId, roundId)
        }); 

        // Limpa as palavras puladas após pontuar
        clearSkippedWords(salaId, roundId);
        // Limpa as palavras desconsideradas do oponente após pontuar
        clearDisregardedOpponentWords(salaId, roundId);

        // --- LÓGICA DE REVELAÇÃO (APÓS PONTUAÇÃO - igual ao timer) ---
        // (ALTERADO) Query de busca de respostas atualizada
        const revealRequesters = getAndClearRevealRequests(salaId, roundId); 
        if (revealRequesters.size > 0) { 
            
             // (NOVA QUERY)
             const { data: respostasFinais, error: errRespostas } = await supa
                .from('participacao_rodada_tema')
                .select(`
                    resposta_do_jogador,
                    jogador_sala_rodada:jogador_sala_rodada_id (
                        rodada_id,
                        jogador_sala:jogador_sala (
                            jogador_id
                        )
                    ),
                    rodada_tema:rodada_tema_id (
                        tema:tema_id (
                            tema_nome
                        )
                    )
                `)
                .eq('jogador_sala_rodada.rodada_id', roundId); // Filtra pela rodada_id


             if (errRespostas) { 
                 console.error("[REVEAL ERRO] Falha ao buscar respostas finais:", errRespostas); 
             } else { 
                 const todosJogadoresSala = await getJogadoresDaSala(salaId); 

                 for (const requesterId of revealRequesters) { 
                     const oponentesIds = todosJogadoresSala.filter(id => id !== requesterId); 
                     if (oponentesIds.length > 0 && respostasFinais && respostasFinais.length > 0) { 
                         const oponenteAlvoId = oponentesIds[Math.floor(Math.random() * oponentesIds.length)]; 
                         
                          // (NOVO) Mapeia a estrutura da nova query
                         const respostasMapeadas = respostasFinais
                             .map(r => ({
                                 jogador_id: r.jogador_sala_rodada?.jogador_sala?.jogador_id,
                                 tema_nome: r.rodada_tema?.tema?.tema_nome,
                                 resposta: r.resposta_do_jogador
                             }))
                             .filter(r => 
                                 r.jogador_id === oponenteAlvoId && 
                                 r.resposta && 
                                 r.resposta.trim() !== ''
                             );
                         
                         const respostasOponente = respostasMapeadas; // Usa os dados mapeados

                         if (respostasOponente.length > 0) { 
                             const respostaRevelada = respostasOponente[Math.floor(Math.random() * respostasOponente.length)]; 
                             const requesterSocketId = await getSocketIdByPlayerId(requesterId); 
                             if (requesterSocketId) { 
                                 io.to(requesterSocketId).emit('effect:answer_revealed', { 
                                     temaNome: respostaRevelada.tema_nome, 
                                     resposta: respostaRevelada.resposta, 
                                     oponenteId: oponenteAlvoId 
                                 });
                                 console.log(`[REVEAL] Resposta enviada para jogador ${requesterId} (socket ${requesterSocketId})`); 
                             } else { console.warn(`[REVEAL] Socket não encontrado para jogador ${requesterId}`); } 
                         } else { 
                              console.log(`[REVEAL] Oponente ${oponenteAlvoId} não teve respostas válidas para revelar.`); 
                               const requesterSocketId = await getSocketIdByPlayerId(requesterId); 
                                if (requesterSocketId) io.to(requesterSocketId).emit('powerup:info', { message: 'Nenhuma resposta válida do oponente para revelar.'}); 
                         }
                     } else { console.log(`[REVEAL] Não há oponentes ou respostas para revelar para jogador ${requesterId}.`); } 
                 }
             }
        }
        // --- FIM LÓGICA REVELAÇÃO ---

        io.to(salaId).emit('round:end', payload); // Emite resultado NORMALMENTE

        const next = await getNextRoundForSala({ salaId, afterRoundId: roundId }); 
        if (next) { 
            // Aguarda 10 segundos antes de iniciar a próxima rodada
            console.log(`[STOP->NEXT_ROUND] Aguardando 10 segundos antes de iniciar próxima rodada ${next.rodada_id} para sala ${salaId}`);
            setTimeout(async () => {
                // Verifica se ainda existe próxima rodada (pode ter mudado durante o delay)
                const nextCheck = await getNextRoundForSala({ salaId, afterRoundId: roundId });
                if (!nextCheck || nextCheck.rodada_id !== next.rodada_id) {
                    console.log(`[STOP->NEXT_ROUND] Próxima rodada mudou durante o delay, abortando.`);
                    return;
                }
                
                 // (NOVO) CHAMA A FUNÇÃO DE PREPARAÇÃO
                 try {
                    await prepararRodada(next.rodada_id, salaId);
                 } catch (err) {
                    console.error(`[STOP->PREPARAR_RODADA] Falha ao preparar rodada ${next.rodada_id}:`, err);
                    io.to(salaId).emit('app:error', { context: 'preparar-rodada', message: 'Falha ao preparar próxima rodada.' });
                    return; // Não continua se a preparação falhar
                 }
                 
                // Código para iniciar a próxima rodada
                console.log(`[STOP->NEXT_ROUND] Iniciando próxima rodada ${next.rodada_id} para sala ${salaId}`);
                await supa.from('rodada').update({ status: 'in_progress' }).eq('rodada_id', next.rodada_id); 
                io.to(salaId).emit('round:ready', next); // Emitir DEPOIS de preparar
                // Precisa pegar a duração original da rodada anterior ou ter um padrão
                const qTempo = await supa.from('rodada').select('tempo:tempo_id(valor)').eq('rodada_id', roundId).single(); 
                const duration = qTempo.data?.tempo?.valor || 20; // Default 20s
                io.to(salaId).emit('round:started', { roundId: next.rodada_id, duration: duration }); 
                scheduleRoundCountdown({ salaId: salaId, roundId: next.rodada_id, duration: duration }); 
            }, 10000); // Delay de 10 segundos (10000ms)
        } else { 
          // --- LÓGICA DE FIM DE PARTIDA E MOEDAS (STOP) ---
          const winnerInfo = computeWinner(payload.totais); 
          const todosJogadoresIds = Object.keys(payload.totais || {}).map(Number); 
          // Adicionar Moedas
          for (const jId of todosJogadoresIds) {
              let moedasGanhas = MOEDAS_PARTICIPACAO; 
              if (winnerInfo?.empate && winnerInfo.jogadores.includes(jId)) { 
                  moedasGanhas += MOEDAS_EMPATE; 
              } else if (!winnerInfo?.empate && winnerInfo?.jogador_id === jId) { 
                  moedasGanhas += MOEDAS_VITORIA; 
              }
              await adicionarMoedas(jId, moedasGanhas); // (NOVO) Chama a função de inventário
          }

          // ATUALIZA STATUS DA SALA PARA 'closed'
          console.log(`[STOP->MATCH_END] Atualizando sala ${salaId} para 'closed'`);
          const { error: updateSalaStopError } = await supa
            .from('sala') 
            .update({ status: 'closed' }) // Novo status
            .eq('sala_id', salaId); 
          if (updateSalaStopError) {
               console.error(`[STOP] Erro ao atualizar status da sala ${salaId} para closed:`, updateSalaStopError);
          }

          io.to(salaId).emit('match:end', { 
                 totais: payload.totais, 
                 vencedor: winnerInfo 
          });
          console.log(`[STOP->MATCH_END] Fim de partida para sala ${salaId}`); 
          // --------------------------------------------------
        }
      } catch (e) {
          console.error(`[STOP ${salaId} ${roundId}] Error during stop handling:`, e);
          io.to(salaId).emit('app:error', { context: 'stop-handler', message: e.message }); 
      }
    });

    // =======================================================
    // === (SUBSTITUÍDO) Handler para usar power-up (Passo 2.4) ===
    // =======================================================
    socket.on('powerup:use', async ({ powerUpId, targetPlayerId = null, targetTemaNome = null }) => {
        const salaId = socket.data.salaId;
        const usuarioJogadorId = socket.data.jogador_id;
        const currentRoundId = roomTimers.get(salaId)?.roundId;
        
        // 'powerUpId' (vindo do frontend) agora é o 'item_id' do power-up
        const itemIdDoPowerUp = powerUpId; 

        if (!usuarioJogadorId || !salaId || !itemIdDoPowerUp || !currentRoundId) {
             socket.emit('powerup:error', { message: 'Faltando parâmetros ou fora da rodada.' });
             return;
        }

        // --- (NOVO) Lógica de Consumo do Inventário ---
        try {
            // 1. Busca o 'codigo_identificador' (efeito) do item
            const { data: itemData, error: itemError } = await supa
                .from('item')
                .select('codigo_identificador, nome')
                .eq('item_id', itemIdDoPowerUp)
                .eq('tipo', 'POWERUP') // Garante que é um power-up
                .single();
                
            if (itemError || !itemData) throw new Error('Power-up não encontrado.');
            
            const efeito = itemData.codigo_identificador;
            const nomeItem = itemData.nome;

            // 2. Achar o 'jogador_sala_rodada_id' (necessário para 'consumo_item')
            // Garante que o jogador_sala_id está no socket (pode sumir em reconexões)
            if (!socket.data.jogador_sala_id) {
                 const { data: jsData, error: jsError } = await supa.from('jogador_sala')
                    .select('jogador_sala_id')
                    .eq('jogador_id', usuarioJogadorId)
                    .eq('sala_id', Number(salaId))
                    .single();
                 if (jsError || !jsData) throw new Error('Referência de jogador_sala não encontrada.');
                 socket.data.jogador_sala_id = jsData.jogador_sala_id;
            }
            
            const { data: jsrData, error: jsrError } = await supa
                .from('jogador_sala_rodada')
                .select('jogador_sala_rodada_id')
                .eq('jogador_sala', socket.data.jogador_sala_id) // ID pego no 'join-room'
                .eq('rodada_id', currentRoundId)
                .single();

            if (jsrError || !jsrData) throw new Error('Participação na rodada não encontrada.');
            const jogadorSalaRodadaId = jsrData.jogador_sala_rodada_id;

            // 3. (NOVO) Chamar a RPC para consumir o item ATOMICAMENTE
            // (Esta é a procedure 'consumir_item_inventario' que você criou)
            const { data: consumoSucesso, error: consumoError } = await supa.rpc('consumir_item_inventario', {
                p_jogador_id: usuarioJogadorId,
                p_item_id: itemIdDoPowerUp
            });

            if (consumoError) throw consumoError;
            
            // Se a RPC retornar false (ou 0), o jogador não tem o item
            if (consumoSucesso !== true) {
                socket.emit('powerup:error', { message: `Você não possui o item: ${nomeItem}` });
                return;
            }

            // 4. (NOVO) Registrar o consumo na tabela 'consumo_item' (AGORA FUNCIONA!)
            const { error: logError } = await supa
                .from('consumo_item')
                .insert({
                    jogador_sala_rodada_id: jogadorSalaRodadaId,
                    item_id: itemIdDoPowerUp, // Agora 'item_id' é o ID correto
                    qtde: 1
                });
            // Se o log falhar, não paramos o jogo, apenas registramos no console
            if (logError) console.error("[consumo_item] Erro ao logar consumo:", logError.message);

            // --- Fim da verificação/decremento ---

            // Emite evento para o cliente atualizar o inventário visualmente
            socket.emit('inventory:updated');
            
            console.log(`[powerup:use] Sucesso: Jogador ${usuarioJogadorId} usou ${efeito} na sala ${salaId}, rodada ${currentRoundId}`);

            // 6. Aplicar o efeito (Switch 'efeito')
            // Esta lógica é copiada do seu arquivo original e DEVE FUNCIONAR
            // pois ela se baseia no 'efeito' (codigo_identificador)
            switch (efeito) {
              case 'BLUR_OPPONENT_SCREEN_5S': //
              case 'JUMPSCARE': // Alias para o mesmo efeito
                // Emite para todos os outros na sala com duração de 3 segundos
                socket.to(salaId).emit('effect:jumpscare', { attackerId: usuarioJogadorId, duration: 3 /*, image, sound */ }); //
                socket.emit('powerup:ack', { codigo: efeito, message: 'Jumpscare enviado! Oponente ficará bloqueado por 3s' }); // Confirma para quem usou //
                break;
              case 'SKIP_OWN_CATEGORY': //
                // Emite apenas para o socket que usou o power-up
                socket.emit('effect:enable_skip', { powerUpId: itemIdDoPowerUp }); // (Envia o item_id)
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
                // (Esta lógica já foi atualizada no passo anterior, está correta)
                try {
                  const todosJogadores = await getJogadoresDaSala(salaId);
                  const oponentesIds = todosJogadores.filter(id => id !== usuarioJogadorId);
                  
                  if (oponentesIds.length === 0) {
                    socket.emit('powerup:error', { message: 'Não há oponentes na sala para afetar.' });
                    return;
                  }
                  
                  let targetId = targetPlayerId ? Number(targetPlayerId) : oponentesIds[Math.floor(Math.random() * oponentesIds.length)];
                  
                  if (!oponentesIds.includes(targetId)) {
                    targetId = oponentesIds[0]; // Fallback
                  }
                  
                  // Lógica de update para o novo schema
                  const { data: jsData, error: jsError } = await supa
                    .from('jogador_sala')
                    .select('jogador_sala_id')
                    .eq('jogador_id', targetId)
                    .eq('sala_id', salaId)
                    .single();
                  if (jsError || !jsData) throw new Error('Jogador_sala do alvo não encontrado.');

                  const { data: jsrData, error: jsrError } = await supa
                    .from('jogador_sala_rodada')
                    .select('jogador_sala_rodada_id')
                    .eq('jogador_sala', jsData.jogador_sala_id)
                    .eq('rodada_id', currentRoundId)
                    .single();
                  if (jsrError || !jsrData) throw new Error('Participação da rodada do alvo não encontrada.');

                  const { error: clearError } = await supa
                    .from('participacao_rodada_tema')
                    .update({ 
                        resposta_do_jogador: null,
                        resposta_do_jogador_normalizada: null,
                        data_hora_submissao: new Date().toISOString()
                    })
                    .eq('jogador_sala_rodada_id', jsrData.jogador_sala_rodada_id);
                  
                  if (clearError) {
                    console.error('[CLEAR_ANSWERS] Erro ao limpar respostas:', clearError);
                    socket.emit('powerup:error', { message: 'Erro ao apagar respostas do adversário.' });
                    return;
                  }
                  
                  const targetSocketId = await getSocketIdByPlayerId(targetId);
                  if (targetSocketId) {
                    io.to(targetSocketId).emit('effect:clear_answers', { attackerId: usuarioJogadorId });
                    socket.emit('powerup:ack', { codigo: efeito, message: `Campos do adversário foram apagados!` });
                    console.log(`[CLEAR_ANSWERS] Jogador ${usuarioJogadorId} apagou respostas de ${targetId}`);
                  } else {
                    socket.emit('powerup:ack', { codigo: efeito, message: `Campos do adversário foram apagados!` });
                    console.log(`[CLEAR_ANSWERS] Respostas de ${targetId} apagadas (jogador offline)`);
                  }
                } catch (err) {
                  console.error('[CLEAR_ANSWERS] Erro:', err);
                  socket.emit('powerup:error', { message: 'Erro ao apagar campos do adversário.' });
                }
                break;
              case 'SKIP_WORD': //
                try {
                  if (!targetTemaNome) {
                    socket.emit('powerup:error', { message: 'É necessário especificar qual palavra pular.' });
                    return;
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
                  addSkippedWord(salaId, currentRoundId, usuarioJogadorId, targetTemaNome);
                  socket.emit('powerup:ack', { codigo: efeito, message: `Palavra "${targetTemaNome}" foi pulada! Você ganhará pontos automaticamente.` });
                  console.log(`[SKIP_WORD] Jogador ${usuarioJogadorId} pulou palavra ${targetTemaNome} na rodada ${currentRoundId}`);
                } catch (err) {
                  console.error('[SKIP_WORD] Erro:', err);
                  socket.emit('powerup:error', { message: 'Erro ao pular palavra.' });
                }
                break;
              case 'DISREGARD_OPPONENT_WORD': //
              case 'SKIP_OPPONENT_CATEGORY': // Alias para compatibilidade
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
                      targetId = oponentesIds[0]; // Fallback
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
                    socket.emit('effect:enable_skip_opponent', { powerUpId: itemIdDoPowerUp }); // (Envia o item_id)
                  }
                } catch (err) {
                  console.error('[DISREGARD_OPPONENT_WORD] Erro:', err);
                  socket.emit('powerup:error', { message: 'Erro ao ativar desconsideração de palavra do oponente.' });
                }
                break;
                case 'SCREEN_DIRECTION_MOD': //
                  try {
                    const todosJogadores = await getJogadoresDaSala(salaId);
                    const oponentesIds = todosJogadores.filter(id => id !== usuarioJogadorId);
                    if (oponentesIds.length === 0) {
                      socket.emit('powerup:error', { message: 'Não há oponentes na sala para afetar.' });
                      return;
                    }
                    let targetId = targetPlayerId
                      ? Number(targetPlayerId)
                      : oponentesIds[Math.floor(Math.random() * oponentesIds.length)];
                    if (!oponentesIds.includes(targetId)) {
                      targetId = oponentesIds[0]; // fallback
                    }
                    const targetSocketId = await getSocketIdByPlayerId(targetId);
                    if (targetSocketId) {
                      const duration = 5000; // duração do efeito em milissegundos
                      io.to(targetSocketId).emit('effect:invert_screen', { duration, attackerId: usuarioJogadorId });
                      socket.emit('powerup:ack', {
                        codigo: efeito,
                        message: `Tela do adversário foi invertida por ${duration / 1000} segundos!`
                      });
                      console.log(`[SCREEN_DIRECTION_MOD] Jogador ${usuarioJogadorId} inverteu a tela de ${targetId} por ${duration}ms`);
                    } else {
                      socket.emit('powerup:error', { message: 'Oponente não está conectado.' });
                    }
                  } catch (err) {
                    console.error('[SCREEN_DIRECTION_MOD] Erro:', err);
                    socket.emit('powerup:error', { message: 'Erro ao aplicar o power-up de inversão de tela.' });
                  }
                  break;
              default: //
                console.warn(`[powerup:use] Efeito desconhecido: ${efeito}`); //
                socket.emit('powerup:error', { message: `Efeito não implementado: ${efeito}`}); //
            }
        } catch (e) {
            console.error(`[powerup:use ${usuarioJogadorId} ${itemIdDoPowerUp}] Error:`, e); //
            socket.emit('powerup:error', { message: e.message || 'Erro ao processar power-up.' }); //
        }
    });


    // =======================================================
    // === ALTERAÇÃO EM 'disconnect' (Manter) ===
    // =======================================================
    socket.on('disconnect', (reason) => { 
        console.log('user disconnected:', socket.id, 'jogador_id:', socket.data.jogador_id, 'reason:', reason); 
        const salaId = socket.data.salaId; 
        const jogadorId = socket.data.jogador_id; 

        if (salaId && jogadorId) {
           console.log(`[DISCONNECT] Jogador ${jogadorId} desconectou. Iniciando grace period de ${DISCONNECT_GRACE_MS}ms...`);
           
           if (disconnectTimers.has(jogadorId)) {
               clearTimeout(disconnectTimers.get(jogadorId));
           }

           const timerId = setTimeout(async () => {
               console.log(`[DISCONNECT GRACE END] Grace period de ${jogadorId} terminou. Removendo da sala ${salaId}.`);
               try {
                   // (ALTERADO) Atualiza status em vez de deletar
                   const { error } = await supa
                        .from('jogador_sala')
                        .update({ status_jogador: 'desconectado', data_hora_saida: new Date().toISOString() })
                        .match({ sala_id: salaId, jogador_id: jogadorId });
                   
                   if (error) {
                       console.error(`[DISCONNECT] Erro ao ATUALIZAR status do jogador ${jogadorId} na sala ${salaId}:`, error);
                   } else {
                       console.log(`[DISCONNECT] Jogador ${jogadorId} marcado como 'desconectado' na sala ${salaId}.`);
                       
                       // Emitir atualização de jogadores para a sala
                       const io = getIO();
                       if (io) {
                          const { data: playersData, error: playersError } = await supa.from('jogador_sala')
                              .select('jogador:jogador_id(nome_de_usuario)')
                              .eq('sala_id', salaId)
                              .eq('status_jogador', 'jogando'); // Mostra apenas quem ainda está jogando
                              
                          if (!playersError) {
                              const playerNames = (playersData || []).map(p => p.jogador?.nome_de_usuario || 'Desconhecido');
                              console.log(`[DISCONNECT] Emitindo players_updated para sala ${salaId}:`, playerNames);
                              io.to(salaId).emit('room:players_updated', { jogadores: playerNames });
                          }
                       }
                   }
               } catch (e) {
                   console.error(`[DISCONNECT] Erro catastrófico no timer de disconnect:`, e);
               }
               
               disconnectTimers.delete(jogadorId); 
           }, DISCONNECT_GRACE_MS); 

           disconnectTimers.set(jogadorId, timerId);
        }
    });
    // =======================================================
    // === FIM DA ALTERAÇÃO EM 'disconnect' ===
    // =======================================================

  });

  return io; 
}

export function getIO() { return io; } 


function computeWinner(totaisObj = {}) { 
     const entries = Object.entries(totaisObj).map(([id, total]) => [Number(id), Number(total || 0)]); 
  if (!entries.length) return null; 

  entries.sort((a, b) => b[1] - a[1]); 
  const topScore = entries[0][1]; 

  const empatados = entries.filter(([, total]) => total === topScore).map(([id]) => id); 

  if (empatados.length > 1) { 
    return { 
      empate: true, 
      jogadores: empatados, 
      total: topScore 
    };
  }

  return { 
    empate: false, 
    jogador_id: entries[0][0], 
    total: topScore 
  };
}
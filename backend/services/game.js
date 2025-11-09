// backend/services/game.js
import { supa } from './supabase.js'

/* =========================
   Utilidades
========================= */
function normalize(txt = '') {
  return String(txt)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
}

/* =========================
   Helpers de banco
========================= */

// CORRIGIDO: Adicionado 'export' para que possa ser importada
export async function getJogadoresDaSala(salaId) {
  const sId = Number(salaId)

  // A) fonte canônica
  const js = await supa
    .from('jogador_sala')
    .select('jogador_id')
    .eq('sala_id', sId)
    .order('jogador_id', { ascending: true })
  if (js.error) throw js.error
  let ids = (js.data || []).map(r => Number(r.jogador_id)).filter(Boolean)

  // B) fallback: participante_sala (REMOVIDO)

  return ids.sort((a,b) => a - b)
}


/** Core da rodada: sala + letra */
async function getRoundCore(rodadaId) {
  const r = await supa
    .from('rodada')
    .select('rodada_id, sala_id, letra_id')
    .eq('rodada_id', rodadaId)
    .maybeSingle()
  if (r.error) throw r.error
  if (!r.data) return null

  const qLetra = await supa
    .from('letra')
    .select('letra_id, letra_caractere')
    .eq('letra_id', r.data.letra_id)
    .maybeSingle()
  if (qLetra.error) throw qLetra.error

  return {
    rodada_id: r.data.rodada_id,
    sala_id: r.data.sala_id,
    letra_id: qLetra.data?.letra_id,
    letra: qLetra.data?.letra_caractere || ''
  }
}

/** Temas (id+nome) associados à rodada */
async function getRoundTemas(rodadaId) {
  const q = await supa
    .from('rodada_tema')
    .select('tema_id, tema:tema_id ( tema_nome )')
    .eq('rodada_id', rodadaId)
  if (q.error) throw q.error
  return (q.data || []).map(row => ({
    id: row.tema_id,
    nome: row.tema?.tema_nome || ''
  }))
}

/** Payload completo para o frontend */
export async function buildRoundPayload(rodadaId) {
  const core = await getRoundCore(rodadaId)
  if (!core) return null
  const temas = await getRoundTemas(rodadaId)
  return { ...core, temas }
}

// (Manter esta função, pois é usada por getRoundResults)
async function getTemasDaRodada(rodadaId) {
  const { data, error } = await supa
    .from('rodada_tema')
    .select(`
      rodada_id,
      tema_id,
      tema:tema_id ( tema_nome )
    `)
    .eq('rodada_id', rodadaId)
  if (error) throw error
  return (data || []).map(row => ({
    rodada_id: row.rodada_id,
    tema_id: row.tema_id,
    tema_nome: row.tema?.tema_nome || ''
  }))
}

async function getRodadasFromSala(salaId) {
  const { data, error } = await supa
    .from('rodada')
    .select('rodada_id, numero_da_rodada')
    .eq('sala_id', salaId)
    .order('numero_da_rodada', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getNextRoundForSala({ salaId, afterRoundId }) {
  const rounds = await getRodadasFromSala(salaId)
  if (!rounds.length) return null

  const idx = rounds.findIndex(r => r.rodada_id === afterRoundId)
  if (idx === -1) {
    // caso não encontre, retorna a primeira
    return await buildRoundPayload(rounds[0].rodada_id)
  }

  const proxima = rounds[idx + 1]
  if (!proxima) return null // 🚨 fim das rodadas

  // carrega payload completo
  return await buildRoundPayload(proxima.rodada_id)
}

/* ================================================================
   == (NOVO) FUNÇÕES DE PREPARAÇÃO DE RODADA (Passo 2 e 3) ==
================================================================ */

/**
 * Prepara uma rodada para ser jogada, populando as tabelas de participação.
 * Esta função DEVE ser chamada antes de emitir 'round:ready' ou 'round:started'.
 * @param {number} rodadaId - O ID da rodada que está começando.
 * @param {number} salaId - O ID da sala onde a rodada ocorre.
 */
export async function prepararRodada(rodadaId, salaId) {
    console.log(`[PREPARAR RODADA] Preparando rodada ${rodadaId} para sala ${salaId}`);
    
    // 1. Buscar todos os 'jogador_sala_id' ativos na sala
    const { data: jogadoresNaSala, error: errJogadores } = await supa
        .from('jogador_sala')
        .select('jogador_sala_id, jogador_id')
        .eq('sala_id', salaId)
        .eq('status_jogador', 'jogando'); // Garante que só pega jogadores ativos

    if (errJogadores) {
        console.error('[PREPARAR RODADA] Erro ao buscar jogadores na sala:', errJogadores);
        throw errJogadores;
    }
    if (!jogadoresNaSala || jogadoresNaSala.length === 0) {
        console.warn(`[PREPARAR RODADA] Nenhum jogador ativo encontrado para sala ${salaId}.`);
        return; // Nada a fazer
    }
     console.log(`[PREPARAR RODADA] Encontrados ${jogadoresNaSala.length} jogadores.`);

    // 2. Buscar todos os 'rodada_tema_id' para esta rodada
    const { data: temasDaRodada, error: errTemas } = await supa
        .from('rodada_tema')
        .select('rodada_tema_id')
        .eq('rodada_id', rodadaId);

    if (errTemas) {
        console.error('[PREPARAR RODADA] Erro ao buscar temas da rodada:', errTemas);
        throw errTemas;
    }
    if (!temasDaRodada || temasDaRodada.length === 0) {
        console.warn(`[PREPARAR RODADA] Rodada ${rodadaId} não tem temas. Abortando.`);
        return; // Nada a fazer
    }
    console.log(`[PREPARAR RODADA] Encontrados ${temasDaRodada.length} temas.`);

    // 3. Popular 'jogador_sala_rodada'
    const insertsJSR = jogadoresNaSala.map(js => ({
        jogador_sala: js.jogador_sala_id,
        rodada_id: rodadaId
    }));

    const { data: dadosJSR, error: errJSR } = await supa
        .from('jogador_sala_rodada')
        .insert(insertsJSR)
        .select('jogador_sala_rodada_id, jogador_sala') // Precisa dos IDs de volta
        .order('jogador_sala_rodada_id', { ascending: true }); // Garante ordem consistente

    if (errJSR) {
        // Lidar com o caso de já existir (ex: reconexão, F5)
        if (errJSR.code === '23505') { // unique_violation
            console.warn(`[PREPARAR RODADA] 'jogador_sala_rodada' já populado para rodada ${rodadaId}.`);
            // Se já existe, busca os dados existentes
            const { data: existingJSR, error: fetchErr } = await supa
                .from('jogador_sala_rodada')
                .select('jogador_sala_rodada_id, jogador_sala')
                .eq('rodada_id', rodadaId);
            if (fetchErr) throw fetchErr;
            // Chama o próximo passo com os dados existentes
            await popularParticipacaoTema(existingJSR, temasDaRodada);
        } else {
            console.error('[PREPARAR RODADA] Erro ao inserir em jogador_sala_rodada:', errJSR);
            throw errJSR;
        }
    } else {
         // Chama o próximo passo com os dados recém-inseridos
        await popularParticipacaoTema(dadosJSR, temasDaRodada);
    }
}

/**
 * (Função Auxiliar) Popula participacao_rodada_tema com "slots" vazios.
 * @param {Array} dadosJSR - Array de {jogador_sala_rodada_id, jogador_sala}
 * @param {Array} temasDaRodada - Array de {rodada_tema_id}
 */
async function popularParticipacaoTema(dadosJSR, temasDaRodada) {
     console.log(`[PREPARAR RODADA] Populando 'participacao_rodada_tema'...`);
     const insertsPRT = [];
     for (const jsr of dadosJSR) {
        for (const tema of temasDaRodada) {
            insertsPRT.push({
                jogador_sala_rodada_id: jsr.jogador_sala_rodada_id,
                rodada_tema_id: tema.rodada_tema_id,
                status: 'aguardando', // Status inicial
                pontos: 0,
                data_hora_validacao: new Date().toISOString() // Preenche com now()
            });
        }
     }

     if (insertsPRT.length === 0) return;

     const { error: errPRT } = await supa
        .from('participacao_rodada_tema')
        .insert(insertsPRT)
        .onConflict('jogador_sala_rodada_id, rodada_tema_id') // Evita erro se já existir
        .ignore(); // Ignora duplicatas
     
     if (errPRT) {
          // '23505' (unique_violation) é ignorado pelo onConflict
          console.error('[PREPARAR RODADA] Erro ao inserir em participacao_rodada_tema:', errPRT.message);
     }
     console.log(`[PREPARAR RODADA] 'participacao_rodada_tema' populado com ${insertsPRT.length} slots.`);
}

/* ================================================================
   == (REESCRITO) SCORING HELPERS (Passo 5) ==
================================================================ */

/**
 * Carrega o dicionário (resposta_base) para a letra da rodada
 * Retorna um mapa: { [tema_id]: Set<string_normalizada> }
 */
async function loadLexiconMap({ temaIds, letraId }) {
  if (!temaIds || !temaIds.length) return {} // Adiciona verificação
  if (!letraId) return {}; // Adiciona verificação

  const { data, error } = await supa
    .from('resposta_base')
    .select('tema_id, texto')
    .eq('letra_id', letraId)
    .in('tema_id', temaIds)
  if (error) throw error

  const map = {}
  for (const row of data || []) {
    const t = Number(row.tema_id)
    if (!map[t]) map[t] = new Set()
    map[t].add(normalize(row.texto))
  }
  return map
}

// (NOVA) Função auxiliar para buscar os dados de participação
async function getParticipacaoData(rodadaId, salaId) {
    // 1. Pega todos os 'jogador_sala_rodada_id' da rodada E mapeia para jogador_id
    const { data: jsrData, error: jsrError } = await supa
        .from('jogador_sala_rodada')
        .select('jogador_sala_rodada_id, jogador_sala!inner(jogador_id, sala_id)')
        .eq('rodada_id', rodadaId)
        .eq('jogador_sala.sala_id', salaId); // Filtra pela sala
    
    if (jsrError) throw jsrError;

    const jsrIds = jsrData.map(j => j.jogador_sala_rodada_id);
    const jogadorMap = jsrData.reduce((acc, j) => {
        acc[j.jogador_sala_rodada_id] = j.jogador_sala.jogador_id;
        return acc;
    }, {}); // Mapa de { jsr_id -> jogador_id }

    // 2. Pega todos os 'rodada_tema_id' e 'tema_nome' da rodada
    const { data: temasData, error: temasError } = await supa
        .from('rodada_tema')
        .select('rodada_tema_id, tema:tema_id(tema_id, tema_nome)')
        .eq('rodada_id', rodadaId);

    if (temasError) throw temasError;
    
    const temaMap = temasData.reduce((acc, t) => {
        acc[t.rodada_tema_id] = t.tema.tema_nome;
        return acc;
    }, {}); // Mapa de { rt_id -> tema_nome }
    const temaNomeMap = temasData.reduce((acc, t) => {
        acc[t.tema.tema_nome] = t.rodada_tema_id;
        return acc;
    }, {}); // Mapa de { tema_nome -> rt_id }

    // 3. Pega todas as respostas (participacao_rodada_tema)
    const { data: respostasData, error: respError } = await supa
        .from('participacao_rodada_tema')
        .select('resposta_id, jogador_sala_rodada_id, rodada_tema_id, resposta_do_jogador_normalizada')
        .in('jogador_sala_rodada_id', jsrIds);
    
    if (respError) throw respError;

    // 4. Monta o mapa de respostas
    // Formato: { [tema_nome]: { [jogador_id]: { resposta_norm, resposta_id } } }
    const mapaRespostas = {};
    for (const tema of temasData) {
        mapaRespostas[tema.tema.tema_nome] = {};
    }

    for (const resp of respostasData) {
        const temaNome = temaMap[resp.rodada_tema_id];
        const jogadorId = jogadorMap[resp.jogador_sala_rodada_id];
        if (temaNome && jogadorId) {
            mapaRespostas[temaNome][jogadorId] = {
                norm: resp.resposta_do_jogador_normalizada || '',
                resposta_id: resp.resposta_id // ID da linha em 'participacao_rodada_tema'
            };
        }
    }
    return { mapaRespostas, temaMap, temaNomeMap, jogadorMap, jsrIds, temasData };
}

// (NOVA) Função para salvar a pontuação
async function saveNewPontuacao(updates) {
    // 'updates' deve ser um array de { resposta_id: id, pontos: p }
    const updatePromises = updates.map(u =>
        supa
            .from('participacao_rodada_tema')
            .update({ pontos: u.pontos, status: 'validada' }) // Atualiza status e pontos
            .eq('resposta_id', u.resposta_id)
    );
    
    const results = await Promise.allSettled(updatePromises);
    
    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            console.error(`[saveNewPontuacao] Erro ao salvar pontuação para resposta_id ${updates[index].resposta_id}:`, result.reason);
        }
    });
}


// (NOVA) Função para calcular totais
async function computeNewTotaisSala({ salaId }) {
    // Esta query junta 5 tabelas.
    const { data, error } = await supa
        .from('participacao_rodada_tema')
        .select(`
            pontos,
            jogador_sala_rodada:jogador_sala_rodada_id (
                jogador_sala:jogador_sala (
                    jogador_id,
                    sala_id
                )
            )
        `)
        .eq('jogador_sala_rodada.jogador_sala.sala_id', salaId); // Filtra pela sala

    if (error) throw error;
    
    const totais = {};
    for (const r of data || []) {
        if (r.pontos > 0 && r.jogador_sala_rodada?.jogador_sala?.jogador_id) {
            const jId = r.jogador_sala_rodada.jogador_sala.jogador_id;
            totais[jId] = (totais[jId] || 0) + (r.pontos || 0);
        } else if (r.jogador_sala_rodada?.jogador_sala?.jogador_id) {
            // Garante que mesmo jogador com 0 pontos apareça nos totais
            const jId = r.jogador_sala_rodada.jogador_sala.jogador_id;
            if (!(jId in totais)) {
                totais[jId] = 0;
            }
        }
    }
    return totais;
}

/* ================================================================
   == (REESCRITO) SCORING (Passo 5) ==
================================================================ */

/**
 * (REESCRITA) endRoundAndScore
 */
export async function endRoundAndScore({ salaId, roundId, skippedWordsSet = null, disregardedOpponentWordsSet = null }) {
    // 🔒 Lock (Manter código existente)
    const lock = await supa
        .from('rodada')
        .update({ status: 'scoring' })
        .eq('rodada_id', roundId)
        .in('status', ['ready', 'in_progress']) 
        .select('rodada_id')
        .maybeSingle();
    if (lock.error) throw lock.error;
    if (!lock.data) {
        console.warn(`[endRoundAndScore] Lock não adquirido ou rodada ${roundId} já em scoring/done.`);
        // (ALTERADO) Chamar a nova função de totais e a nova getRoundResults
        return await getRoundResults({ salaId, roundId });
    }

    // ==== Fluxo normal de pontuação (Novo) ====
    console.log(`[Scoring] Iniciando pontuação para rodada ${roundId} da sala ${salaId}`);

    // 1. Pega a Letra e os Temas
    const core = await getRoundCore(roundId); // { rodada_id, sala_id, letra_id, letra }
    if (!core) {
        await supa.from('rodada').update({ status: 'done' }).eq('rodada_id', roundId);
        return { roundId, roundScore: {}, totais: await computeNewTotaisSala({ salaId }) };
    }
    const letraId = core.letra_id;
    const letraNorm = normalize(core.letra);
    console.log(`[Scoring] Letra: ${letraNorm} (ID: ${letraId})`);

    const { data: temasData, error: temasError } = await supa
        .from('rodada_tema')
        .select('tema_id, tema:tema_id(tema_nome)')
        .eq('rodada_id', roundId);
    if (temasError) throw temasError;

    const temas = temasData.map(t => ({ id: t.tema.tema_id, nome: t.tema.tema_nome }));
    const temaIds = temas.map(t => t.id);
    console.log(`[Scoring] Temas: ${temas.map(t=>t.nome).join(', ')}`);

    // 2. Carrega o Dicionário
    const lexicon = await loadLexiconMap({ temaIds, letraId }); // (Função existente)

    // 3. Carrega os dados de participação (respostas, jogadores, temas)
    const { mapaRespostas, jogadorMap } = await getParticipacaoData(roundId, salaId);
    const allJogadorIds = Object.values(jogadorMap);
    console.log(`[Scoring] Jogadores na rodada: ${allJogadorIds.join(', ')}`);
    
    // 4. Prepara objetos de resultado
    const roundScore = {}; // { tema_nome: { jogador_id: pontos } }
    const updates = []; // Array para salvar no DB: { resposta_id, pontos }

    // 5. Itera sobre cada tema e calcula os pontos
    for (const t of temas) {
        const temaId = t.id;
        const temaNome = t.nome;
        const set = lexicon[temaId] || new Set(); // Dicionário para este tema/letra

        const temaRespostas = {}; // { jogador_id: { norm, resposta_id, valida, pontos } }
        const validos = {}; // { resposta_normalizada: [jogador_id1, jogador_id2] }

        // a. Coleta e valida as respostas
        for (const jId of allJogadorIds) {
            const respData = mapaRespostas[temaNome]?.[jId];
            if (!respData) {
                console.warn(`[Scoring] Falta 'participacao_rodada_tema' para jId ${jId} e tema ${temaNome}`);
                continue;
            }

            const { norm, resposta_id } = respData;
            // Validação (Assume que 'norm' já está normalizado)
            const startsWith = letraNorm ? norm.startsWith(letraNorm) : false;
            const valida = !!norm && startsWith && set.has(norm);
            
            // Log de validação
            // console.log(`[Validar] J:${jId} T:${temaNome} R:'${norm}' SW:${startsWith} SET:${set.has(norm)} V:${valida}`);


            temaRespostas[jId] = { norm, resposta_id, valida, pontos: 0 };

            if (valida) {
                if (!validos[norm]) validos[norm] = [];
                validos[norm].push(jId);
            }
        }

        // b. Calcula os pontos (5, 10, 0)
        for (const norm in validos) {
            const jogadoresComEstaResposta = validos[norm];
            const pontos = (jogadoresComEstaResposta.length === 1) ? 10 : 5;
            for (const jId of jogadoresComEstaResposta) {
                 // Verifica se a palavra deste jogador foi desconsiderada
                const isDisregarded = disregardedOpponentWordsSet && disregardedOpponentWordsSet.has(`${jId}-${temaNome}`);
                if (!isDisregarded) {
                    temaRespostas[jId].pontos = pontos;
                } else {
                    console.log(`[DISREGARD] Palavra '${norm}' do Jogador ${jId} foi desconsiderada.`);
                }
            }
        }
        
        // c. Aplica pontos para palavras puladas (SKIP_WORD)
        if (skippedWordsSet && skippedWordsSet.size > 0) {
            for (const jId of allJogadorIds) {
                if (temaRespostas[jId] && skippedWordsSet.has(`${jId}-${temaNome}`) && temaRespostas[jId].pontos === 0) {
                    temaRespostas[jId].pontos = 10;
                    console.log(`[SKIP_WORD] Jogador ${jId} ganhou 10 pontos por pular palavra "${temaNome}"`);
                }
            }
        }

        // d. Prepara o payload de 'roundScore' e 'updates'
        roundScore[temaNome] = {};
        for (const jId of allJogadorIds) {
             if (!temaRespostas[jId]) { // Jogador pode não ter entrada de resposta (ex: entrou atrasado)
                roundScore[temaNome][jId] = 0;
                continue; 
             }
             
             const p = temaRespostas[jId].pontos;
             const rId = temaRespostas[jId].resposta_id;
             
             roundScore[temaNome][jId] = p; // Para o frontend
             updates.push({ resposta_id: rId, pontos: p }); // Para o DB
        }
    }

    // 6. Salva os pontos no DB
    console.log(`[Scoring] Salvando ${updates.length} atualizações de pontos...`);
    await saveNewPontuacao(updates);

    // 7. Calcula os totais acumulados
    const totais = await computeNewTotaisSala({ salaId });
    console.log(`[Scoring] Totais calculados:`, totais);

    // 8. ✅ Marca a rodada como concluída
    await supa.from('rodada').update({ status: 'done' }).eq('rodada_id', roundId);

    // 9. Retorna o resultado
    return { roundId, roundScore, totais };
}

// (NOVA) getRoundResults (reescrita para novo schema)
export async function getRoundResults({ salaId, roundId }) {
  try {
    console.log(`[getRoundResults] Buscando resultados para rodada ${roundId} (sala ${salaId})`);
    // 1. Pega os dados de participação
    const { mapaRespostas } = await getParticipacaoData(roundId, salaId);
    
    // 2. Busca os pontos
    const allRespostaIds = Object.values(mapaRespostas).flatMap(j => Object.values(j).map(r => r.resposta_id));
    if (allRespostaIds.length === 0) {
        console.warn(`[getRoundResults] Nenhuma resposta encontrada para rodada ${roundId}`);
        return { roundId, roundScore: {}, totais: await computeNewTotaisSala({ salaId }) };
    }

    const { data: participacoes, error } = await supa
      .from('participacao_rodada_tema')
      .select('pontos, resposta_id')
      .in('resposta_id', allRespostaIds);

    if (error) throw error;
    
    // Mapa de { resposta_id -> pontos }
    const pontosMap = participacoes.reduce((acc, p) => {
        acc[p.resposta_id] = p.pontos;
        return acc;
    }, {});

    // 3. Constrói o roundScore no formato esperado
    const roundScore = {};
    for (const temaNome in mapaRespostas) {
        roundScore[temaNome] = {};
        for (const jId in mapaRespostas[temaNome]) {
            const respId = mapaRespostas[temaNome][jId].resposta_id;
            roundScore[temaNome][jId] = pontosMap[respId] || 0;
        }
    }

    // 4. Calcula os totais
    const totais = await computeNewTotaisSala({ salaId });

    return { roundId, roundScore, totais };
  } catch (err) {
    console.error(`[getRoundResults] Erro ao buscar resultados da rodada ${roundId}:`, err);
    return { roundId, roundScore: {}, totais: await computeNewTotaisSala({ salaId }) };
  }
}


/* =========================
   Sorteio coerente (LETRA EXISTENTE - MANTER)
========================= */
export async function generateCoherentRounds({ totalRounds = 5 }) {
  // 1) Carrega toda a resposta_base (paginando para evitar limites)
  let allRows = []
  let from = 0
  const pageSize = 1000 // Limite padrão do Supabase
  while (true) {
    const { data, error } = await supa
      .from('resposta_base')
      .select('tema_id, letra_id')
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break // Sai se não houver mais dados
    allRows = allRows.concat(data)
    if (data.length < pageSize) break // Sai se a última página não estava cheia
    from += pageSize // Prepara para a próxima página
  }

  // 2) Monta mapa: letra_id -> Set<tema_id>
  const mapa = {}
  for (const r of allRows || []) {
    const lid = Number(r.letra_id)
    const tid = Number(r.tema_id)
    if (!mapa[lid]) mapa[lid] = new Set()
    mapa[lid].add(tid)
  }

  // 3) Filtra letras que têm pelo menos 4 temas associados com respostas
  const letrasValidas = Object.entries(mapa)
    .filter(([_, temasSet]) => temasSet.size >= 4)
    .map(([lid]) => Number(lid)) // Pega apenas os IDs das letras

  // Verifica se há letras suficientes para o número de rodadas desejado
  if (letrasValidas.length < totalRounds) {
    console.error(`[generateCoherentRounds] Banco insuficiente: Encontradas ${letrasValidas.length} letras com >=4 temas, mas são necessárias ${totalRounds}.`);
    // Poderia retornar um erro ou tentar gerar com menos rodadas?
    // Por enquanto, lança um erro para indicar o problema.
    throw new Error('Banco insuficiente: faltam letras com >=4 temas para gerar as rodadas.')
  }

  // 4) Embaralha as letras válidas e seleciona o número necessário (sem repetição)
  const pool = [...letrasValidas]
  for (let i = pool.length - 1; i > 0; i--) { // Algoritmo Fisher-Yates shuffle
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const letrasEscolhidas = pool.slice(0, totalRounds) // Pega as primeiras 'totalRounds' letras embaralhadas

  // 5) Busca nomes das letras e temas para usar no payload final
  const { data: letrasTbl, error: eL } = await supa
    .from('letra')
    .select('letra_id, letra_caractere')
    .in('letra_id', letrasEscolhidas) // Otimiza buscando só as letras escolhidas
  if (eL) throw eL

  const { data: temasTbl, error: eT } = await supa
    .from('tema')
    .select('tema_id, tema_nome')
    // Busca todos os temas, pois precisaremos deles para mapear os IDs sorteados
  if (eT) throw eT
  // Cria um mapa ID -> Nome para busca rápida
  const temaIdToName = temasTbl.reduce((acc, t) => { acc[t.tema_id] = t.tema_nome; return acc; }, {});

  // 6) Monta a estrutura final das rodadas
  const rounds = []
  for (const letra_id of letrasEscolhidas) {
    const temasPossiveisParaLetra = [...(mapa[letra_id] || [])] // Pega os temas válidos para esta letra
    // Embaralha os temas possíveis para esta letra
    for (let i = temasPossiveisParaLetra.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[temasPossiveisParaLetra[i], temasPossiveisParaLetra[j]] = [temasPossiveisParaLetra[j], temasPossiveisParaLetra[i]]
    }
    // Seleciona os 4 primeiros temas embaralhados
    const temasEscolhidosIds = temasPossiveisParaLetra.slice(0, 4)

    // Monta o objeto da rodada com IDs e nomes
    rounds.push({
      letra_id,
      letra_char: letrasTbl.find(l => l.letra_id === letra_id)?.letra_caractere || '?', // Busca o caractere da letra
      temas: temasEscolhidosIds.map(tid => ({
        tema_id: tid,
        tema_nome: temaIdToName[tid] || `Tema ${tid}?` // Busca o nome do tema no mapa
      }))
    })
  }

  return rounds // Retorna a lista de rodadas prontas para serem inseridas no banco
}

/* =========================
   LETRAS sem repetição (fallback antigo - manter)
========================= */
export function pickLettersNoRepeat({ total, blacklist = [] }) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(ch => !blacklist.includes(ch))
  for (let i = A.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[A[i], A[j]] = [A[j], A[i]]
  }
  return A.slice(0, total)
}
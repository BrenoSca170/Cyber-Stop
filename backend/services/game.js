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

/* =========================
   Scoring helpers
========================= */
async function ensurePlaceholders({ rodadaId, jogadores, temas }) {
  const rows = []
  for (const jog of jogadores) {
    for (const t of temas) {
      rows.push({
        rodada_id: rodadaId,
        jogador_id: jog,
        tema_nome: t.tema_nome,
        resposta: '',
        pontos: 0
      })
    }
  }
  if (!rows.length) return
  const up = await supa
    .from('participacao_rodada')
    .upsert(rows, {
      onConflict: 'rodada_id,jogador_id,tema_nome',
      ignoreDuplicates: true
    })
  if (up.error) throw up.error
}

async function loadRespostasRodada({ rodadaId, jogadores, temas }) {
  const { data, error } = await supa
    .from('participacao_rodada')
    .select('jogador_id, tema_nome, resposta, pontos')
    .eq('rodada_id', rodadaId)
    .in('jogador_id', jogadores)
    .in('tema_nome', temas.map(t => t.tema_nome))
  if (error) throw error
  const map = {}
  for (const r of data || []) {
    map[r.tema_nome] ||= {}
    map[r.tema_nome][r.jogador_id] = { resposta: r.resposta || '', pontos: r.pontos || 0 }
  }
  return map
}

async function savePontuacao({ rodadaId, temaNome, jogadorId, pontos }) {
  const { error } = await supa
    .from('participacao_rodada')
    .update({ pontos })
    .eq('rodada_id', rodadaId)
    .eq('tema_nome', temaNome)
    .eq('jogador_id', jogadorId)
  if (error) throw error
}

async function computeTotaisSala({ salaId }) {
  const qRounds = await supa
    .from('rodada')
    .select('rodada_id')
    .eq('sala_id', salaId)
  if (qRounds.error) throw qRounds.error
  const rodadaIds = (qRounds.data || []).map(r => r.rodada_id)
  if (!rodadaIds.length) return {}

  const qPart = await supa
    .from('participacao_rodada')
    .select('jogador_id, pontos, rodada_id')
    .in('rodada_id', rodadaIds)
  if (qPart.error) throw qPart.error

  const totais = {}
  for (const r of qPart.data || []) {
    totais[r.jogador_id] = (totais[r.jogador_id] || 0) + (r.pontos || 0)
  }
  return totais
}

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

/* =========================
   SCORING (com dicionário)
========================= */
/**
 * HARDENING: encerra rodada com lock e pontua com base no dicionário
 * ATUALIZADO: Lógica de pontuação refeita para N jogadores
 */
export async function endRoundAndScore({ salaId, roundId }) {
  // 🔒 Tenta ganhar o "lock" para evitar pontuação dupla
  const lock = await supa
    .from('rodada')
    .update({ status: 'scoring' })
    .eq('rodada_id', roundId)
    .in('status', ['ready', 'in_progress']) // Só pode pontuar se estava pronta ou em progresso
    .select('rodada_id')
    .maybeSingle()
  if (lock.error) throw lock.error
  if (!lock.data) {
    // Outro processo (ou o mesmo, em caso de erro anterior) já está pontuando ou já pontuou.
    console.warn(`[endRoundAndScore] Lock não adquirido ou rodada ${roundId} já em scoring/done.`);
    // Retorna os totais atuais para consistência, mas sem calcular placar da rodada novamente.
    return { roundId, roundScore: {}, totais: await computeTotaisSala({ salaId }) }
  }

  // ==== Fluxo normal de pontuação ====
  let jogadores = await getJogadoresDaSala(salaId) // Pega jogadores da tabela jogador_sala
  // Fallback: Se jogador_sala estiver vazio (ex: jogadores saíram?), pega quem participou
  if (!jogadores || jogadores.length === 0) {
    console.warn(`[endRoundAndScore] Nenhum jogador encontrado em jogador_sala para sala ${salaId}. Verificando participacao_rodada.`);
    const q = await supa
      .from('participacao_rodada')
      .select('jogador_id', { distinct: true }) // Pega IDs únicos
      .eq('rodada_id', roundId)
    if (q.error) throw q.error
    jogadores = (q.data || []).map(r => Number(r.jogador_id)).filter(Boolean).sort((a,b)=>a-b);
    if (jogadores.length === 0) {
        console.warn(`[endRoundAndScore] Nenhum jogador participou da rodada ${roundId}. Abortando pontuação.`);
        // Marca como done mesmo assim para não bloquear
        await supa.from('rodada').update({ status: 'done' }).eq('rodada_id', roundId);
        return { roundId, roundScore: {}, totais: {} }; // Retorna vazio
    }
  }

  const temas = await getTemasDaRodada(roundId) // [{rodada_id, tema_id, tema_nome}]
  if (!temas || temas.length === 0) {
      console.warn(`[endRoundAndScore] Rodada ${roundId} não tem temas associados. Abortando pontuação.`);
      await supa.from('rodada').update({ status: 'done' }).eq('rodada_id', roundId);
      return { roundId, roundScore: {}, totais: await computeTotaisSala({ salaId }) };
  }
  
  // Garante que existe uma linha em participacao_rodada para cada jogador/tema
  await ensurePlaceholders({ rodadaId: roundId, jogadores, temas })

  // Carrega todas as respostas (incluindo as placeholders vazias)
  const respostas = await loadRespostasRodada({ rodadaId: roundId, jogadores, temas })

  // Pega a letra da rodada (necessário para validação e para carregar o dicionário)
  const core = await getRoundCore(roundId)
  if (!core) { // Segurança extra
      console.error(`[endRoundAndScore] Falha ao carregar core da rodada ${roundId}.`);
      // Não reverter o status 'scoring' aqui, marcar como done
      await supa.from('rodada').update({ status: 'done' }).eq('rodada_id', roundId);
      return { roundId, roundScore: {}, totais: await computeTotaisSala({ salaId }) };
  }
  const letraId = core.letra_id
  const letraChar = core.letra?.toUpperCase() || ''
  const letraNorm = normalize(letraChar); // Normaliza a letra da rodada uma vez

  // Carrega o dicionário de respostas válidas para esta letra e temas
  const temaIds = temas.map(t => t.tema_id)
  const lexicon = await loadLexiconMap({ temaIds, letraId })

  const roundScore = {} // Objeto para guardar o placar desta rodada { tema_nome: { jogador_id: pontos } }
  const allJogadorIds = [...jogadores] // Lista de IDs de todos os jogadores na sala/participantes

  // Itera sobre cada tema da rodada
  for (const t of temas) {
    const temaId = t.tema_id
    const temaNome = t.tema_nome
    const set = lexicon[temaId] || new Set() // Dicionário para este tema/letra

    const temaRespostas = {} // { jogador_id: { resposta, norm, valida, pontos } }
    const validos = {} // { resposta_normalizada: [jogador_id1, jogador_id2] } -> Agrupa quem deu a mesma resposta válida

    // 1. Coleta e valida as respostas de TODOS os jogadores para este tema
    for (const jId of allJogadorIds) {
      const resposta = respostas[temaNome]?.[jId]?.resposta || '' // Pega a resposta do mapa carregado
      const norm = normalize(resposta) // Normaliza a resposta
      const startsWith = letraNorm ? norm.startsWith(letraNorm) : false // Verifica se começa com a letra (normalizada)
      const valida = !!norm && startsWith && set.has(norm) // É válida se não for vazia, começar certo e existir no dicionário

      // Armazena informações processadas
      temaRespostas[jId] = { resposta, norm, valida, pontos: 0 }

      // Se a resposta for válida, adiciona ao grupo 'validos'
      if (valida) {
        if (!validos[norm]) validos[norm] = []
        validos[norm].push(jId)
      }
    }

    // 2. Calcula os pontos com base nas respostas válidas agrupadas
    for (const norm in validos) {
      const jogadoresComEstaResposta = validos[norm]
      if (jogadoresComEstaResposta.length === 1) {
        // Se SÓ UM jogador deu esta resposta válida -> 10 pontos
        const jId = jogadoresComEstaResposta[0]
        temaRespostas[jId].pontos = 10
      } else {
        // Se MAIS DE UM jogador deu esta resposta válida -> 5 pontos para cada um
        for (const jId of jogadoresComEstaResposta) {
          temaRespostas[jId].pontos = 5
        }
      }
    }

    // 3. Salva a pontuação no banco de dados e constrói o payload 'roundScore' para o frontend
    roundScore[temaNome] = {}
    for (const jId of allJogadorIds) {
      const p = temaRespostas[jId].pontos
      // Salva a pontuação (0, 5 ou 10) na tabela 'participacao_rodada'
      await savePontuacao({ rodadaId: roundId, temaNome, jogadorId: jId, pontos: p })
      // Adiciona ao objeto que será enviado para o frontend
      roundScore[temaNome][jId] = p
    }
  }

  // Calcula os totais acumulados para todos os jogadores na sala
  const totais = await computeTotaisSala({ salaId })

  // ✅ Marca a rodada como concluída no banco de dados
  await supa.from('rodada').update({ status: 'done' }).eq('rodada_id', roundId)

  // Retorna o resultado da rodada e os totais
  return { roundId, roundScore, totais }
}


/* =========================
   Sorteio coerente (letra com >=4 temas)
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
   LETRAS sem repetição (fallback antigo - manter caso precise?)
========================= */
export function pickLettersNoRepeat({ total, blacklist = [] }) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(ch => !blacklist.includes(ch))
  for (let i = A.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[A[i], A[j]] = [A[j], A[i]]
  }
  return A.slice(0, total)
}
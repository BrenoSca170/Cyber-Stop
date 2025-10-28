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

// ATUALIZADO: Remove fallback para 'participante_sala'
async function getJogadoresDaSala(salaId) {
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
  if (!temaIds.length) return {}
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
 * ATUALIZADO: Lógica de pontuação refeita para N jogadores (em vez de apenas 2)
 */
export async function endRoundAndScore({ salaId, roundId }) {
  // 🔒 tenta ganhar o "lock"
  const lock = await supa
    .from('rodada')
    .update({ status: 'scoring' })
    .eq('rodada_id', roundId)
    .in('status', ['ready', 'in_progress'])
    .select('rodada_id')
    .maybeSingle()
  if (lock.error) throw lock.error
  if (!lock.data) {
    // outro processo já está/esteve pontuando
    return { roundId, roundScore: {}, totais: await computeTotaisSala({ salaId }) }
  }

  // ==== fluxo normal de pontuação ====
  let jogadores = await getJogadoresDaSala(salaId)
  if (jogadores.length === 0) { // Lógica de fallback se 'jogador_sala' estiver vazio mas participações existirem
    const q = await supa
      .from('participacao_rodada')
      .select('jogador_id')
      .eq('rodada_id', roundId)
    if (q.error) throw q.error
    const distinct = [...new Set((q.data || []).map(r => Number(r.jogador_id)).filter(Boolean))]
    jogadores = [...new Set([...jogadores, ...distinct])].sort((a,b)=>a-b)
  }

  const temas = await getTemasDaRodada(roundId) // [{tema_id, tema_nome}]
  await ensurePlaceholders({ rodadaId: roundId, jogadores, temas })

  const respostas = await loadRespostasRodada({ rodadaId: roundId, jogadores, temas })

  // pega letra da rodada uma única vez
  const core = await getRoundCore(roundId)
  const letraId = core?.letra_id
  const letraChar = core?.letra?.toUpperCase() || ''

  // carrega dicionário uma única vez (por letra e temas da rodada)
  const temaIds = temas.map(t => t.tema_id)
  const lexicon = await loadLexiconMap({ temaIds, letraId })

  const roundScore = {}
  const allJogadorIds = [...jogadores] // Lista de IDs de todos os jogadores

  for (const t of temas) {
    const temaId = t.tema_id
    const temaNome = t.tema_nome
    const set = lexicon[temaId] || new Set()

    const temaRespostas = {} // { jogador_id: { resposta, norm, valida, pontos } }
    const validos = {} // { resposta_normalizada: [jogador_id1, jogador_id2] }

    // 1. Coletar e validar respostas de TODOS os jogadores
    for (const jId of allJogadorIds) {
      const resposta = respostas[temaNome]?.[jId]?.resposta || ''
      const norm = normalize(resposta)
      const startsWith = norm.startsWith(normalize(letraChar))
      const valida = !!norm && startsWith && set.has(norm)

      temaRespostas[jId] = { resposta, norm, valida, pontos: 0 }

      if (valida) {
        if (!validos[norm]) validos[norm] = []
        validos[norm].push(jId)
      }
    }

    // 2. Calcular pontos com base nas respostas válidas
    for (const norm in validos) {
      const jogadoresComEstaResposta = validos[norm]
      if (jogadoresComEstaResposta.length === 1) {
        // Resposta única = 10 pontos
        const jId = jogadoresComEstaResposta[0]
        temaRespostas[jId].pontos = 10
      } else {
        // Resposta compartilhada = 5 pontos
        for (const jId of jogadoresComEstaResposta) {
          temaRespostas[jId].pontos = 5
        }
      }
    }

    // 3. Salvar pontuação de todos e construir payload de 'roundScore'
    roundScore[temaNome] = {}
    for (const jId of allJogadorIds) {
      const p = temaRespostas[jId].pontos
      await savePontuacao({ rodadaId: roundId, temaNome, jogadorId: jId, pontos: p })
      roundScore[temaNome][jId] = p
    }
  }

  const totais = await computeTotaisSala({ salaId })

  // ✅ marca rodada como concluída
  await supa.from('rodada').update({ status: 'done' }).eq('rodada_id', roundId)

  return { roundId, roundScore, totais }
}


/* =========================
   Sorteio coerente (letra com >=4 temas)
========================= */
export async function generateCoherentRounds({ totalRounds = 5 }) {
  // 1) Carrega toda a resposta_base (paginando)
  let allRows = []
  let from = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supa
      .from('resposta_base')
      .select('tema_id, letra_id')
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    allRows = allRows.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }

  // 2) Monta mapa letra -> temas
  const mapa = {}
  for (const r of allRows || []) {
    const lid = Number(r.letra_id)
    const tid = Number(r.tema_id)
    if (!mapa[lid]) mapa[lid] = new Set()
    mapa[lid].add(tid)
  }

  // 3) Filtra letras com >=4 temas possíveis
  const letrasValidas = Object.entries(mapa)
    .filter(([_, temas]) => temas.size >= 4)
    .map(([lid]) => Number(lid))

  if (letrasValidas.length < totalRounds) {
    throw new Error('Banco insuficiente: faltam letras com >=4 temas para gerar as rodadas.')
  }

  // 4) Embaralha e CAPA pelo totalRounds (letras sem repetição)
  const pool = [...letrasValidas]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const letrasEscolhidas = pool.slice(0, totalRounds)

  // 5) tabelas auxiliares (nomes)
  const { data: letrasTbl, error: eL } = await supa
    .from('letra')
    .select('letra_id, letra_caractere')
  if (eL) throw eL

  const { data: temasTbl, error: eT } = await supa
    .from('tema')
    .select('tema_id, tema_nome')
  if (eT) throw eT

  // 6) monta rounds (para cada letra escolhida, 4 temas válidos)
  const rounds = []
  for (const letra_id of letrasEscolhidas) {
    const possiveis = [...(mapa[letra_id] || [])]
    // embaralha e pega 4
    for (let i = possiveis.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[possiveis[i], possiveis[j]] = [possiveis[j], possiveis[i]]
    }
    const escolhidos = possiveis.slice(0, 4)

    rounds.push({
      letra_id,
      letra_char: letrasTbl.find(l => l.letra_id === letra_id)?.letra_caractere || '?',
      temas: escolhidos.map(tid => ({
        tema_id: tid,
        tema_nome: temasTbl.find(t => t.tema_id === tid)?.tema_nome || ''
      }))
    })
  }

  return rounds
}

/* =========================
   LETRAS sem repetição (fallback antigo)
========================= */
export function pickLettersNoRepeat({ total, blacklist = [] }) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(ch => !blacklist.includes(ch))
  for (let i = A.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[A[i], A[j]] = [A[j], A[i]]
  }
  return A.slice(0, total)
}
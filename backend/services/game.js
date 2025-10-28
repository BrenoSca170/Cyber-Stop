// backend/services/game.js
import { supa } from './supabase.js'

// ===== helpers de banco =====
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

  // B) fallback: participante_sala (se existir)
  if (ids.length < 2) {
    const ps = await supa
      .from('participante_sala')
      .select('jogador_id')
      .eq('sala_id', sId)
      .order('jogador_id', { ascending: true })
    if (ps.error && ps.error.code !== 'PGRST116') throw ps.error
    const more = (ps.data || []).map(r => Number(r.jogador_id)).filter(Boolean)
    ids = [...new Set([...ids, ...more])]
  }
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
    .select('letra_caractere')
    .eq('letra_id', r.data.letra_id)
    .maybeSingle()
  if (qLetra.error) throw qLetra.error

  return {
    rodada_id: r.data.rodada_id,
    sala_id: r.data.sala_id,
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
  let target = null
  if (!afterRoundId) target = rounds[0]
  else {
    const idx = rounds.findIndex(r => r.rodada_id === afterRoundId)
    if (idx >= 0 && idx + 1 < rounds.length) target = rounds[idx + 1]
  }
  return target ? await buildRoundPayload(target.rodada_id) : null
}

// ===== SCORING =====
function scorePair(txtA = '', txtB = '') {
  const a = (txtA || '').trim()
  const b = (txtB || '').trim()
  if (!a && !b) return [0,0]
  if (!a) return [0,10]
  if (!b) return [10,0]
  if (a.toLowerCase() === b.toLowerCase()) return [5,5]
  return [10,10]
}

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
 * HARDENING: encerra rodada com **lock no banco**
 * - ganha o lock mudando status de 'ready'/'in_progress' -> 'scoring'
 * - se não ganhar, retorna estado atual (alguém já pontuou)
 * - ao final marca 'done'
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
  if (jogadores.length < 2) {
    const q = await supa
      .from('participacao_rodada')
      .select('jogador_id')
      .eq('rodada_id', roundId)
    if (q.error) throw q.error
    const distinct = [...new Set((q.data || []).map(r => Number(r.jogador_id)).filter(Boolean))]
    jogadores = [...new Set([...jogadores, ...distinct])].sort((a,b)=>a-b)
  }

  const temas = await getTemasDaRodada(roundId)
  await ensurePlaceholders({ rodadaId: roundId, jogadores, temas })

  const respostas = await loadRespostasRodada({ rodadaId: roundId, jogadores, temas })

  const roundScore = {}
  const aId = jogadores[0]
  const bId = jogadores[1]
  for (const t of temas) {
    const aTxt = respostas[t.tema_nome]?.[aId]?.resposta || ''
    const bTxt = bId ? (respostas[t.tema_nome]?.[bId]?.resposta || '') : ''
    const [pA, pB] = scorePair(aTxt, bTxt)
    await savePontuacao({ rodadaId: roundId, temaNome: t.tema_nome, jogadorId: aId, pontos: pA })
    if (bId) {
      await savePontuacao({ rodadaId: roundId, temaNome: t.tema_nome, jogadorId: bId, pontos: pB })
      roundScore[t.tema_nome] = { [aId]: pA, [bId]: pB }
    } else {
      roundScore[t.tema_nome] = { [aId]: pA }
    }
  }

  const totais = await computeTotaisSala({ salaId })

  // ✅ marca rodada como concluída
  await supa.from('rodada').update({ status: 'done' }).eq('rodada_id', roundId)

  return { roundId, roundScore, totais }
}

// ======= LETRAS sem repetição (usar no /matches/start) =======
export function pickLettersNoRepeat({ total, blacklist = [] }) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(ch => !blacklist.includes(ch))
  for (let i = A.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[A[i], A[j]] = [A[j], A[i]]
  }
  return A.slice(0, total)
}

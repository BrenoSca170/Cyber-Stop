// backend/src/sockets.js
import { Server } from 'socket.io'
import { supa } from '../services/supabase.js'
import { endRoundAndScore, getNextRoundForSala } from '../services/game.js'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const GRACE_MS = 3000

let io

// ===== timers por sala =====
const roomTimers = new Map()
function clearTimerForSala(salaId) {
  const t = roomTimers.get(String(salaId))
  if (t?.interval) clearInterval(t.interval)
  roomTimers.delete(String(salaId))
}

// ===== latch anti-dupla apuração (memória) =====
const scoredRounds = new Set()
function alreadyScored(salaId, roundId) {
  const key = `${salaId}:${roundId}`
  if (scoredRounds.has(key)) return true
  scoredRounds.add(key)
  setTimeout(() => scoredRounds.delete(key), 10 * 60 * 1000)
  return false
}

// ===== agenda do contador =====
export function scheduleRoundCountdown({ salaId, roundId, duration = 20 }) {
  salaId = String(salaId)
  clearTimerForSala(salaId)

  const endsAt = Date.now() + duration * 1000
  const interval = setInterval(async () => {
    const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
    io.to(salaId).emit('round:tick', left)

    if (left <= 0) {
      clearTimerForSala(salaId)
      try {
        if (alreadyScored(salaId, roundId)) return

        console.log(`[TIMER->STOP] sala=${salaId} round=${roundId}`)
        io.to(salaId).emit('round:stopping', { roundId })
        await sleep(GRACE_MS)

        const payload = await endRoundAndScore({ salaId, roundId })
        io.to(salaId).emit('round:end', payload)

        const next = await getNextRoundForSala({ salaId, afterRoundId: roundId })
        if (next) {
          // 🔓 marca próxima como in_progress
          await supa.from('rodada').update({ status: 'in_progress' }).eq('rodada_id', next.rodada_id)
          io.to(salaId).emit('round:ready', next)
          io.to(salaId).emit('round:started', { roundId: next.rodada_id, duration: 20 })
          scheduleRoundCountdown({ salaId, roundId: next.rodada_id, duration: 20 })
        } else {
          io.to(salaId).emit('match:end', {
            totais: payload.totais,
            vencedor: computeWinner(payload.totais)
          })
        }
      } catch (e) {
        console.error('[timer auto-end] error', e)
      }
    }
  }, 1000)

  roomTimers.set(salaId, { interval, endsAt, roundId })
}

// ===== ciclo de vida dos sockets =====
export function initSockets(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } })

  io.on('connection', (socket) => {
    socket.on('join-room', (salaId) => {
      if (!salaId) return
      salaId = String(salaId)
      socket.join(salaId)
      socket.data.salaId = salaId
      console.log(`[SOCKET] client joined sala=${salaId}`)
    })

    socket.on('round:stop', async ({ salaId, roundId, by }) => {
      try {
        salaId = String(salaId || socket.data.salaId)
        if (!salaId || !roundId) return

        if (alreadyScored(salaId, roundId)) return

        console.log(`[CLICK STOP] sala=${salaId} round=${roundId} by=${by}`)
        io.to(salaId).emit('round:stopping', { roundId, by })
        await sleep(GRACE_MS)

        clearTimerForSala(salaId)

        const payload = await endRoundAndScore({ salaId, roundId })
        io.to(salaId).emit('round:end', payload)

        // 4) dispara próxima rodada (se houver), senão avisa match:end
        const next = await getNextRoundForSala({ salaId, afterRoundId: roundId })
        if (next) {
          // há próxima rodada
          io.to(salaId).emit('round:ready', next)
          io.to(salaId).emit('round:started', { roundId: next.rodada_id, duration: 20 })
          scheduleRoundCountdown({ salaId, roundId: next.rodada_id, duration: 20 })
        } else {
          // 🚨 fim da partida
          io.to(salaId).emit('match:end', {
            totais: payload.totais,
            vencedor: computeWinner(payload.totais)
          })
          console.log(`[MATCH END] Sala ${salaId} concluída.`, payload.totais)
        }
      } catch (e) {
        console.error('[round:stop] error', e)
      }
    })
  })

  return io
}

export function getIO() { return io }

// ===== util vencedor =====
function computeWinner(totaisObj = {}) {
  const entries = Object.entries(totaisObj).map(([id, total]) => [Number(id), Number(total || 0)])
  if (!entries.length) return null

  // ordena por pontuação desc
  entries.sort((a, b) => b[1] - a[1])
  const topScore = entries[0][1]

  // verifica se há empate (≥2 com a mesma pontuação)
  const empatados = entries.filter(([, total]) => total === topScore).map(([id]) => id)

  if (empatados.length > 1) {
    return {
      empate: true,
      jogadores: empatados, // ex.: [47, 48]
      total: topScore
    }
  }

  // vencedor único
  return {
    empate: false,
    jogador_id: entries[0][0],
    total: topScore
  }
}

import { io } from 'socket.io-client'

const API = 'http://localhost:3001'
const SALA_ID = Number(process.env.SALA_ID)
const RODADA_ID = Number(process.env.RODADA_ID)
const SECONDS = Number(process.env.SECONDS || 20)

if (!SALA_ID || !RODADA_ID) {
  console.error('Defina SALA_ID e RODADA_ID. Ex.: SALA_ID=4 RODADA_ID=6 node test-socket.js')
  process.exit(1)
}

const socket = io(API, { transports: ['websocket'] })

socket.on('connect', () => {
  console.log('socket connected:', socket.id)
  socket.emit('join-room', String(SALA_ID))
  // inicia a rodada com N segundos
  socket.emit('round:start', { salaId: SALA_ID, roundId: RODADA_ID, seconds: SECONDS })
})

socket.on('joined', (p) => console.log('[event] joined', p))
socket.on('round:started', (p) => console.log('[event] round:started', p))
socket.on('round:tick', (t) => console.log('[event] round:tick', t))
socket.on('round:end', (p) => { console.log('[event] round:end', p) })
socket.on('round:ready', (p) => console.log('[event] round:ready', p))
socket.on('match:end', (p) => { console.log('[event] match:end', p); process.exit(0) })
socket.on('disconnect', () => console.log('socket disconnected'))

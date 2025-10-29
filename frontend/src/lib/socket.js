// frontend/src/lib/socket.js
import { io } from 'socket.io-client'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

// Recupera o token salvo (compatível com chaves antigas e novas)
const token = localStorage.getItem('token') || localStorage.getItem('authToken') || ''

// Inclui o token no handshake (socket.handshake.auth.token no backend)
const socket = io(BASE, {
  autoConnect: true,
  transports: ['websocket'],
  auth: { token }
})

export function joinRoom(salaId) {
  socket.emit('join-room', String(salaId))
}

export { socket }
export default socket

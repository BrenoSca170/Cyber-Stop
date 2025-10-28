// frontend/src/lib/socket.js
import { io } from 'socket.io-client'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
const socket = io(BASE, { autoConnect: true, transports: ['websocket'] })

export function joinRoom(salaId) {
  socket.emit('join-room', String(salaId))
}

export { socket }
export default socket

import { io } from 'socket.io-client';
const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

let socket = io(BASE, {
  autoConnect: false,
  transports: ['websocket'],
  auth: { token: localStorage.getItem('token') || localStorage.getItem('authToken') || '' }
});

export function refreshSocketAuth() {
  const newToken = localStorage.getItem('token') || localStorage.getItem('authToken') || '';
  socket.auth = { token: newToken };
  if (socket.connected) socket.disconnect();
  socket.connect();
}

export function joinRoom(salaId) {
  socket.emit('join-room', String(salaId));
}

export { socket };
export default socket;

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

export default function LobbyScreen() {
  const nav = useNavigate()
  const [roomIdToJoin, setRoomIdToJoin] = useState('')
  const [roomName, setRoomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)

  const createRoom = async () => {
    setCreating(true)
    try {
      const { data } = await api.post('/rooms', { nome_sala: roomName || 'Sala do Jogador' })

      // guarda seu id
      sessionStorage.setItem('meuJogadorId', String(data.host_user))
      nav(`/game/${data.sala_id}`)
    } catch (e) {
      alert(e.response?.data?.error || e.message)
    } finally {
      setCreating(false)
    }
  }

  const joinExisting = async () => {
    if (!roomIdToJoin.trim()) { alert('Informe o ID da sala'); return }
    setJoining(true)
    try {
      const { data } = await api.post('/rooms/join', { sala_id: Number(roomIdToJoin) })
      sessionStorage.setItem('meuJogadorId', String(data.guest_user))
      nav(`/game/${data.sala_id}`)
    } catch (e) {
      alert(e.response?.data?.error || e.message)
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-3xl font-bold">Stop Online • Lobby</h1>

      <input className="w-full border border-gray-700 bg-gray-800 p-3 rounded"
             placeholder="Nome da sala (opcional)"
             value={roomName} onChange={e=>setRoomName(e.target.value)} />

      <button className="w-full bg-green-600 hover:bg-green-700 py-3 rounded"
              onClick={createRoom} disabled={creating}>
        {creating ? 'Criando...' : 'Criar Sala'}
      </button>

      <div className="h-px bg-gray-700 my-2" />

      <div className="flex gap-2">
        <input className="flex-1 border border-gray-700 bg-gray-800 p-3 rounded"
               placeholder="ID da sala"
               value={roomIdToJoin}
               onChange={e => setRoomIdToJoin(e.target.value)} />
        <button className="bg-blue-600 hover:bg-blue-700 px-4 rounded"
                onClick={joinExisting} disabled={joining}>
          Entrar
        </button>
      </div>
    </div>
  )
}

// frontend/src/pages/LobbyScreen.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api'; 
import PixelBlast from '../components/PixelBlast'; // Importa o componente de fundo
// import FaultyTerminalR3F from '../components/FaultyTerminalR3F'; // Removido se não estiver sendo usado

export default function LobbyScreen() {
  const nav = useNavigate(); 
  const [roomIdToJoin, setRoomIdToJoin] = useState(''); 
  const [roomName, setRoomName] = useState(''); 
  const [creating, setCreating] = useState(false); 
  const [joining, setJoining] = useState(false); 

  const createRoom = async () => {
    setCreating(true); 
    try {
      const { data } = await api.post('/rooms', { nome_sala: roomName || 'Sala do Jogador' }); 
      console.log("API /rooms response:", data);
      if (data && data.host_user) {
        sessionStorage.setItem('meuJogadorId', String(data.host_user)); 
      } else {
         console.warn("API /rooms não retornou host_user.");
      }
      if (data && data.sala_id) { 
        console.log(`Navegando para /waiting/${data.sala_id}`);
        nav(`/waiting/${data.sala_id}`); 
      } else {
        console.error("Erro: sala_id não encontrado na resposta da API /rooms");
        alert("Erro ao criar sala: ID da sala não recebido.");
      }
    } catch (e) {
      console.error("Erro ao criar sala (API /rooms):", e.response?.data || e.message || e);
      alert(e.response?.data?.error || e.message || "Ocorreu um erro desconhecido ao criar a sala."); 
    } finally {
      setCreating(false); 
    }
  };

  const joinExisting = async () => {
    if (!roomIdToJoin.trim()) {
      alert('Informe o ID da sala'); 
      return;
    }
    setJoining(true); 
    try {
      const { data } = await api.post('/rooms/join', { sala_id: Number(roomIdToJoin) }); 
      console.log("API /rooms/join response:", data);
      if (data && data.guest_user) {
        sessionStorage.setItem('meuJogadorId', String(data.guest_user)); 
      } else {
         console.warn("API /rooms/join não retornou guest_user.");
      }
      if (data && data.sala_id) { 
        console.log(`Navegando para /waiting/${data.sala_id}`);
        nav(`/waiting/${data.sala_id}`); 
      } else {
        console.error("Erro: sala_id não encontrado na resposta da API /rooms/join");
        alert("Erro ao entrar na sala: ID da sala não recebido.");
      }
    } catch (e) {
      console.error("Erro ao entrar na sala (API /rooms/join):", e.response?.data || e.message || e);
      alert(e.response?.data?.error || e.message || "Ocorreu um erro desconhecido ao entrar na sala."); 
    } finally {
      setJoining(false); 
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-120px)] text-white p-4 font-cyber [perspective:1000px]">
      {/* Fundo animado */}
      <PixelBlast className="absolute inset-0 w-full h-full z-0" />
      
      {/* Container principal */}
      <div className="absolute z-10 max-w-md mx-auto space-y-4 text-white p-4 font-cyber [perspective:1000px]">
      
        <h1 className="text-3xl font-bold text-center mb-6 text-warning tracking-wider">
          NET::LOBBY
        </h1>

        {/* Seção para Criar Sala com augmented-ui */}
        <div 
          className="bg-bg-secondary p-6 space-y-4 [transform-style:preserve-3d] transition-transform duration-300 hover:[transform:rotateY(3deg)]"
          data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        >
          
          <h2 className="text-xl font-semibold mb-3 text-accent [transform:translateZ(10px)]">
            Iniciar Novo Nó (Sala)
          </h2>
          <input
            className="w-full border border-accent/30 bg-bg-input p-3 rounded text-accent placeholder-text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent [transform:translateZ(10px)] cursor-target"
            placeholder="Nome do Nó (opcional)"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)} 
          />
          <button
            className="w-full bg-accent hover:bg-accent/80 text-black py-3 rounded font-bold tracking-wider transition-all disabled:bg-gray-500 disabled:cursor-not-allowed
                      [transform-style:preserve-3d] hover:[transform:translateZ(15px)] active:[transform:translateZ(5px)] [transform:translateZ(10px)] cursor-target"
            onClick={createRoom} 
            disabled={creating} 
            data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
          >
            {creating ? 'Estabelecendo...' : 'Criar Nó'}
          </button>
        </div>

        {/* Divisor "OU" foi removido */}

        {/* Seção para Entrar em Sala Existente com augmented-ui */}
        <div 
          className="bg-bg-secondary p-6 space-y-4 [transform-style:preserve-3d] transition-transform duration-300 hover:[transform:rotateY(-3deg)] mt-6" // Adicionada margem superior mt-6
          data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        >
          <h2 className="text-xl font-semibold mb-3 text-secondary [transform:translateZ(10px)]">
            Conectar a Nó Existente
          </h2>
          <div className="flex gap-2 [transform:translateZ(10px)]">
            <input
              className="flex-1 border border-secondary/30 bg-bg-input p-3 rounded text-secondary placeholder-text-muted/70 focus:outline-none focus:ring-2 focus:ring-secondary cursor-target"
              placeholder="ID do Nó"
              value={roomIdToJoin}
              onChange={(e) => setRoomIdToJoin(e.target.value)} 
              type="number"
            />
            <button
              className="bg-secondary hover:bg-secondary/80 text-black px-6 py-3 rounded font-bold tracking-wider transition-all disabled:bg-gray-500 disabled:cursor-not-allowed
                        [transform-style:preserve-3d] hover:[transform:translateZ(15px)] active:[transform:translateZ(5px)] cursor-target"
              onClick={joinExisting} 
              disabled={joining} 
              data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
            >
              {joining ? 'Conectando...' : 'Entrar'}
            </button>
          </div>
      </div>
    </div>

    </div>
    
  );
}
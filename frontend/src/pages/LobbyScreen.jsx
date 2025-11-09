// frontend/src/pages/LobbyScreen.jsx
import { useState, useEffect } from 'react'; // ATUALIZE O IMPORT
import { useNavigate } from 'react-router-dom';
import api from '../lib/api'; 
import PixelBlast from '../components/PixelBlast'; // Importa o componente de fundo

export default function LobbyScreen() {
  const nav = useNavigate(); 
  const [roomIdToJoin, setRoomIdToJoin] = useState(''); 
  const [roomName, setRoomName] = useState(''); 
  const [creating, setCreating] = useState(false); 
  const [joining, setJoining] = useState(false); 

  // --- NOVOS ESTADOS PARA A LISTA DE SALAS ---
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // --- NOVO EFFECT PARA BUSCAR SALAS ---
  useEffect(() => {
    let isMounted = true;
    const fetchRooms = async () => {
      if (!isMounted) return;
      setLoadingRooms(true);
      try {
        const { data } = await api.get('/rooms/available');
        if (isMounted) {
          setAvailableRooms(data || []);
        }
      } catch (e) {
        console.error("Erro ao buscar salas disponíveis:", e);
        // (Opcional) alert("Não foi possível carregar a lista de salas.");
      } finally {
        if (isMounted) {
          setLoadingRooms(false);
        }
      }
    };
    
    fetchRooms(); // Busca imediata
    const intervalId = setInterval(fetchRooms, 5000); // Atualiza a cada 5s

    return () => {
      isMounted = false;
      clearInterval(intervalId); // Limpa ao desmontar
    };
  }, []); // Roda apenas uma vez no mount

  const createRoom = async () => {
    setCreating(true); 
    try {
      // ... (lógica de criar sala existente, SEM MUDANÇAS) ...
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
      // Exibe o erro específico da verificação multi-sala
      alert(e.response?.data?.error || e.message || "Ocorreu um erro desconhecido ao criar a sala."); 
    } finally {
      setCreating(false); 
    }
  };

  // --- ATUALIZAR 'joinExisting' PARA ACEITAR UM ID (ou usar o do estado) ---
  const joinExisting = async (salaIdFromList = null) => {
    // Usa o ID da lista (se fornecido) ou o ID do campo de input
    const salaId = salaIdFromList ? Number(salaIdFromList) : Number(roomIdToJoin.trim());
    
    if (!salaId) {
      alert('Informe o ID da sala'); 
      return;
    }
    
    setJoining(true); 
    try {
      // Garante que o ID correto (seja da lista ou input) seja enviado
      const { data } = await api.post('/rooms/join', { sala_id: Number(salaId) }); 
      
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
      // Exibe o erro específico da verificação multi-sala
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
         LOBBY
        </h1>

        {/* Seção para Criar Sala com augmented-ui */}
        <div 
          className="bg-bg-secondary p-6 space-y-4 [transform-style:preserve-3d] transition-transform duration-300 hover:[transform:rotateY(3deg)]"
          data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        >
          {/* ... (Conteúdo de Criar Sala - Sem alteração) ... */}
          <h2 className="text-xl font-semibold mb-3 text-accent [transform:translateZ(10px)]">
            Iniciar Novo Sala
          </h2>
          <input
            className="w-full border border-accent/30 bg-bg-input p-3 rounded text-accent placeholder-text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent [transform:translateZ(10px)] cursor-target"
            placeholder="Nome da Sala (opcional)"
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
            {creating ? 'Estabelecendo...' : 'Criar Sala'}
          </button>
        </div>

        {/* --- NOVA SEÇÃO: LISTA DE SALAS DISPONÍVEIS --- */}
        <div 
          className="bg-bg-secondary p-6 space-y-4 [transform-style:preserve-3d] transition-transform duration-300 hover:[transform:rotateY(-3deg)] mt-6"
          data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        >
          <h2 className="text-xl font-semibold mb-3 text-accent [transform:translateZ(10px)]">
            Salas Disponíveis
          </h2>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-2 [transform:translateZ(10px)]">
            {loadingRooms && <p className="text-text-muted">Buscando salas...</p>}
            {!loadingRooms && availableRooms.length === 0 && (
              <p className="text-text-muted">Nenhuma sala disponível. Crie uma!</p>
            )}
            {availableRooms.map(room => (
              <button
                key={room.sala_id}
                // Chama a função 'joinExisting' passando o ID da sala
                onClick={() => joinExisting(room.sala_id)} 
                disabled={joining}
                className="w-full flex justify-between items-center p-3 bg-bg-input hover:bg-bg-input/70 border border-accent/20 rounded transition-colors disabled:opacity-50 cursor-target"
              >
                <span className="font-semibold text-accent">{room.nome_sala} (ID: {room.sala_id})</span>
                <span className="text-text-muted text-sm">({room.player_count || 0}/2)</span>
              </button>
            ))}
          </div>
        </div>
        {/* --- FIM DA NOVA SEÇÃO --- */}


        {/* Seção para Entrar em Sala Existente com augmented-ui */}
        <div 
          className="bg-bg-secondary p-6 space-y-4 [transform-style:preserve-3d] transition-transform duration-300 hover:[transform:rotateY(-3deg)] mt-6"
          data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        >
          <h2 className="text-xl font-semibold mb-3 text-secondary [transform:translateZ(10px)]">
            Conectar com ID
          </h2>
          <div className="flex gap-2 [transform:translateZ(10px)]">
            <input
              className="flex-1 border border-secondary/30 bg-bg-input p-3 rounded text-secondary placeholder-text-muted/70 focus:outline-none focus:ring-2 focus:ring-secondary cursor-target"
              placeholder="ID do Sala"
              value={roomIdToJoin}
              onChange={(e) => setRoomIdToJoin(e.target.value)} 
              type="number"
            />
            <button
              className="bg-secondary hover:bg-secondary/80 text-black px-6 py-3 rounded font-bold tracking-wider transition-all disabled:bg-gray-500 disabled:cursor-not-allowed
                        [transform-style:preserve-3d] 
                        [transform:translateZ(0px)]
                        hover:[transform:translateZ(15px)] active:[transform:translateZ(5px)] 
                        relative z-10 cursor-target"
              // Chama a função 'joinExisting' sem argumento, 
              // ela usará o valor do input 'roomIdToJoin'
              onClick={() => joinExisting()} 
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
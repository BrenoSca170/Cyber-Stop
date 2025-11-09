// frontend/src/pages/WaitingRoomScreen.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import socket from '../lib/socket';
import { ArrowLeft, Loader2, Play, ClipboardCopy, Users } from 'lucide-react';
import LetterGlitch from '../components/LetterGlitch';
import PixelBlast from '../components/PixelBlast';
import Hyperspeed from '../components/Hyperspeed';

function WaitingRoomScreen() {
    const { salaId } = useParams(); 
    const navigate = useNavigate(); 
    const [sala, setSala] = useState(null); 
    const [loading, setLoading] = useState(true); 
    const [error, setError] = useState(''); 
    const [copySuccess, setCopySuccess] = useState(''); 
    const [leaving, setLeaving] = useState(false); 

    // --- Funções de Lógica ---
    const copyToClipboard = async () => { 
        try { 
            await navigator.clipboard.writeText(salaId); 
            setCopySuccess('ID copiado!'); 
            setTimeout(() => setCopySuccess(''), 2000); 
        } catch (err) { 
            setCopySuccess('Falha ao copiar'); 
            console.error('Falha ao copiar ID da sala: ', err); 
            setTimeout(() => setCopySuccess(''), 2000); 
        }
    };

    const handleStartGame = async () => { 
        setLoading(true); 
        setError(''); 
        try { 
            // A rota /matches/start é responsável por mudar o status da sala para 'playing'
            await api.post(`/matches/start`, { sala_id: Number(salaId) });
            // Não precisa navegar aqui, o evento 'round:ready' ou 'round:started' fará isso
        } catch (err) { 
            console.error('Erro ao iniciar partida:', err); 
            setError(err.response?.data?.error || err.message || 'Falha ao iniciar a partida.'); 
            setLoading(false); 
        }
    };

    const handleLeaveRoom = async () => { 
      setLeaving(true);
      setError('');
      try {
          // Esta rota agora muda o status para 'closed' se o host sair
          await api.post(`/rooms/${salaId}/leave`); 
          navigate('/'); // Navega de volta ao lobby após sair
      } catch (error) {
          console.error("Erro ao sair da sala:", error);
          setError(error.response?.data?.error || error.message || 'Falha ao sair da sala.');
          setTimeout(() => setError(''), 3000);
          setLeaving(false); 
      }
    };

    // --- Efeito Principal para Sockets e Fetch ---
    useEffect(() => { 
        let isMounted = true; 
        let intervalId = null; 
        let initialLoadAttempted = false; 

        const fetchSalaState = async (isInitial = false) => {
            if (!isMounted) return; 
             if (isInitial) setLoading(true);
            try { 
                const response = await api.get(`/rooms/${salaId}`); 
                const salaData = response.data; 
                if (isMounted) { 
                    setSala(salaData); 
                    setError(''); 

                    // Status: Jogo começou
                    if (salaData.status === 'playing') { // USA 'playing'
                         console.log(`[Polling] Detectou status 'playing'. Navegando...`);
                         if (intervalId) clearInterval(intervalId); 
                         // Limpa os listeners antes de navegar
                         socket.off('room:players_updated', handlePlayersUpdate);
                         socket.off('room:closed', handleRoomClosed); // USA 'room:closed'
                         socket.off('round:ready', handleGameStarted);
                         socket.off('round:started', handleGameStarted);
                         navigate(`/game/${salaId}`); 
                         return; 
                    }
                    
                    // Status: Sala foi fechada
                     if (salaData.status === 'closed') { // USA 'closed'
                         console.log(`Sala ${salaId} com status 'closed', voltando ao lobby.`);
                         alert(`A sala foi fechada.`);
                         navigate('/');
                     }
                }
            } catch (err) { 
                console.error('Erro ao buscar estado da sala:', err); 
                 if (isMounted) { 
                    if (err.response?.status === 404 || err.response?.status === 410) { 
                        if (!initialLoadAttempted) {
                            console.warn("Falha na busca inicial da sala (404/410).");
                            setError('Conectando à sala... (tentativa 1 falhou, tentando de novo...)');
                        } else {
                            alert(err.response?.data?.error || 'Sala não encontrada ou fechada.'); 
                            navigate('/'); 
                        }
                    }
                     else { 
                        if (initialLoadAttempted) { 
                           setError('Não foi possível atualizar o estado da sala. Tentando novamente...'); 
                        } else {
                           setError('Falha ao carregar dados da sala.');
                           console.warn("Falha na busca inicial da sala (outro erro)."); 
                        }
                    }
                 }
           } finally { 
               if (isMounted && !initialLoadAttempted) { 
                   initialLoadAttempted = true; 
                   setLoading(false); 
               } else if (isMounted && isInitial) {
                    setLoading(false); 
               }
           }
        };
        
       // Evento: Jogador entrou ou saiu
       const handlePlayersUpdate = ({ jogadores }) => {
           console.log('Recebido room:players_updated', jogadores);
           if (isMounted) {
               setSala(currentSala => {
                   if (!currentSala) return null; 
                   return { ...currentSala, jogadores: jogadores };
               });
           }
       };

       // Evento: Host fechou a sala
       const handleRoomClosed = ({ message }) => { // MUDOU DE 'handleRoomAbandoned'
           console.log('Recebido room:closed', message); // MUDOU DE 'room:abandoned'
           if (isMounted) {
               alert(message || 'O host fechou a sala. Voltando ao lobby.');
               navigate('/');
           }
       };

       // Evento: Jogo iniciado
       const handleGameStarted = (data) => {
            console.log("Recebido 'round:ready' ou 'round:started'. Navegando...", data);
            if (isMounted) {
                socket.off('room:players_updated', handlePlayersUpdate);
                socket.off('room:closed', handleRoomClosed); // MUDOU DE 'room:abandoned'
                socket.off('round:ready', handleGameStarted); 
                socket.off('round:started', handleGameStarted); 
                navigate(`/game/${salaId}`); 
            }
       };
       
       // Liga os listeners
       socket.on('room:players_updated', handlePlayersUpdate);
       socket.on('room:closed', handleRoomClosed); // MUDOU DE 'room:abandoned'
       socket.on('round:ready', handleGameStarted); 
       socket.on('round:started', handleGameStarted); 
       
       // Entra na sala via socket
       socket.emit('join-room', String(salaId)); 
       console.log(`Socket join-room emitido para sala ${salaId}`);
       
       // Busca o estado inicial e inicia o polling
       fetchSalaState(true); 
       intervalId = setInterval(fetchSalaState, 5000); 
       
       // Função de limpeza
       return () => { 
            console.log("Limpando WaitingRoomScreen"); 
            isMounted = false; 
            if (intervalId) clearInterval(intervalId); 
           // Desliga os listeners
           socket.off('room:players_updated', handlePlayersUpdate);
           socket.off('room:closed', handleRoomClosed); // MUDOU DE 'room:abandoned'
           socket.off('round:ready', handleGameStarted); 
           socket.off('round:started', handleGameStarted); 
        };
    }, [salaId, navigate]); 

    // --- Renderização (Loading) ---
    if (loading || !sala) { 
        return ( 
             <div className="text-white text-center p-10 flex flex-col items-center justify-center gap-4 font-cyber">
               <Loader2 className="animate-spin h-10 w-10 text-secondary" /> 
               <p>Acessando Nó #{salaId}...</p> 
               {error && <p className="text-warning mt-2">{error}</p>} 
             </div>
        );
    }

    // --- Renderização (Tela Principal) ---
    return ( 
        <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-120px)] text-white p-4 font-cyber [perspective:1000px]">
            <PixelBlast className="relative inset-0 w-full h-full z-0" />
            <div className="absolute z-10 w-full max-w-2xl mx-auto">
                
                {/* Botão Sair */}
                <button
                    onClick={handleLeaveRoom} 
                    disabled={leaving} 
                    className="absolute top-4 left-4 md:top-6 md:left-6 text-text-muted hover:text-primary transition-colors flex items-center gap-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-target" 
                    title="Sair da sala" 
                >
                    {leaving ? <Loader2 size={16} className="animate-spin" /> : <ArrowLeft size={16} />} 
                    {leaving ? 'Desconectando...' : 'Voltar ao Lobby'} 
                </button>

                {/* Cabeçalho da Sala */}
                 <div className="text-center mb-8 pt-8 md:pt-4">
                    <h1 className="text-3xl md:text-4xl font-bold mb-2 text-accent">{sala.nome_sala}</h1> 

                    {/* ID da Sala para compartilhar (estilizado) */}
                    <div className="flex items-center justify-center gap-2 mt-3 mb-2"> 
                        <span className="text-text-muted">ID do Nó:</span> 
                        <span className="text-2xl font-mono text-warning bg-black/50 px-3 py-1 rounded border border-dashed border-warning/50"> 
                            {salaId} 
                        </span>
                        <button onClick={copyToClipboard} title="Copiar ID" className="text-text-muted hover:text-warning transition-colors p-1 cursor-target"> 
                            <ClipboardCopy size={20}/> 
                        </button>
                    </div>
                    {copySuccess && <p className="text-xs text-accent h-4">{copySuccess}</p>} 

                    <p className="text-text-muted mt-2 text-sm">Host: {sala.jogador?.nome_de_usuario || 'Desconhecido'}</p> 
                     
                     {/* Texto de Status Atualizado */}
                     <p className={`mt-1 text-sm font-semibold ${
                          sala.status === 'open' ? 'text-warning'
                        : sala.status === 'playing' ? 'text-accent'
                        : sala.status === 'closed' ? 'text-secondary'
                        : 'text-text-muted' 
                     }`}> 
                        Status: {
                            sala.status === 'open' ? 'Aguardando Conexões...'
                          : sala.status === 'playing' ? 'Em Jogo'
                          : sala.status === 'closed' ? 'Partida Encerrada'
                          : sala.status 
                        } 
                     </p>
                     {error && <p className="text-red-400 mt-2 text-sm">{error}</p>} 
                </div>

                {/* Lista de Jogadores */}
                <div 
                  className="bg-bg-secondary p-4 md:p-6 mb-8 [transform-style:preserve-3d]"
                  data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
                >
                    <h2 className="text-xl md:text-2xl font-semibold mb-4 flex items-center gap-2 text-secondary [transform:translateZ(10px)]"> 
                       <Users size={24} /> Conexões ({sala.jogadores?.length || 0}/2) 
                    </h2>
                    <ul className="space-y-2 max-h-60 overflow-y-auto pr-2 [transform:translateZ(10px)]"> 
                        {(sala.jogadores || []).map((nome, index) => ( 
                           <li key={index} className="text-base md:text-lg bg-bg-input px-3 py-1.5 rounded flex items-center gap-2 border border-transparent"> 
                              <span className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-warning shadow-glow-warning' : 'bg-secondary shadow-glow-secondary'}`}></span> 
                              {nome} 
                              {index === 0 && <span className="text-xs text-warning font-semibold ml-auto">(Host)</span>} 
                           </li>
                        ))}
                         {sala.jogadores?.length === 0 && !loading && <li className="text-text-muted/70 italic">Nenhuma conexão ainda.</li>} 
                    </ul>
                </div>

                {/* Botão de Iniciar Partida ou Mensagem de Espera (Verifica 'open') */}
                {sala.status === 'open' && ( 
                    <div className="mt-8 md:mt-6 text-center [transform-style:preserve-3d]">
                        {sala.is_creator && ( 
                            <button
                                onClick={handleStartGame} 
                                disabled={loading || sala.jogadores?.length < 2} 
                                className="px-8 py-3 md:px-10 md:py-4 bg-accent text-black rounded-lg font-bold text-lg md:text-xl 
                                           hover:bg-accent/80 disabled:bg-gray-500 disabled:cursor-not-allowed 
                                           transition-all hover:scale-105 hover:[transform:translateZ(15px)] active:[transform:translateZ(5px)]
                                           flex items-center justify-center gap-2 mx-auto shadow-lg shadow-accent/20 cursor-target" 
                                title={sala.jogadores?.length < 2 ? "Precisa de pelo menos 2 conexões para iniciar" : "Iniciar a partida"} 
                                data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
                            >
                                {loading && !leaving ? <Loader2 className="animate-spin" /> : <Play />} 
                                {loading && !leaving ? 'Iniciando...' : 'Iniciar Partida'} 
                            </button>
                        )}
                        {!sala.is_creator && ( 
                            <p className="text-base md:text-lg text-text-muted flex items-center justify-center gap-2"> 
                               <Loader2 className="animate-spin h-5 w-5"/> Aguardando Host <span className="font-semibold text-warning">{sala.jogador?.nome_de_usuario || ''}</span> iniciar...
                            </p>
                        )}
                        {sala.is_creator && sala.jogadores?.length < 2 && ( 
                               <p className="text-sm text-warning/80 mt-2">Aguardando mais {2 - (sala.jogadores?.length || 0)} jogador(es) para iniciar (máximo 2).</p> 
                        )}
                        {sala.jogadores?.length === 2 && sala.status === 'open' && (
                            <p className="text-sm text-accent/80 mt-2">Sala cheia! Pronto para iniciar.</p>
                        )}
                    </div>
                )}
                
                 {/* Mensagem de Partida em Andamento (Verifica 'playing') */}
                 {sala.status === 'playing' && !loading && ( 
                      <p className="text-base md:text-lg text-secondary text-center">Partida em andamento...</p> 
                 )}
                 
                 {/* Mensagem de Sala Fechada (Verifica 'closed') */}
                  {sala.status === 'closed' && !loading && (
                        <p className={`text-base md:text-lg text-center font-semibold text-primary`}>
                           Este Nó está fechado.
                        </p>
                  )}
            </div>
        </div>
    );
}


export default WaitingRoomScreen;
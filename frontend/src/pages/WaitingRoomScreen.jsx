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

    // ... (Todas as funções: copyToClipboard, handleStartGame, handleLeaveRoom) ...
    // ... (Toda a lógica dentro do useEffect) ...
    // NENHUMA LÓGICA PRECISA MUDAR.

    // --- Funções de Lógica (sem alteração) ---
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
            await api.post(`/matches/start`, { sala_id: Number(salaId) });
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
          await api.post(`/rooms/${salaId}/leave`); 
          navigate('/'); 
      } catch (error) {
          console.error("Erro ao sair da sala:", error);
          setError(error.response?.data?.error || error.message || 'Falha ao sair da sala.');
          setTimeout(() => setError(''), 3000);
          setLeaving(false); 
      }
    };
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
                    if (salaData.status === 'in_progress') {
                         console.log(`[Polling] Detectou status 'in_progress'. Navegando...`);
                         if (intervalId) clearInterval(intervalId); 
                         socket.off('room:players_updated', handlePlayersUpdate);
                         socket.off('room:abandoned', handleRoomAbandoned);
                         socket.off('round:ready', handleGameStarted);
                         socket.off('round:started', handleGameStarted);
                         navigate(`/game/${salaId}`); 
                         return; 
                    }
                     if (salaData.status === 'terminada' || salaData.status === 'abandonada') {
                         console.log(`Sala ${salaId} com status ${salaData.status}, voltando ao lobby.`);
                         alert(`A sala foi ${salaData.status}.`);
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
                            alert(err.response?.data?.error || 'Sala não encontrada ou abandonada.'); 
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
       const handlePlayersUpdate = ({ jogadores }) => {
           console.log('Recebido room:players_updated', jogadores);
           if (isMounted) {
               setSala(currentSala => {
                   if (!currentSala) return null; 
                   return { ...currentSala, jogadores: jogadores };
               });
           }
       };
       const handleRoomAbandoned = ({ message }) => {
           console.log('Recebido room:abandoned', message);
           if (isMounted) {
               alert(message || 'O criador abandonou a sala. Voltando ao lobby.');
               navigate('/');
           }
       };
       const handleGameStarted = (data) => {
            console.log("Recebido 'round:ready' ou 'round:started'. Navegando...", data);
            if (isMounted) {
                socket.off('room:players_updated', handlePlayersUpdate);
                socket.off('room:abandoned', handleRoomAbandoned);
                socket.off('round:ready', handleGameStarted); 
                socket.off('round:started', handleGameStarted); 
                navigate(`/game/${salaId}`); 
            }
       };
       socket.on('room:players_updated', handlePlayersUpdate);
       socket.on('room:abandoned', handleRoomAbandoned);
       socket.on('round:ready', handleGameStarted); 
       socket.on('round:started', handleGameStarted); 
       socket.emit('join-room', String(salaId)); 
       console.log(`Socket join-room emitido para sala ${salaId}`);
        fetchSalaState(true); 
        intervalId = setInterval(fetchSalaState, 5000); 
        return () => { 
            console.log("Limpando WaitingRoomScreen"); 
            isMounted = false; 
            if (intervalId) clearInterval(intervalId); 
           socket.off('room:players_updated', handlePlayersUpdate);
           socket.off('room:abandoned', handleRoomAbandoned);
           socket.off('round:ready', handleGameStarted); 
           socket.off('round:started', handleGameStarted); 
        };
    }, [salaId, navigate]); 

    // --- Renderização com Alterações ---
    if (loading || !sala) { 
        return ( 
             <div className="text-white text-center p-10 flex flex-col items-center justify-center gap-4 font-cyber">
               <Loader2 className="animate-spin h-10 w-10 text-secondary" /> 
               <p>Acessando Nó #{salaId}...</p> 
               {error && <p className="text-warning mt-2">{error}</p>} 
             </div>
        );
    }

    return ( 
        <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-120px)] text-white p-4 font-cyber [perspective:1000px]">
            <PixelBlast className="relative inset-0 w-full h-full z-0" />
            <div className="absolute z-10 w-full max-w-2xl mx-auto">
                {/* Botão Sair */}
                <button
                    onClick={handleLeaveRoom} 
                    disabled={leaving} 
                    className="absolute top-4 left-4 md:top-6 md:left-6 text-text-muted hover:text-primary transition-colors flex items-center gap-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed" 
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
                        <button onClick={copyToClipboard} title="Copiar ID" className="text-text-muted hover:text-warning transition-colors p-1"> 
                            <ClipboardCopy size={20}/> 
                        </button>
                    </div>
                    {copySuccess && <p className="text-xs text-accent h-4">{copySuccess}</p>} 

                    <p className="text-text-muted mt-2 text-sm">Host: {sala.jogador?.nome_de_usuario || 'Desconhecido'}</p> 
                     <p className={`mt-1 text-sm font-semibold ${
                          sala.status === 'waiting' ? 'text-warning'
                        : sala.status === 'in_progress' ? 'text-accent'
                        : sala.status === 'terminada' ? 'text-secondary'
                        : sala.status === 'abandonada' ? 'text-primary'
                        : 'text-text-muted' 
                     }`}> 
                        Status: {
                            sala.status === 'waiting' ? 'Aguardando Conexões...'
                          : sala.status === 'in_progress' ? 'Em Jogo'
                          : sala.status === 'terminada' ? 'Partida Terminada'
                          : sala.status === 'abandonada' ? 'Nó Abandonado'
                          : sala.status 
                        } 
                     </p>
                     {error && <p className="text-red-400 mt-2 text-sm">{error}</p>} 
                </div>

                {/* Lista de Jogadores (com augmented-ui) */}
                <div 
                  className="bg-bg-secondary p-4 md:p-6 mb-8 [transform-style:preserve-3d]"
                  data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
                >
                    <h2 className="text-xl md:text-2xl font-semibold mb-4 flex items-center gap-2 text-secondary [transform:translateZ(10px)]"> 
                       <Users size={24} /> Conexões ({sala.jogadores?.length || 0}) 
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

                {/* Botão de Iniciar Partida ou Mensagem de Espera */}
                {sala.status === 'waiting' && ( 
                    <div className="mt-8 md:mt-6 text-center [transform-style:preserve-3d]">
                        {sala.is_creator && ( 
                            <button
                                onClick={handleStartGame} 
                                disabled={loading || sala.jogadores?.length < 2} 
                                className="px-8 py-3 md:px-10 md:py-4 bg-accent text-black rounded-lg font-bold text-lg md:text-xl 
                                           hover:bg-accent/80 disabled:bg-gray-500 disabled:cursor-not-allowed 
                                           transition-all hover:scale-105 hover:[transform:translateZ(15px)] active:[transform:translateZ(5px)]
                                           flex items-center justify-center gap-2 mx-auto shadow-lg shadow-accent/20" 
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
                               <p className="text-sm text-warning/80 mt-2">Mínimo de 2 conexões para iniciar.</p> 
                        )}
                    </div>
                )}
                 {sala.status !== 'waiting' && !loading && sala.status !== 'abandonada' && sala.status !== 'terminada' &&( 
                      <p className="text-base md:text-lg text-secondary text-center">Partida em andamento ou finalizada...</p> 
                 )}
                  {(sala.status === 'abandonada' || sala.status === 'terminada') && !loading && (
                        <p className={`text-base md:text-lg text-center font-semibold ${sala.status === 'abandonada' ? 'text-primary' : 'text-secondary'}`}>
                           Este Nó foi {sala.status}.
                        </p>
                  )}
            </div>
        </div>
    );
}


export default WaitingRoomScreen;
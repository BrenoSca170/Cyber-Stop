import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import socket from '../lib/socket';
import { ArrowLeft, Loader2, Play, ClipboardCopy } from 'lucide-react';
import PlayerCard from '../components/PlayerCard';
import { useExitConfirmation } from '../hooks/useExitConfirmation';
import ExitConfirmationModal from '../components/ExitConfirmationModal';
import NavigationBlocker from '../components/NavigationBlocker';

function WaitingRoomScreen() {
    const { salaId } = useParams(); 
    const navigate = useNavigate(); 
    const [sala, setSala] = useState(null); 
    const [loading, setLoading] = useState(true); 
    const [error, setError] = useState(''); 
    const [copySuccess, setCopySuccess] = useState(''); 
    const [leaving, setLeaving] = useState(false);

    const { 
        showModal, 
        confirmExit, 
        cancelExit, 
        handleExitClick,
        isInRoomOrMatch,
        exitConfirmed,
        exitCancelled
    } = useExitConfirmation(salaId, false, () => {
        setLeaving(false);
    }); 

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

    const handleLeaveRoom = () => { 
      handleExitClick(() => {
          setLeaving(true);
          setError('');
          navigate('/'); 
      });
    };

    useEffect(() => { 
        let isMounted = true; 
        let intervalId = null; 

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
                         if (intervalId) clearInterval(intervalId); 
                         socket.off('room:players_updated', handlePlayersUpdate);
                         socket.off('room:abandoned', handleRoomAbandoned);
                         socket.off('round:ready', handleGameStarted);
                         socket.off('round:started', handleGameStarted);
                         navigate(`/game/${salaId}`, { replace: true }); 
                         return; 
                    }
                     if (salaData.status === 'terminada' || salaData.status === 'abandonada') {
                         alert(`A sala foi ${salaData.status}.`);
                         navigate('/');
                     }
                }
            } catch (err) { 
                console.error('Erro ao buscar estado da sala:', err); 
                if (isMounted) { 
                    if (err.response?.status === 404 || err.response?.status === 410) { 
                        alert(err.response?.data?.error || 'Sala não encontrada ou abandonada.'); 
                        navigate('/'); 
                    } else { 
                        setError('Falha ao carregar dados da sala.');
                    }
                }
           } finally { 
               if (isMounted) {
                   setLoading(false); 
               }
           }
        };

       const handlePlayersUpdate = ({ jogadores, jogadores_info }) => {
           if (isMounted) {
               setSala(currentSala => {
                   if (!currentSala) return null; 
                   return { ...currentSala, jogadores: jogadores, jogadores_info: jogadores_info };
               });
           }
       };

       const handleRoomAbandoned = ({ message }) => {
           if (isMounted) {
               alert(message || 'O criador abandonou a sala. Voltando ao lobby.');
               navigate('/');
           }
       };

       const handleGameStarted = (data) => {
            if (isMounted) {
                if (intervalId) clearInterval(intervalId);
                socket.off('room:players_updated', handlePlayersUpdate);
                socket.off('room:abandoned', handleRoomAbandoned);
                socket.off('round:ready', handleGameStarted); 
                socket.off('round:started', handleGameStarted); 
                navigate(`/game/${salaId}`, { replace: true }); 
            }
       };

       socket.on('room:players_updated', handlePlayersUpdate);
       socket.on('room:abandoned', handleRoomAbandoned);
       socket.on('round:ready', handleGameStarted); 
       socket.on('round:started', handleGameStarted);
       
       socket.emit('join-room', String(salaId)); 
       
       setTimeout(() => {
         socket.emit('join-room', String(salaId));
       }, 500);

        fetchSalaState(true); 
        intervalId = setInterval(() => {
          fetchSalaState(false);
        }, 1000); 

        return () => { 
            isMounted = false; 
            if (intervalId) clearInterval(intervalId); 
           socket.off('room:players_updated', handlePlayersUpdate);
           socket.off('room:abandoned', handleRoomAbandoned);
           socket.off('round:ready', handleGameStarted); 
           socket.off('round:started', handleGameStarted); 
        };
    }, [salaId, navigate]); 

    if (loading || !sala) { 
        return ( 
             <div className="text-white text-center p-10 flex flex-col items-center justify-center gap-4 font-cyber h-screen bg-black">
               <Loader2 className="animate-spin h-12 w-12 text-secondary" /> 
               <p className="text-xl">Acessando Nó de Batalha #{salaId}...</p> 
               {error && <p className="text-warning mt-4 text-lg">{error}</p>} 
             </div>
        );
    }

    const jogador1 = sala?.jogadores_info?.[0];
    const jogador2 = sala?.jogadores_info?.[1];

    return ( 
        <div 
            className="relative flex flex-col items-center justify-center min-h-screen text-white p-4 font-cyber bg-cover bg-center"
            style={{ backgroundImage: "url('/backgrounds/cyber-city.jpg')" }}
        >
            <div className="absolute inset-0 bg-black/50"></div>
            <NavigationBlocker 
                shouldBlock={isInRoomOrMatch}
                exitConfirmed={exitConfirmed}
                exitCancelled={exitCancelled}
                showModal={showModal}
                onBlock={(proceed, reset) => handleExitClick(proceed, reset)}
            />
            <ExitConfirmationModal 
                isOpen={showModal}
                onConfirm={confirmExit}
                onCancel={cancelExit}
            />
            
            <div className="w-full flex justify-between items-start p-4 absolute top-0 left-0 z-20">
                <button
                    onClick={handleLeaveRoom} 
                    disabled={leaving} 
                    className="text-text-muted hover:text-primary transition-colors cursor-target flex items-center gap-2 text-md disabled:opacity-50" 
                    title="Sair da sala" 
                >
                    {leaving ? <Loader2 size={20} className="animate-spin" /> : <ArrowLeft size={20} />} 
                    {leaving ? 'Saindo...' : 'Sair'} 
                </button>
                <div className="text-right">
                    <h1 className="text-2xl font-bold text-accent">{sala.nome_sala}</h1>
                    <div className="flex items-center justify-end gap-2 mt-1"> 
                        <span className="text-text-muted text-sm">ID:</span> 
                        <span className="text-lg font-mono text-warning">{salaId}</span>
                        <button onClick={copyToClipboard} title="Copiar ID" className="text-text-muted hover:text-warning transition-colors cursor-target p-1"> 
                            <ClipboardCopy size={18}/> 
                        </button>
                    </div>
                    {copySuccess && <p className="text-xs text-accent h-4 mt-1">{copySuccess}</p>} 
                </div>
            </div>

            <div className="w-full flex flex-col md:flex-row items-center justify-center md:justify-around gap-8 md:gap-0 flex-grow pt-24 md:pt-0 z-10">
                <PlayerCard 
                    playerName={jogador1?.nome_de_usuario}
                    isHost={jogador1?.is_creator}
                    avatarNome={jogador1?.avatar_nome}
                    personagemNome={jogador1?.personagem_nome}
                    ranking={jogador1?.ranking}
                />
                
                <div className="text-8xl lg:text-9xl font-black text-white font-['Dena'] my-4 md:my-0 animate-pulse" style={{ textShadow: '0 0 10px #ff00ff, 0 0 20px #ff00ff' }}>
                    DUEL
                </div>

                <PlayerCard 
                    playerName={jogador2?.nome_de_usuario}
                    isHost={jogador2?.is_creator}
                    avatarNome={jogador2?.avatar_nome}
                    personagemNome={jogador2?.personagem_nome}
                    ranking={jogador2?.ranking}
                    isPlayer2
                />
            </div>

            <div className="w-full flex flex-col items-center justify-center p-4 pb-8 absolute bottom-0 left-0 z-20">
                {error && <p className="text-red-400 mb-4 text-center">{error}</p>} 
                
                {sala.status === 'waiting' && ( 
                    <div className="text-center">
                        {sala.is_creator ? ( 
                            <button
                                onClick={handleStartGame} 
                                disabled={loading || sala.jogadores?.length < 2} 
                                className="px-12 py-4 bg-accent text-black rounded-md font-bold text-2xl 
                                           hover:bg-accent/80 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed 
                                           transition-all cursor-target shadow-lg shadow-accent/30
                                           hover:scale-105 active:scale-100"
                                title={sala.jogadores?.length < 2 ? "Aguardando oponente..." : "Iniciar Batalha"} 
                            >
                                {loading && !leaving ? <Loader2 className="animate-spin mx-auto" /> : 'INICIAR'} 
                            </button>
                        ) : ( 
                            <p className="text-lg text-text-muted flex items-center justify-center gap-3"> 
                               <Loader2 className="animate-spin h-6 w-6"/> Aguardando Host iniciar...
                            </p>
                        )}
                        {sala.jogadores?.length < 2 && ( 
                           <p className="text-sm text-warning/80 mt-3">Aguardando oponente se conectar...</p> 
                        )}
                    </div>
                )}
                 {(sala.status === 'abandonada' || sala.status === 'terminada') && !loading && (
                    <p className={`text-lg font-semibold ${sala.status === 'abandonada' ? 'text-primary' : 'text-secondary'}`}>
                       Esta Batalha foi {sala.status}.
                    </p>
                  )}
            </div>
        </div>
    );
}

export default WaitingRoomScreen;
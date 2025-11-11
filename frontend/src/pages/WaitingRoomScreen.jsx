// src/pages/WaitingRoomScreen.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import socket, { joinRoom } from '../lib/socket';
import GlitchText from '../components/GlitchText'; // REATIVADO
import PlayerCard from '../components/game/PlayerCard';
import GlitchButton from '../components/GlitchButton'; // REATIVADO
import api from '../lib/api';

export default function WaitingRoomScreen() {
  const { salaId } = useParams();
  const navigate = useNavigate();

  const [meuJogador, setMeuJogador] = useState(null);
  const [oponente, setOponente] = useState(null);
  const [nomeSala, setNomeSala] = useState(''); 
  const [isHost, setIsHost] = useState(false);
  const [meuJogadorId, setMeuJogadorId] = useState(null);

  useEffect(() => {
    joinRoom(salaId);
    const myId = localStorage.getItem('meuJogadorId'); 
    setMeuJogadorId(myId); // Armazena o ID no estado

    const fetchSalaInfo = async () => {
      try {
        const { data } = await api.get(`/rooms/${salaId}`); 
        if (data) {
          setNomeSala(data.nome_sala || 'Sala Clandestina');
          
          // --- CORREÇÃO APLICADA AQUI ---
          // IDs são tratados para remover espaços em branco antes da comparação
          const meuIdTratado = myId ? String(myId).trim() : null;
          const hostIdTratado = data.host_id ? String(data.host_id).trim() : null;

          // Debug para o console (F12)
          console.log("Meu ID (localStorage):", meuIdTratado);
          console.log("Host ID (API):", hostIdTratado);

          const euSouHost = meuIdTratado === hostIdTratado;
          console.log("Eu sou o host?", euSouHost);
          
          setIsHost(euSouHost);
          // --- FIM DA CORREÇÃO ---
        }
      } catch (e) { setNomeSala('Sala Clandestina'); }
    };

    const fetchMe = async () => {
      try {
        const { data } = await api.get('/auth/me'); 
        setMeuJogador({
          nome: data.nome_de_usuario,
          avatarId: data.avatar_nome,
          rank: data.rank || 5 // ❗ DADO FALSO! Atualize sua API
        });
      } catch (e) {
        setMeuJogador({
          nome: localStorage.getItem('nome_de_usuario') || 'Player 1',
          avatarId: localStorage.getItem('avatar_id') || 'vitaooriginal',
          rank: 5 // ❗ DADO FALSO!
        });
      }
    };
    
    fetchMe();
    fetchSalaInfo(); 

    const handlePlayersUpdate = (payload) => {
      // Também usa .trim() para consistência ao encontrar o oponente
      const meuIdTratado = myId ? String(myId).trim() : null;
      const oponenteData = payload.jogadores.find(j => String(j.jogador_id).trim() !== meuIdTratado);
      
      if (oponenteData) {
        setOponente({
          nome: oponenteData.nome_de_usuario,
          avatarId: oponenteData.avatar_nome,
          rank: oponenteData.rank || '??' // ❗ DADO FALSO! Atualize seu backend
        });
      } else {
        setOponente(null);
      }
    };
    
    const handleMatchStart = (data) => navigate(`/game/${salaId}`);

    socket.on('room:players_updated', handlePlayersUpdate);
    socket.on('match:start', handleMatchStart); 
    api.get(`/rooms/${salaId}/players`)
       .then(response => handlePlayersUpdate(response.data))
       .catch(err => console.error("Erro ao buscar jogadores:", err));

    return () => {
      socket.off('room:players_updated', handlePlayersUpdate);
      socket.off('match:start', handleMatchStart);
    };
  }, [salaId, navigate]);


  const handleStartMatch = () => {
    if (isHost && oponente) {
      socket.emit('match:initiate_start', { salaId });
    }
  };

  const handleLeaveRoom = () => {
    navigate('/lobby');
  };

  // Renderiza status no estilo "Cyber"
  const renderStatusAndActions = () => {
    const statusStyle = "text-xl text-yellow-400 animate-pulse font-mono";
    if (!oponente) {
      return <p className={statusStyle}>[ ESPERANDO JOGADOR 02... ]</p>;
    }
    // Esta condição agora deve funcionar corretamente
    if (oponente && isHost) {
      return <GlitchButton onClick={handleStartMatch}>INICIAR PARTIDA</GlitchButton>;
    }
    if (oponente && !isHost) {
      return <p className={statusStyle}>[ ESPERANDO HOST INICIAR... ]</p>;
    }
    return null;
  };

  // --- JSX ATUALIZADO COM A ESTÉTICA CYBERPUNK (image_b1d273.jpg) ---
  return (
    <div className="flex flex-col h-screen w-full bg-black text-white p-8 overflow-hidden font-sans">
      
      {/* 1. TOPO: Botão de Voltar e Título */}
      <div className="w-full flex justify-between items-center mb-4">
        <GlitchButton onClick={handleLeaveRoom}>
          &lt; VOLTAR AO LOBBY
        </GlitchButton>
        
        <motion.div 
          className="text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl text-gray-400 font-semibold uppercase tracking-widest">
            {nomeSala || 'Carregando...'}
          </h1>
          <p className="text-lg text-cyan-400 font-mono">
            SALA ID: {salaId}
          </p>
        </motion.div>
        
        <div style={{ width: '150px' }} /> {/* Espaçador */}
      </div>

      {/* 2. CENTRO: Área dos Jogadores (flex-grow) */}
      <div className="flex-grow flex items-center justify-center w-full">
        <div className="flex flex-row items-center justify-around w-full max-w-5xl">
          
          {/* Jogador 1 (Você) - SEM NOME ACIMA */}
          <PlayerCard 
            playerTitle="PLAYER 01"
            player={meuJogador}
            isOpponent={false}
            aguardando={!meuJogador}
          />

          {/* VS - Cor Laranja/Vermelho com brilho */}
          <motion.div
            className="text-8xl font-black text-orange-500 mx-8"
            style={{ textShadow: '0 0 15px rgba(249, 115, 22, 0.5)' }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { delay: 0.5 } }}
          >
                <GlitchText text="Versus" fontSize={3} color="rgb(57, 255, 20)" fontWeight="bold" textAlign="center" font="https://fonts.gstatic.com/s/orbitron/v35/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1ny_Cmxpg.ttf" />
          </motion.div>

          {/* Jogador 2 (Oponente) - SEM NOME ACIMA */}
          <PlayerCard 
            playerTitle="PLAYER 02"
            player={oponente}
            isOpponent={true}
            aguardando={!oponente}
          />

        </div>
      </div>

      {/* 3. FUNDO: Área de Status e Ações */}
      <div className="w-full flex justify-center pb-8 h-16 items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={oponente ? (isHost ? 'host' : 'guest') : 'waiting'}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {renderStatusAndActions()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
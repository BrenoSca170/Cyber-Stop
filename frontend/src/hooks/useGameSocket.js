// src/hooks/useGameSocket.js
import { useState, useEffect, useRef } from 'react';
import socket, { joinRoom } from '../lib/socket';
import api from '../lib/api'; 

// 1. Remova 'onReceivingAnswers' dos parâmetros
export function useGameSocket(salaId) {
  // ... (Estados antigos)
  const [rodadaId, setRodadaId] = useState(null);
  const [letra, setLetra] = useState('');
  const [temas, setTemas] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  // const [placarRodada, setPlacarRodada] = useState({}); // <-- SUBSTITUÍDO
  const [totais, setTotais] = useState({});
  const [finalizado, setFinalizado] = useState(false);
  const [vencedor, setVencedor] = useState(null);
  const [isLocked, setIsLocked] = useState(true);
  
  // --- NOSSOS NOVOS ESTADOS ---
  const [roundResults, setRoundResults] = useState(null); // Armazena os resultados detalhados (palavras + pontos)
  const [lastReaction, setLastReaction] = useState(null); // Armazena a última reação de emoji recebida
  // --- FIM DOS NOVOS ESTADOS ---

  const [showJumpscare, setShowJumpscare] = useState(false);
  const [jumpscareData, setJumpscareData] = useState({});
  const [activeSkipPowerUpId, setActiveSkipPowerUpId] = useState(null);
  const [activeSkipOpponentPowerUpId, setActiveSkipOpponentPowerUpId] = useState(null);
  const [revealPending, setRevealPending] = useState(false);
  const [revealedAnswer, setRevealedAnswer] = useState(null);

  // JUMPSCARE USE REF 0
  const jumpscareCooldownRef = useRef(0);


  useEffect(() => {
    console.log(`useGameSocket INICIADO. Sala: ${salaId}`);

    const onReady = (data) => {
      console.log("round:ready recebido:", data);
      setRodadaId(data.rodada_id);
      setLetra(data.letra);
      setTemas(data.temas || []);
      setTimeLeft(null);
      setIsLocked(true);
      setTotais({}); 
      setFinalizado(false);
      setVencedor(null);
      setActiveSkipPowerUpId(null);
      setActiveSkipOpponentPowerUpId(null);
      setRevealPending(false);
      setRevealedAnswer(null);
      setShowJumpscare(false);
    };

    const onStarted = ({ duration, timeLeft }) => {
      console.log("round:started recebido, duração:", duration, "tempo restante:", timeLeft);
      setTimeLeft(timeLeft !== undefined ? timeLeft : duration);
      setIsLocked(false);
      setRoundResults(null); 
    };

    const onTick = (t) => {
      setTimeLeft(t);
    };

    const onEnd = (payload) => {
      console.log("round:end recebido, salvando resultados:", payload);
      setRoundResults(payload.roundDetails || {}); 
      setTotais(payload.totais || {});
      setTimeLeft(null);
      setIsLocked(true);
      setRodadaId(null);
      setLetra('');
      setTemas([]);
    };

    const onMatchEnd = ({ totais, vencedor }) => {
      console.log("match:end recebido:", { totais, vencedor });
      setFinalizado(true);
      setTotais(totais || {});
      setVencedor(vencedor);
      setIsLocked(true);
    };
    
    const onJumpscareEffect = ({ attackerId, image, sound, duration }) => {
      const now = Date.now();
      const COOLDOWN_MS = 5000;
      if (jumpscareCooldownRef.current && now < jumpscareCooldownRef.current) {
        console.log('[useGameSocket] Ignorando jumpscare reemitido (cooldown ativo).');
        return;
      }
      jumpscareCooldownRef.current = now + COOLDOWN_MS;
      setJumpscareData({ attackerId, image, sound, duration: 2 });
      setShowJumpscare(true);
    };

    const onEnableSkip = ({ powerUpId }) => {
        setActiveSkipPowerUpId(powerUpId);
    };

    const onEnableSkipOpponent = ({ powerUpId }) => {
        setActiveSkipOpponentPowerUpId(powerUpId);
    };

    const onAnswerRevealed = ({ temaNome, resposta, oponenteId }) => {
        setRevealedAnswer({ temaNome, resposta, oponenteId });
        setRevealPending(false);
    };

    const onCategoryDisregarded = ({ temaId, temaNome, attackerId }) => {
        // Este evento será tratado no GameScreen
    };

    const onPowerUpAck = ({ codigo, message }) => {
        if (codigo === 'REVEAL_OPPONENT_ANSWER') {
            setRevealPending(true);
        }
    };

    const onPowerUpError = ({ message }) => {
        console.error("powerup:error recebido:", message);
        alert(`Erro ao usar power-up: ${message}`);
    };

    const onAppError = ({ context, message }) => {
        console.error(`app:error recebido (${context}):`, message);
        alert(`Ocorreu um erro no servidor (${context}). Tente novamente ou recarregue a página.`);
    };
    
    const onStopping = ({ roundId }) => {
      setIsLocked(true);
    };
    
    const onPlayerReacted = (data) => {
        setLastReaction({ ...data, timestamp: Date.now() }); 
    };

    socket.on('round:ready', onReady);
    socket.on('round:started', onStarted);
    socket.on('round:tick', onTick);
    socket.on('round:stopping', onStopping); 
    socket.on('round:end', onEnd);
    socket.on('match:end', onMatchEnd);
    socket.on('effect:jumpscare', onJumpscareEffect);
    socket.on('effect:enable_skip', onEnableSkip);
    socket.on('effect:enable_skip_opponent', onEnableSkipOpponent);
    socket.on('effect:answer_revealed', onAnswerRevealed);
    socket.on('effect:category_disregarded', onCategoryDisregarded);
    socket.on('powerup:ack', onPowerUpAck);
    socket.on('powerup:error', onPowerUpError);
    socket.on('app:error', onAppError);
    socket.on('player:reacted', onPlayerReacted);

    const fetchCurrentRound = async () => {
      joinRoom(salaId);
      try {
        const response = await api.get(`/matches/current/${salaId}`);
        if (!response.data.hasActiveRound) {
          await api.post('/matches/start', { sala_id: Number(salaId), duration: 20 });
        }
      } catch (error) {
        console.error("[useGameSocket] Erro ao buscar ou iniciar partida:", error);
        alert(`Erro ao carregar a partida: ${error.response?.data?.error || error.message}`);
      }
    };

    if (socket.connected) {
      fetchCurrentRound();
    } else {
      socket.connect();
      socket.once('connect', fetchCurrentRound);
    }

    return () => {
      console.log("Limpando listeners do useGameSocket");
      socket.off('round:ready', onReady);
      socket.off('round:started', onStarted);
      socket.off('round:tick', onTick);
      socket.off('round:stopping', onStopping);
      socket.off('round:end', onEnd);
      socket.off('match:end', onMatchEnd);
      socket.off('effect:jumpscare', onJumpscareEffect);
      socket.off('effect:enable_skip', onEnableSkip);
      socket.off('effect:enable_skip_opponent', onEnableSkipOpponent);
      socket.off('effect:answer_revealed', onAnswerRevealed);
      socket.off('effect:category_disregarded', onCategoryDisregarded);
      socket.off('powerup:ack', onPowerUpAck);
      socket.off('powerup:error', onPowerUpError);
      socket.off('app:error', onAppError);
      socket.off('player:reacted', onPlayerReacted);
      socket.off('connect', fetchCurrentRound);
    };
  }, [salaId]); 

  // --- MUDANÇA NO RETORNO ---
  return {
    socket,
    gameState: {
      rodadaId,
      letra,
      temas,
      timeLeft,
      // placarRodada, // <-- SUBSTITUÍDO
      roundResults, // <-- NOVO
      totais,
      finalizado,
      vencedor,
      isLocked,
    },
    effectsState: {
      showJumpscare,
      setShowJumpscare,
      jumpscareData,
      activeSkipPowerUpId,
      setActiveSkipPowerUpId,
      activeSkipOpponentPowerUpId,
      setActiveSkipOpponentPowerUpId,
      revealPending,
      revealedAnswer,
      lastReaction, // <-- NOVO
    }
  };
  // --- FIM DA MUDANÇA NO RETORNO ---
}
// src/hooks/useGameSocket.js
import { useState, useEffect } from 'react';
import socket, { joinRoom } from '../lib/socket';
import api from '../lib/api'; // <-- 1. IMPORTAR API

// 1. Remova 'onReceivingAnswers' dos parâmetros
export function useGameSocket(salaId) {
  // ... (Todos os useState continuam iguais)
  const [rodadaId, setRodadaId] = useState(null);
  const [letra, setLetra] = useState('');
  const [temas, setTemas] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [placarRodada, setPlacarRodada] = useState({});
  const [totais, setTotais] = useState({});
  const [finalizado, setFinalizado] = useState(false);
  const [vencedor, setVencedor] = useState(null);
  const [isLocked, setIsLocked] = useState(true);
  const [showJumpscare, setShowJumpscare] = useState(false);
  const [jumpscareData, setJumpscareData] = useState({});
  const [activeSkipPowerUpId, setActiveSkipPowerUpId] = useState(null);
  const [revealPending, setRevealPending] = useState(false);
  const [revealedAnswer, setRevealedAnswer] = useState(null);


  useEffect(() => {
    console.log(`useGameSocket INICIADO. Conectando à sala ${salaId}...`);
    joinRoom(salaId);

    // ... (onReady, onStarted, onTick... continuam iguais)
    const onReady = (data) => {
      console.log("round:ready recebido:", data);
      setRodadaId(data.rodada_id);
      setLetra(data.letra);
      setTemas(data.temas || []);
      setTimeLeft(null);
      setIsLocked(true);
      setActiveSkipPowerUpId(null);
      setRevealPending(false);
      setRevealedAnswer(null);
      setShowJumpscare(false);
      setPlacarRodada({});
      setTotais({}); // Garante que totais da rodada anterior são limpos
      setFinalizado(false);
      setVencedor(null);
    };
    const onStarted = ({ duration }) => {
      console.log("round:started recebido, duração:", duration);
      setTimeLeft(duration);
      setIsLocked(false);
    };
    const onTick = (t) => { setTimeLeft(t); };
    const onEnd = ({ roundId, roundScore, totais }) => {
      console.log("round:end recebido:", { roundId, roundScore, totais });
      setPlacarRodada(roundScore || {});
      setTotais(totais || {});
      setTimeLeft(null);
      setIsLocked(true);
    };
    const onMatchEnd = ({ totais, vencedor }) => {
      console.log("match:end recebido:", { totais, vencedor });
      setFinalizado(true);
      setTotais(totais || {});
      setVencedor(vencedor);
      setIsLocked(true);
    };
    const onJumpscareEffect = ({ attackerId, image, sound, duration }) => {
        console.log(`effect:jumpscare recebido de ${attackerId}, duração: ${duration}s`);
        setJumpscareData({ attackerId, image, sound, duration });
        setShowJumpscare(true);
    };
    const onEnableSkip = ({ powerUpId }) => {
        console.log(`effect:enable_skip recebido para powerUpId: ${powerUpId}`);
        setActiveSkipPowerUpId(powerUpId);
    };
    const onAnswerRevealed = ({ temaNome, resposta, oponenteId }) => {
        console.log(`effect:answer_revealed recebido: Oponente=${oponenteId}, Tema=${temaNome}, Resposta=${resposta}`);
        setRevealedAnswer({ temaNome, resposta, oponenteId });
        setRevealPending(false);
    };
    const onPowerUpAck = ({ codigo, message }) => {
        console.log(`powerup:ack recebido: ${codigo} - ${message}`);
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
    
    // 2. Simplifique o onStopping
    const onStopping = async ({ roundId }) => {
      console.log("round:stopping recebido:", roundId);
      setIsLocked(true);
      // A responsabilidade de enviar respostas foi movida para o GameScreen.jsx
    };

    // ... (Todos os outros listeners continuam iguais)

    // Registrar todos os listeners
    socket.on('round:ready', onReady);
    socket.on('round:started', onStarted);
    socket.on('round:tick', onTick);
    socket.on('round:stopping', onStopping); // Listener ainda existe
    socket.on('round:end', onEnd);
    socket.on('match:end', onMatchEnd);
    socket.on('effect:jumpscare', onJumpscareEffect);
    socket.on('effect:enable_skip', onEnableSkip);
    socket.on('effect:answer_revealed', onAnswerRevealed);
    socket.on('powerup:ack', onPowerUpAck);
    socket.on('powerup:error', onPowerUpError);
    socket.on('app:error', onAppError);


    // --- 2. INÍCIO DA NOVA CORREÇÃO ---
    // Função para "chamar" a partida
    const fetchMatch = async () => {
      try {
        console.log(`[useGameSocket] Listeners registrados. Chamando /matches/start...`);
        // Esta chamada vai fazer o backend emitir 'round:ready' e 'round:started'
        // que serão pegos pelos listeners acima.
        await api.post('/matches/start', { sala_id: Number(salaId), duration: 20 });
      } catch (error) {
        console.error("[useGameSocket] Erro ao chamar /matches/start:", error);
        alert(`Erro ao carregar a partida: ${error.response?.data?.error || error.message}`);
      }
    };

    // Se o socket já estiver conectado, chama.
    if (socket.connected) {
      fetchMatch();
    } else {
      // Se não, espera conectar e *então* chama.
      // (usamos .once para garantir que rode só uma vez)
      socket.once('connect', fetchMatch);
    }
    // --- FIM DA NOVA CORREÇÃO ---


    // Função de limpeza
    return () => {
      console.log("Limpando listeners do useGameSocket");
      // ... (todos os socket.off)
      socket.off('round:ready', onReady);
      socket.off('round:started', onStarted);
      socket.off('round:tick', onTick);
      socket.off('round:stopping', onStopping);
      socket.off('round:end', onEnd);
      socket.off('match:end', onMatchEnd);
      socket.off('effect:jumpscare', onJumpscareEffect);
      socket.off('effect:enable_skip', onEnableSkip);
      socket.off('effect:answer_revealed', onAnswerRevealed);
      socket.off('powerup:ack', onPowerUpAck);
      socket.off('powerup:error', onPowerUpError);
      socket.off('app:error', onAppError);
      socket.off('connect', fetchMatch); // Limpa o listener 'connect' também
    };
  }, [salaId]); // 3. A dependência 'onReceivingAnswers' foi removida

  // Retorno continua igual
  return {
    socket,
    gameState: {
      rodadaId,
      letra,
      temas,
      timeLeft,
      placarRodada,
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
      revealPending,
      revealedAnswer,
    }
  };
}
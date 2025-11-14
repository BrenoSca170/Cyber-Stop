// src/hooks/useGameSocket.js
import { useState, useEffect } from 'react';
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


  useEffect(() => {
    console.log(`useGameSocket INICIADO. Conectando à sala ${salaId}...`);
    joinRoom(salaId);

    const onReady = (data) => {
      console.log("round:ready recebido:", data);
      setRodadaId(data.rodada_id);
      setLetra(data.letra);
      setTemas(data.temas || []);
      setTimeLeft(null);
      setIsLocked(true);
      // setPlacarRodada({}); // <-- REMOVIDO
      setTotais({}); 
      setFinalizado(false);
      setVencedor(null);
      
      // Limpa estados de power-up da rodada anterior
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
      
      // --- MUDANÇA IMPORTANTE ---
      // Limpa os resultados da rodada anterior para a tela de jogo reaparecer
      setRoundResults(null); 
      // --- FIM DA MUDANÇA ---
    };

    const onTick = (t) => { setTimeLeft(t); };

    // --- MUDANÇA IMPORTANTE: O onEnd agora controla a tela de resultados ---
    const onEnd = (payload) => {
      // O payload do backend agora deve enviar { roundId, roundDetails, totais }
      console.log("round:end recebido, salvando resultados:", payload);
      
      // 1. Salva os resultados detalhados (palavras + pontos)
      // Usamos 'payload.roundDetails' (do backend) para 'roundResults' (estado frontend)
      setRoundResults(payload.roundDetails || {}); 
      
      // 2. Salva os totais atualizados
      setTotais(payload.totais || {});
      
      // 3. Trava o tempo e o estado
      setTimeLeft(null);
      setIsLocked(true);
      
      // 4. IMPORTANTE: Limpa a rodada ativa
      // Isso sinaliza ao GameScreen que a rodada de jogo acabou
      // e a tela de resultados deve ser mostrada.
      setRodadaId(null);
      setLetra('');
      setTemas([]);
    };
    // --- FIM DA MUDANÇA ---

    const onMatchEnd = ({ totais, vencedor }) => {
      console.log("match:end recebido:", { totais, vencedor });
      setFinalizado(true);
      setTotais(totais || {});
      setVencedor(vencedor);
      setIsLocked(true);
    };
    
    // ... (Listeners de Jumpscare, Skip, etc. continuam iguais)
    const onJumpscareEffect = ({ attackerId, image, sound, duration }) => {
        console.log(`effect:jumpscare recebido de ${attackerId}, duração: ${duration}s`);
        setJumpscareData({ attackerId, image, sound, duration });
        setShowJumpscare(true);
    };
    const onEnableSkip = ({ powerUpId }) => {
        console.log(`effect:enable_skip recebido para powerUpId: ${powerUpId}`);
        setActiveSkipPowerUpId(powerUpId);
    };
    const onEnableSkipOpponent = ({ powerUpId }) => {
        console.log(`effect:enable_skip_opponent recebido para powerUpId: ${powerUpId}`);
        setActiveSkipOpponentPowerUpId(powerUpId);
    };
    const onAnswerRevealed = ({ temaNome, resposta, oponenteId }) => {
        console.log(`effect:answer_revealed recebido: Oponente=${oponenteId}, Tema=${temaNome}, Resposta=${resposta}`);
        setRevealedAnswer({ temaNome, resposta, oponenteId });
        setRevealPending(false);
    };
    const onCategoryDisregarded = ({ temaId, temaNome, attackerId }) => {
        console.log(`effect:category_disregarded recebido: Categoria ${temaId} (${temaNome}) desconsiderada por jogador ${attackerId}`);
        // Este evento será tratado no GameScreen para atualizar o estado de input
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
    
    const onStopping = async ({ roundId }) => {
      console.log("round:stopping recebido:", roundId);
      setIsLocked(true);
    };
    
    // --- NOVO LISTENER: Para receber reações de emoji ---
    const onPlayerReacted = (data) => {
        console.log(`player:reacted recebido: ${data.fromPlayerId} enviou ${data.emojiId}`);
        // Adiciona um timestamp para garantir que o estado mude
        // e dispare uma re-renderização, mesmo que o emoji seja o mesmo
        setLastReaction({ ...data, timestamp: Date.now() }); 
    };
    // --- FIM DO NOVO LISTENER ---


    // Registrar todos os listeners
    socket.on('round:ready', onReady);
    socket.on('round:started', onStarted);
    socket.on('round:tick', onTick);
    socket.on('round:stopping', onStopping); 
    socket.on('round:end', onEnd); // Modificado
    socket.on('match:end', onMatchEnd);
    socket.on('effect:jumpscare', onJumpscareEffect);
    socket.on('effect:enable_skip', onEnableSkip);
    socket.on('effect:enable_skip_opponent', onEnableSkipOpponent);
    socket.on('effect:answer_revealed', onAnswerRevealed);
    socket.on('effect:category_disregarded', onCategoryDisregarded);
    socket.on('powerup:ack', onPowerUpAck);
    socket.on('powerup:error', onPowerUpError);
    socket.on('app:error', onAppError);
    socket.on('player:reacted', onPlayerReacted); // NOVO

    // ... (Lógica de fetchCurrentRound continua igual)
    const fetchCurrentRound = async () => {
      console.log(`[useGameSocket] Garantindo entrada na sala ${salaId} (fetchCurrentRound)`);
      joinRoom(salaId);
      try {
        console.log(`[useGameSocket] Buscando rodada atual para sala ${salaId}...`);
        const response = await api.get(`/matches/current/${salaId}`);
        if (response.data.hasActiveRound) {
          console.log(`[useGameSocket] Rodada atual encontrada, eventos serão emitidos pelo backend`);
        } else {
          console.log(`[useGameSocket] Nenhuma rodada ativa. Iniciando nova partida...`);
          await api.post('/matches/start', { sala_id: Number(salaId), duration: 20 });
        }
      } catch (error) {
        console.error("[useGameSocket] Erro ao buscar rodada atual:", error);
        try {
          await api.post('/matches/start', { sala_id: Number(salaId), duration: 20 });
        } catch (startError) {
          console.error("[useGameSocket] Erro ao iniciar partida:", startError);
          alert(`Erro ao carregar a partida: ${startError.response?.data?.error || startError.message}`);
        }
      }
    };

    if (socket.connected) {
      fetchCurrentRound();
    } else {
      socket.once('connect', fetchCurrentRound);
    }


    // Função de limpeza
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
      socket.off('connect', fetchCurrentRound); 
      socket.off('player:reacted', onPlayerReacted); // NOVO
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
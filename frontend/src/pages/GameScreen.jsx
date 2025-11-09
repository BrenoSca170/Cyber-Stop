// src/pages/GameScreen.jsx
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react'; // <-- IMPORTAR useEffect

// Nossos novos Hooks
import { useGameSocket } from '../hooks/useGameSocket';
import { useGameInput } from '../hooks/useGameInput';
import { usePowerUps } from '../hooks/usePowerUps';
import socket from '../lib/socket';

// Nossos novos Componentes de UI
import JumpscareOverlay from '../components/game/JumpscareOverlay';
import MatchEndScreen from '../components/game/MatchEndScreen';
import WaitingForRound from '../components/game/WaitingForRound';
import ActiveRound from '../components/game/ActiveRound';

export default function GameScreen() {
  const { salaId } = useParams();
  const meuJogadorId = Number(
    localStorage.getItem('meuJogadorId') ||
    sessionStorage.getItem('meuJogadorId') ||
    '0'
  );

  // --- HOOKS DE LÓGICA ---
  
  // 1. Hook de Socket: Gerencia o estado principal do jogo (CHAMADO PRIMEIRO)
  const { 
    socket, 
    gameState, 
    effectsState 
  } = useGameSocket(salaId); // Não precisa mais da callback
  
  // Desestrutura o estado para passar para os outros hooks
  const { rodadaId, isLocked, finalizado, totais, vencedor } = gameState;
  const { activeSkipPowerUpId, setActiveSkipPowerUpId, activeSkipOpponentPowerUpId, setActiveSkipOpponentPowerUpId } = effectsState;

  // 2. Hook de Input: Passa o gameState para ele
  const { 
    answers, 
    updateAnswer, 
    skippedCategories, 
    setSkippedCategories,
    disregardedCategories,
    handleCategoryDisregarded,
    onStop, 
    handleSkipCategory,
    enviarRespostas // Pega a função para o novo useEffect
  } = useGameInput(
    gameState, // Passa o objeto de estado inteiro
    salaId, 
    meuJogadorId
  );

  // Conecta o evento de categoria desconsiderada do socket ao handler
  useEffect(() => {
    const handler = (data) => {
      console.log('GameScreen recebeu effect:category_disregarded:', data);
      handleCategoryDisregarded(data.temaId);
    };
    
    // Adiciona listener adicional no GameScreen para conectar ao handler local
    socket.on('effect:category_disregarded', handler);
    
    return () => {
      socket.off('effect:category_disregarded', handler);
    };
  }, [handleCategoryDisregarded]);

  // 3. Hook de Power-ups:
  const { 
    inventario, 
    loadingInventory, 
    handleUsePowerUp,
    fetchInventory 
  } = usePowerUps(
    rodadaId, 
    isLocked
  );

  // 4. NOVO EFFECT: Lida com o 'round:stopping'
  // Este effect observa a mudança em 'isLocked'. 
  // Quando 'isLocked' fica 'true' E uma rodada estava ativa (rodadaId existe),
  // ele dispara o 'enviarRespostas' que foi acionado pelo 'round:stopping'.
  useEffect(() => {
    // Só roda se 'isLocked' for true, e se uma rodada estava em andamento
    if (isLocked && rodadaId && !finalizado) {
      console.log("GameScreen detectou 'isLocked=true' (parada de rodada), enviando respostas...");
      // Envia as respostas da rodada atual, ignorando as puladas
      enviarRespostas(rodadaId, skippedCategories);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, rodadaId, finalizado]); // Depende de isLocked e rodadaId


  // --- LÓGICA DE INTERLIGAÇÃO (Mesma de antes) ---

  const onSkipCategory = (temaId) => {
    handleSkipCategory(temaId); // Do hook de input
    setActiveSkipPowerUpId(null); // Do hook de socket/effects
  };
  
  const onSkipOpponentCategory = (temaNome) => {
    // Encontra o powerup ativo e usa ele com o tema escolhido
    const powerUp = inventario.find(p => p.power_up_id === activeSkipOpponentPowerUpId);
    if (powerUp) {
      handleUsePowerUp(powerUp, temaNome); // Passa o nome do tema
      setActiveSkipOpponentPowerUpId(null); // Desativa o modo de escolha
    }
  };

  const onUsePowerUp = (powerUp) => {
    if (powerUp.code === 'SKIP_OWN_CATEGORY' && activeSkipPowerUpId) {
      alert("Pular Categoria já está ativo!"); return;
    }
    if ((powerUp.code === 'DISREGARD_OPPONENT_WORD' || powerUp.code === 'SKIP_OPPONENT_CATEGORY') && activeSkipOpponentPowerUpId) {
      alert("Desconsiderar Categoria do Oponente já está ativo!"); return;
    }
    if (powerUp.code === 'REVEAL_OPPONENT_ANSWER' && effectsState.revealPending) {
      alert("Você já ativou a revelação para esta rodada."); return;
    }
    handleUsePowerUp(powerUp); // Do hook de power-ups
  };


  // --- RENDERIZAÇÃO (Mesma de antes) ---
  return (
    <>
      {/* 1. Overlay de Jumpscare */}
      <AnimatePresence>
        {effectsState.showJumpscare && (
          <JumpscareOverlay
            imageUrl={effectsState.jumpscareData.image}
            soundUrl={effectsState.jumpscareData.sound}
            duration={effectsState.jumpscareData.duration}
            onEnd={() => effectsState.setShowJumpscare(false)}
          />
        )}
      </AnimatePresence>

      {/* 2. Conteúdo Principal da Página */}
      {finalizado ? (
        // Tela de Fim de Jogo
        <MatchEndScreen
          totais={totais}
          vencedor={vencedor}
          meuJogadorId={meuJogadorId}
          salaId={salaId}
          onReFetchInventory={fetchInventory} // Passa a função para rebuscar moedas
        />
      ) : !rodadaId ? (
        // Tela de "Aguardando"
        <WaitingForRound 
          salaId={salaId}
          // A prop socket={socket} foi REMOVIDA
        />
      ) : (
        // Tela de "Jogo Ativo"
        <ActiveRound
          salaId={salaId}
          meuJogadorId={meuJogadorId}
          gameState={gameState}
          effectsState={{...effectsState, activeSkipPowerUpId, setActiveSkipPowerUpId, activeSkipOpponentPowerUpId, setActiveSkipOpponentPowerUpId}}
          inputState={{ answers, updateAnswer, onStop, skippedCategories, disregardedCategories, handleSkipCategory: onSkipCategory }}
          powerUpState={{ inventario, loadingInventory, handleUsePowerUp: onUsePowerUp }}
          onSkipOpponentCategory={onSkipOpponentCategory}
        />
      )}
    </>
  );
}
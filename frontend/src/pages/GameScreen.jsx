// src/pages/GameScreen.jsx
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

// Nossos novos Hooks
import { useGameSocket } from '../hooks/useGameSocket';
import { useGameInput } from '../hooks/useGameInput';
import { usePowerUps } from '../hooks/usePowerUps';
import { useExitConfirmation } from '../hooks/useExitConfirmation';
import { useScreenRotation } from '../hooks/useScreenRotation';

// Nossos Componentes de UI
import JumpscareOverlay from '../components/game/JumpscareOverlay';
import MatchEndScreen from '../components/game/MatchEndScreen';
import WaitingForRound from '../components/game/WaitingForRound';
import ActiveRound from '../components/game/ActiveRound';
import RoundEndScreen from '../components/game/RoundEndScreen';
import ExitConfirmationModal from '../components/ExitConfirmationModal';
import NavigationBlocker from '../components/NavigationBlocker';

import MatrixRain from '../components/MatrixRain';
import FaultyTerminalR3F from '../components/FaultyTerminalR3F';
import PixelBlast from '../components/PixelBlast';

export default function GameScreen() {
  const { salaId } = useParams();
  const meuJogadorId = Number(
    localStorage.getItem('meuJogadorId') ||
    sessionStorage.getItem('meuJogadorId') ||
    '0'
  );

  // --- HOOKS DE LÓGICA ---

  // 1. Hook de Socket: Gerencia o estado principal do jogo (CHAMADO PRIMEIRO)
  // usa a instância de socket que o hook retorna (NÃO importe socket diretamente)
  const { 
    socket, 
    gameState, 
    effectsState 
  } = useGameSocket(salaId);

  // Hook de rotação de tela (chame ANTES de usar applyRandomRotation nos effects)
  const { applyRandomRotation } = useScreenRotation();

  // Desestrutura o estado para passar para os outros hooks
  const { rodadaId, isLocked, finalizado, totais, vencedor, roundResults } = gameState;
  const { activeSkipPowerUpId, setActiveSkipPowerUpId, activeSkipOpponentPowerUpId, setActiveSkipOpponentPowerUpId } = effectsState;

  // Hook de confirmação de saída - partida começou se está na GameScreen
  const matchStarted = true;
  const { 
    showModal, 
    confirmExit, 
    cancelExit, 
    handleExitClick,
    isInRoomOrMatch,
    exitConfirmed,
    exitCancelled
  } = useExitConfirmation(salaId, matchStarted, null, finalizado);

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
    enviarRespostas
  } = useGameInput(
    gameState,
    salaId, 
    meuJogadorId
  );

  // Conecta o evento de categoria desconsiderada do socket ao handler local
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      console.log('GameScreen recebeu effect:category_disregarded:', data);
      // data.temaId esperado
      handleCategoryDisregarded(data.temaId);
    };
    socket.on('effect:category_disregarded', handler);
    return () => {
      socket.off('effect:category_disregarded', handler);
    };
  }, [socket, handleCategoryDisregarded]);

  // Listener para o power-up de inverter tela emitido pelo backend
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      console.log('[SOCKET] effect:invert_screen recebido ->', data);
      // backend envia duration em ms (5000), mas aceitamos fallback
      const durationMs = typeof data?.duration === 'number' ? data.duration : 5000;
      applyRandomRotation(durationMs);
    };
    socket.on('effect:invert_screen', handler);
    return () => {
      socket.off('effect:invert_screen', handler);
    };
  }, [socket, applyRandomRotation]);

  // 3. Hook de Power-ups:
  const { 
    inventario, 
    loadingInventory, 
    handleUsePowerUp,
    fetchInventory 
  } = usePowerUps(
    rodadaId, 
    isLocked,
    salaId
  );

  // 4. NOVO EFFECT: Lida com o 'round:stopping' (envia respostas quando a rodada é parada)
  useEffect(() => {
    if (isLocked && rodadaId && !finalizado) {
      console.log("GameScreen detectou 'isLocked=true' (parada de rodada), enviando respostas...");
      enviarRespostas(rodadaId, skippedCategories);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, rodadaId, finalizado]);

  // --- LÓGICA DE INTERLIGAÇÃO ---

  const onSkipCategory = (temaId) => {
    handleSkipCategory(temaId);
    setActiveSkipPowerUpId(null);
  };
  
  const onSkipOpponentCategory = (temaNome) => {
    const powerUp = inventario.find(p => p.power_up_id === activeSkipOpponentPowerUpId);
    if (powerUp) {
      handleUsePowerUp(powerUp, temaNome);
      setActiveSkipOpponentPowerUpId(null);
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

    // IMPORTANTE: não aplicamos a rotação localmente aqui.
    // Enviamos ao backend através do handleUsePowerUp, que faz o emit 'powerup:use'.
    // O backend escolhe o alvo e emite 'effect:invert_screen' para o jogador alvo.
    handleUsePowerUp(powerUp);
  };

  // --- RENDERIZAÇÃO ---
  return (
    <>
      {/* Bloqueador de navegação */}
      <NavigationBlocker 
        shouldBlock={isInRoomOrMatch}
        exitConfirmed={exitConfirmed}
        exitCancelled={exitCancelled}
        showModal={showModal}
        onBlock={(proceed, reset) => {
          handleExitClick(proceed, reset);
        }}
      />
      
      {/* Modal de confirmação de saída */}
      <ExitConfirmationModal 
        isOpen={showModal}
        onConfirm={confirmExit}
        onCancel={cancelExit}
      />
      
      <div className="absolute inset-0 w-full h-full z-0 pointer-events-none opacity-70">
        <PixelBlast
          density={0.5}
          speed={0.9}
          className="w-full h-full" 
        />
      </div>

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
        <MatchEndScreen
          totais={totais}
          vencedor={vencedor}
          meuJogadorId={meuJogadorId}
          salaId={salaId}
          onReFetchInventory={fetchInventory}
        /> 
      ) : roundResults ? ( 
        <RoundEndScreen
          results={roundResults}
          temas={gameState.temas}
          jogadores={gameState.jogadores}
          salaId={salaId}
          meuJogadorId={meuJogadorId}
        />
      ) : !rodadaId ? (
        <WaitingForRound salaId={salaId} />
      ) : (
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

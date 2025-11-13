// src/hooks/useExitConfirmation.js
import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../lib/api';

/**
 * Hook para gerenciar confirmação de saída quando o jogador está em uma sala ou partida
 * @param {string} salaId - ID da sala atual (pode ser null)
 * @param {boolean} matchStarted - Se a partida já começou
 * @param {Function} onExitConfirmed - Callback quando a saída é confirmada
 */
export function useExitConfirmation(salaId, matchStarted = false, onExitConfirmed = null) {
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const location = useLocation();
  const shouldIntercept = useRef(false);
  const exitConfirmed = useRef(false); // Flag para indicar que a saída foi confirmada
  const exitCancelled = useRef(false); // Flag para indicar que a saída foi cancelada
  const beforeUnloadHandlerRef = useRef(null);
  const resetBlockerRef = useRef(null); // Ref para a função de reset do blocker

  // Detecta se está em uma sala ou partida
  useEffect(() => {
    const isWaitingRoom = location.pathname.startsWith('/waiting/');
    const isGameScreen = location.pathname.startsWith('/game/');
    shouldIntercept.current = (isWaitingRoom || isGameScreen) && salaId && (matchStarted || isWaitingRoom);
    // Reset das flags quando muda de rota (não está mais em sala/partida)
    if (!shouldIntercept.current) {
      exitConfirmed.current = false;
      exitCancelled.current = false;
    }
  }, [location.pathname, salaId, matchStarted]);

  // Função para remover o beforeunload handler
  const removeBeforeUnload = useCallback(() => {
    if (beforeUnloadHandlerRef.current) {
      window.removeEventListener('beforeunload', beforeUnloadHandlerRef.current);
      beforeUnloadHandlerRef.current = null;
    }
  }, []);

  // Função para confirmar a saída
  const confirmExit = useCallback(async () => {
    // Marca que a saída foi confirmada para desabilitar beforeunload
    exitConfirmed.current = true;
    exitCancelled.current = false; // Reset do cancelamento
    
    // Remove o handler do beforeunload imediatamente
    removeBeforeUnload();
    
    // Fecha o modal primeiro
    setShowModal(false);
    
    // Limpa a função de reset do blocker
    resetBlockerRef.current = null;
    
    if (!salaId) {
      // Se não há salaId, apenas executa a ação pendente
      if (pendingAction) {
        const action = pendingAction;
        setPendingAction(null);
        // Executa após um pequeno delay para garantir que o modal fechou
        setTimeout(() => action(), 100);
      }
      return;
    }

    try {
      // Chama a API para sair da sala
      await api.post(`/rooms/${salaId}/leave`);
      
      // Executa callback se fornecido
      if (onExitConfirmed) {
        onExitConfirmed();
      }
      
      // Executa a ação pendente (navegação, etc.)
      if (pendingAction) {
        const action = pendingAction;
        setPendingAction(null);
        // Executa após um pequeno delay para garantir que tudo foi processado
        setTimeout(() => action(), 100);
      }
    } catch (error) {
      console.error('Erro ao sair da sala:', error);
      // Reabilita o beforeunload em caso de erro
      exitConfirmed.current = false;
      alert('Erro ao sair da sala. Tente novamente.');
      setPendingAction(null);
    }
  }, [salaId, pendingAction, onExitConfirmed, removeBeforeUnload]);

  // Função para cancelar a saída
  const cancelExit = useCallback(() => {
    // Fecha o modal primeiro
    setShowModal(false);
    
    // Limpa a ação pendente completamente
    setPendingAction(null);
    
    // Se há uma função de reset do blocker, chama para cancelar a navegação bloqueada
    // Isso deve ser feito ANTES de marcar como cancelado para garantir que o blocker seja resetado
    if (resetBlockerRef.current) {
      const resetFn = resetBlockerRef.current;
      resetBlockerRef.current = null;
      // Chama o reset imediatamente
      resetFn();
    }
    
    // Marca que a saída foi cancelada (depois de resetar o blocker)
    exitCancelled.current = true;
    exitConfirmed.current = false; // Garante que não está confirmado
    
    // Reset do cancelamento após um delay maior para garantir que o blocker foi resetado
    // e que não haverá nova interceptação imediata
    setTimeout(() => {
      exitCancelled.current = false;
    }, 500);
  }, []);

  // Função para interceptar tentativas de saída
  const interceptExit = useCallback((action, resetFn = null) => {
    // Não intercepta se foi cancelado recentemente ou se já foi confirmado
    if (exitCancelled.current || exitConfirmed.current) {
      return false;
    }
    
    if (shouldIntercept.current) {
      setPendingAction(() => action);
      setShowModal(true);
      // Salva a função de reset do blocker se fornecida
      if (resetFn) {
        resetBlockerRef.current = resetFn;
      }
      return true; // Indica que a ação foi interceptada
    }
    return false; // Não intercepta, permite a ação
  }, []);

  // Intercepta beforeunload (fechar aba/reload) - apenas se não confirmou saída
  useEffect(() => {
    // Não adiciona o handler se a saída foi confirmada
    if (!shouldIntercept.current || exitConfirmed.current) {
      removeBeforeUnload();
      return;
    }

    const handleBeforeUnload = (e) => {
      // Só intercepta se a saída não foi confirmada
      if (!exitConfirmed.current) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requer returnValue
        return ''; // Alguns navegadores requerem return string
      }
    };

    beforeUnloadHandlerRef.current = handleBeforeUnload;
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      removeBeforeUnload();
    };
  }, [shouldIntercept.current, exitConfirmed.current, removeBeforeUnload]);

  // Wrapper para botões de saída
  const handleExitClick = useCallback((exitAction, resetFn = null) => {
    // Se a saída já foi confirmada, executa diretamente
    if (exitConfirmed.current) {
      exitAction();
      return;
    }
    
    // Se foi cancelado recentemente, não intercepta
    if (exitCancelled.current) {
      return;
    }
    
    if (shouldIntercept.current) {
      interceptExit(exitAction, resetFn);
    } else {
      exitAction();
    }
  }, [interceptExit]);

  return {
    showModal,
    confirmExit,
    cancelExit,
    handleExitClick,
    interceptExit,
    isInRoomOrMatch: shouldIntercept.current && !exitConfirmed.current && !exitCancelled.current,
    exitConfirmed: exitConfirmed.current,
    exitCancelled: exitCancelled.current
  };
}


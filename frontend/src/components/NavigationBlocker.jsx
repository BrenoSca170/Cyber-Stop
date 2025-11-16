// src/components/NavigationBlocker.jsx
import { useEffect, useRef } from 'react';
import { useBlocker, useLocation } from 'react-router-dom';

/**
 * Componente para bloquear navegação quando o jogador está em uma sala ou partida
 * @param {boolean} shouldBlock - Se deve bloquear a navegação
 * @param {Function} onBlock - Callback quando a navegação é bloqueada
 * @param {boolean} exitConfirmed - Se a saída foi confirmada (não deve bloquear)
 * @param {boolean} exitCancelled - Se a saída foi cancelada (não deve bloquear)
 * @param {boolean} showModal - Se o modal está aberto (para resetar quando fecha sem confirmar)
 */
export default function NavigationBlocker({ shouldBlock, onBlock, exitConfirmed = false, exitCancelled = false, showModal = false }) {
  const location = useLocation();
  const lastBlockedRef = useRef(false);
  const blockerResetFnRef = useRef(null);
  
  // Usa useBlocker se disponível (React Router v6.4+)
  // Não bloqueia se a saída foi confirmada ou cancelada
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => {
      // Não bloqueia se a saída foi confirmada ou cancelada
      if (exitConfirmed || exitCancelled) {
        return false;
      }
      
      // Não bloqueia se o modal está aberto (evita bloqueios duplicados)
      if (showModal) {
        return false;
      }
      
      // Bloqueia se está tentando sair da sala/partida E não há um bloqueio pendente
      const isLeavingRoom = shouldBlock && 
        !nextLocation.pathname.startsWith('/waiting/') && 
        !nextLocation.pathname.startsWith('/game/');
      return isLeavingRoom;
    }
  );

  // Efeito específico para quando foi cancelado: reseta o blocker imediatamente
  useEffect(() => {
    if (exitCancelled && blocker && blocker.state === 'blocked') {
      // Reseta o blocker quando foi cancelado
      try {
        if (blockerResetFnRef.current) {
          const resetFn = blockerResetFnRef.current;
          blockerResetFnRef.current = null;
          resetFn();
        } else if (blocker.reset) {
          blocker.reset();
        } else {
          // Fallback: prossegue mas não executa a ação (já foi limpa)
          blocker.proceed();
        }
      } catch (error) {
        console.warn('[NavigationBlocker] Erro ao cancelar navegação (blocker já pode ter mudado de estado):', error);
      }
      lastBlockedRef.current = false;
    }
  }, [exitCancelled, blocker]);

  // Efeito específico para quando foi confirmado: prossegue com a navegação
  useEffect(() => {
    if (exitConfirmed && blocker && blocker.state === 'blocked') {
      // Garante que o blocker ainda está bloqueado antes de prosseguir
      try {
        blocker.proceed();
      } catch (error) {
        console.warn('[NavigationBlocker] Erro ao prosseguir com navegação (já pode ter sido desbloqueada):', error);
      }
      lastBlockedRef.current = false;
      blockerResetFnRef.current = null;
    }
  }, [exitConfirmed, blocker]);

  // Quando a navegação é bloqueada, chama o callback
  useEffect(() => {
    // Não faz nada se foi cancelado ou confirmado
    if (exitCancelled || exitConfirmed) {
      return;
    }
    
    // Não faz nada se o modal está aberto (já foi interceptado)
    if (showModal) {
      return;
    }
    
    // Quando a navegação é bloqueada e não há modal aberto, chama o callback
    if (blocker && blocker.state === 'blocked' && onBlock) {
      // Cria função para prosseguir
      const proceedFn = () => {
        // Verifica se o blocker ainda está bloqueado antes de prosseguir
        if (blocker.state === 'blocked') {
          try {
            blocker.proceed();
          } catch (error) {
            console.warn('[NavigationBlocker] Erro ao prosseguir (blocker já pode ter mudado de estado):', error);
          }
        }
        lastBlockedRef.current = false;
        blockerResetFnRef.current = null;
      };
      
      // Cria função para resetar (cancelar)
      const resetFn = () => {
        // Só reseta se ainda está bloqueado
        if (blocker.state === 'blocked') {
          try {
            // Tenta resetar o blocker
            if (blocker.reset) {
              blocker.reset();
            } else {
              // Fallback: prossegue (mas a ação não será executada porque pendingAction será limpa)
              blocker.proceed();
            }
          } catch (error) {
            console.warn('[NavigationBlocker] Erro ao resetar blocker (já pode ter mudado de estado):', error);
          }
        }
        lastBlockedRef.current = false;
        blockerResetFnRef.current = null;
      };
      
      // Salva a função de reset
      blockerResetFnRef.current = resetFn;
      
      // Chama o callback apenas se ainda não foi chamado para esta tentativa
      if (!lastBlockedRef.current) {
        lastBlockedRef.current = true;
        // Passa tanto a função proceed quanto reset para o callback
        onBlock(proceedFn, resetFn);
      }
    } else if (blocker && blocker.state !== 'blocked') {
      // Reset quando o blocker não está mais bloqueado
      lastBlockedRef.current = false;
      blockerResetFnRef.current = null;
    }
  }, [blocker, onBlock, exitConfirmed, exitCancelled, showModal]);


  return null;
}


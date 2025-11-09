// fronted/src/hooks/useGameInput.js
import { useState, useEffect } from 'react';
import { produce } from 'immer';
// (NOVO) Importar o socket
import socket from '../lib/socket';

/**
 * Hook para gerenciar os inputs (respostas) do jogo.
 * @param {object} gameState - O estado vindo do useGameSocket
 * @param {string} salaId - ID da sala
 * @param {number} meuJogadorId - ID do jogador logado
 */
export function useGameInput(gameState, salaId, meuJogadorId) {
  const { rodadaId, isLocked, currentRound } = gameState;
  
  // Estado das respostas
  // Formato: { [temaId]: "resposta" }
  const [answers, setAnswers] = useState({});
  // Formato: Set<temaId>
  const [skippedCategories, setSkippedCategories] = useState(new Set());
  // Formato: Set<temaId>
  const [disregardedCategories, setDisregardedCategories] = useState(new Set());

  // Limpa as respostas e estados de pulo quando a rodada muda
  useEffect(() => {
    if (rodadaId) {
      console.log(`[useGameInput] Nova rodada ${rodadaId}. Limpando inputs.`);
      // Inicializa 'answers' com chaves para cada tema
      const initialAnswers = {};
      currentRound.temas?.forEach(tema => {
        initialAnswers[tema.id] = '';
      });
      setAnswers(initialAnswers);
      setSkippedCategories(new Set());
      setDisregardedCategories(new Set());
    }
  }, [rodadaId]); // Depende apenas de rodadaId

  
  /**
   * (NOVO - Passo 4) Envia as respostas finais para o backend via socket.
   * Esta função é chamada pelo GameScreen.jsx quando o 'isLocked' vira true.
   */
  const enviarRespostas = (currentRodadaId, localSkippedCategories) => {
    // 1. Filtra as respostas para não enviar as puladas
    const respostasParaEnviar = { ...answers };
    
    // O 'answers' usa tema.id como chave, e 'localSkippedCategories' é um Set de tema.id
    localSkippedCategories.forEach(temaId => {
      if (temaId in respostasParaEnviar) {
        // Não deleta, apenas envia vazio (ou o backend pode ignorar)
        // Vamos deletar para enviar menos dados
        delete respostasParaEnviar[temaId];
      }
    });

    console.log(`[useGameInput] Enviando ${Object.keys(respostasParaEnviar).length} respostas para rodada ${currentRodadaId}`);
    
    // 2. Emite para o novo handler do socket
    socket.emit('round:submit_answers', {
        rodadaId: currentRodadaId,
        answers: respostasParaEnviar // Envia o objeto de respostas { [temaId]: "resposta" }
    });
  };

  /**
   * Atualiza o estado de uma resposta para um tema específico.
   * @param {number} temaId - O ID do tema
   * @param {string} value - A nova resposta
   */
  const updateAnswer = (temaId, value) => {
    if (isLocked) return; // Não permite atualizar se a rodada estiver travada
    
    setAnswers(
      produce(draft => {
        draft[temaId] = value;
      })
    );
  };

  /**
   * Dispara o evento de STOP para o servidor.
   */
  const onStop = () => {
    if (isLocked) return; // Já foi parado
    
    console.log(`[useGameInput] Pressionou STOP para rodada ${rodadaId}`);
    socket.emit('round:stop', {
      salaId: salaId,
      roundId: rodadaId,
      by: meuJogadorId,
    });
  };

  /**
   * Marca uma categoria como "pulada" (SKIP_OWN_CATEGORY).
   * @param {number} temaId - O ID do tema a pular
   */
  const handleSkipCategory = (temaId) => {
    console.log(`[useGameInput] Pulando categoria ${temaId}`);
    setSkippedCategories(
      produce(draft => {
        draft.add(temaId);
      })
    );
    // Limpa a resposta desse campo
    updateAnswer(temaId, '');
  };

  /**
   * Marca uma categoria como "desconsiderada" (vinda do oponente).
   * @param {number} temaId - O ID do tema
   */
  const handleCategoryDisregarded = (temaId) => {
    console.log(`[useGameInput] Categoria ${temaId} foi desconsiderada por oponente.`);
    setDisregardedCategories(
      produce(draft => {
        draft.add(temaId);
      })
    );
    // Limpa a resposta desse campo
    updateAnswer(temaId, '');
  };

  return {
    answers,
    updateAnswer,
    skippedCategories,
    setSkippedCategories, // Usado pelo GameScreen
    disregardedCategories,
    handleCategoryDisregarded, // Usado pelo GameScreen
    onStop,
    handleSkipCategory,
    enviarRespostas // (NOVO) Exporta a função para o GameScreen
  };
}
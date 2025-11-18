// src/hooks/usePowerUps.js
import { useState, useEffect } from 'react';
import api from '../lib/api';
import socket from '../lib/socket';

// Adicione salaId aqui para robustez (Opcional, mas recomendado)
export function usePowerUps(rodadaId, isLocked, salaId) { 
  const [inventario, setInventario] = useState([]);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // Função para buscar o inventário do jogador na API
  const fetchInventory = async () => {
    console.log("Tentando buscar inventário...");
    setLoadingInventory(true);
    try {
      const { data } = await api.get('/shop/inventory');
      const filteredInventory = (data?.inventario || []).filter(p => p.quantidade > 0);
      setInventario(filteredInventory);
      console.log("Inventário buscado com sucesso:", filteredInventory);
    } catch (error) {
      console.error("Erro detalhado ao buscar inventário:", error.response?.data || error.message || error);
    } finally {
      setLoadingInventory(false);
    }
  };

  // Efeito para buscar inventário ao carregar e ouvir atualizações
  useEffect(() => {
    fetchInventory(); // Busca inicial

    const onInventoryUpdate = () => {
        console.log("inventory:updated recebido");
        fetchInventory(); // Rebusca o inventário
    };

    socket.on('inventory:updated', onInventoryUpdate);

    return () => {
      socket.off('inventory:updated', onInventoryUpdate);
    };
  }, []); // Roda apenas uma vez na montagem

  // --- FUNÇÃO PARA USAR POWER-UP ---
  const handleUsePowerUp = (powerUp, targetTemaNome = null) => {
    if (!rodadaId || isLocked) {
      alert("Aguarde a rodada estar ativa.");
      return;
    }
    
    // Validação extra recomendada
    if (!salaId) {
      alert("Erro: ID da sala não encontrado. Não é possível usar o power-up.");
      return;
    }

    let targetPlayerId = null;
    let confirmUse = true;

    // Lógica específica por power-up antes de emitir
    if (powerUp.code === 'BLUR_OPPONENT_SCREEN_5S') {
        confirmUse = window.confirm(`Usar "${powerUp.nome}" para assustar os oponentes?`);
    } else if (powerUp.code === 'SKIP_OWN_CATEGORY') {
        // A verificação de 'activeSkipPowerUpId' será feita no componente
        confirmUse = window.confirm(`Ativar o power-up "${powerUp.nome}"? Você poderá pular UMA categoria.`);
    } else if (powerUp.code === 'DISREGARD_OPPONENT_WORD' || powerUp.code === 'SKIP_OPPONENT_CATEGORY') {
        // A verificação de 'activeSkipOpponentPowerUpId' será feita no componente
        confirmUse = window.confirm(`Ativar o power-up "${powerUp.nome}"? Você poderá desconsiderar UMA categoria do oponente.`);
    }

    if (!confirmUse) return;

    // Emitir evento para o backend processar o uso
    socket.emit('powerup:use', {
      // --- A CORREÇÃO PRINCIPAL DO FRONTEND ESTÁ AQUI ---
      powerUpId: powerUp.power_up_id, // DE: power_Up_Id PARA: power_up_id
      // -----------------------------------------------------
      rodadaId: rodadaId, 
      salaId: salaId, // Enviando salaId explicitamente
      targetPlayerId: targetPlayerId,
      targetTemaNome: targetTemaNome
    });
    console.log(`Comando 'powerup:use' emitido para ${powerUp.code}${targetTemaNome ? ` com tema ${targetTemaNome}` : ''}`);
  };

  return {
    inventario,
    loadingInventory,
    handleUsePowerUp,
    fetchInventory // Exporta para o MatchEndScreen poder rebuscar moedas
  };
}
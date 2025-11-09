// fronted/src/hooks/usePowerUps.js
import { useState, useEffect } from 'react';
import api from '../lib/api';
import socket from '../lib/socket';

export function usePowerUps(rodadaId, isLocked) {
  // 'inventario' agora guarda os power-ups (que são 'items')
  const [inventario, setInventario] = useState([]);
  // 'moedas' é guardado separadamente
  const [moedas, setMoedas] = useState(0); 
  const [loadingInventory, setLoadingInventory] = useState(false);

  // Função para buscar o inventário (agora traz moedas E power-ups)
  const fetchInventory = async () => {
    console.log("Tentando buscar inventário...");
    setLoadingInventory(true);
    try {
      // (NOVO) Chama a nova rota de API
      const { data } = await api.get('/shop/inventory');
      setInventario(data?.inventario || []); // Array de power-ups que o jogador possui
      setMoedas(data?.moedas || 0);         // Número de moedas
      console.log("Inventário buscado:", data);
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
        console.log("socket 'inventory:updated' recebido");
        fetchInventory(); // Rebusca o inventário
    };

    socket.on('inventory:updated', onInventoryUpdate);

    return () => {
      socket.off('inventory:updated', onInventoryUpdate);
    };
  }, []); // Roda apenas uma vez na montagem

  // --- FUNÇÃO PARA USAR POWER-UP ---
  const handleUsePowerUp = (powerUpItem, targetTemaNome = null) => {
    if (!rodadaId || isLocked) {
      alert("Aguarde a rodada estar ativa.");
      return;
    }

    // 'powerUpItem' agora é o objeto que vem do novo inventário
    // Ex: { item_id: 5, nome: 'Pular Categoria', codigo_identificador: 'SKIP_WORD', qtde: 2 }
    
    let confirmUse = true;
    const itemName = powerUpItem.nome;
    const itemCode = powerUpItem.codigo_identificador;

    // Lógica de confirmação (pode manter a mesma)
    if (itemCode === 'BLUR_OPPONENT_SCREEN_5S' || itemCode === 'JUMPSCARE') {
        confirmUse = window.confirm(`Usar "${itemName}" para assustar os oponentes?`);
    } else if (itemCode === 'SKIP_OWN_CATEGORY') {
        confirmUse = window.confirm(`Ativar o power-up "${itemName}"? Você poderá pular UMA categoria.`);
    } else if (itemCode === 'REVEAL_OPPONENT_ANSWER') {
         confirmUse = window.confirm(`Usar "${itemName}"? A resposta será mostrada no final da rodada.`);
    } else if (itemCode === 'DISREGARD_OPPONENT_WORD' || itemCode === 'SKIP_OPPONENT_CATEGORY') {
        confirmUse = window.confirm(`Ativar o power-up "${itemName}"? Você poderá desconsiderar UMA categoria do oponente.`);
    }

    if (!confirmUse) return;

    // (NOVO) Emite o 'item_id' em vez do antigo 'power_up_id'
    socket.emit('powerup:use', {
      powerUpId: powerUpItem.item_id, // Envia o item_id
      targetPlayerId: null,
      targetTemaNome: targetTemaNome
    });
    console.log(`Comando 'powerup:use' emitido para ${itemCode} (ID: ${powerUpItem.item_id})`);
  };

  return {
    inventario, // Agora só contém power-ups (formato: Item + qtde)
    moedas,     // Saldo de moedas
    loadingInventory,
    handleUsePowerUp,
    fetchInventory // Exporta para o MatchEndScreen poder rebuscar moedas
  };
}
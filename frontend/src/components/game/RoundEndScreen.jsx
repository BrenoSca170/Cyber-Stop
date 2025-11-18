// src/components/game/RoundEndScreen.jsx
import React, { useEffect, useState } from 'react';
import socket from '../../lib/socket';
// 1. IMPORTAR AS FERRAMENTAS DE ANIMAÇÃO
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut } from 'lucide-react';

// Componente de Reações (Modal de Emojis) - (Sem mudanças)
function EmojiReactions({ salaId }) {
  const emojis = [
    { id: 'gg', text: 'GG' },
    { id: 'wow', text: '😮' },
    { id: 'laugh', text: '😂' },
    { id: 'fail', text: '🤦' },
  ];

  const handleReactionClick = (emojiId) => {
    socket.emit('player:react', {
      salaId: salaId,
      emojiId: emojiId,
    });
  };

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-950/80 border border-purple-500/50 p-2 rounded-xl shadow-lg flex gap-2 z-40 backdrop-blur-sm">
      {emojis.map((emoji) => (
        <button
          key={emoji.id}
          onClick={() => handleReactionClick(emoji.id)}
          className="p-3 bg-gray-800/50 border border-purple-700/50 rounded-lg hover:bg-purple-900/60 transition-all text-2xl text-white shadow-purple-glow"
          title={emoji.id}
        >
          {emoji.text}
        </button>
      ))}
    </div>
  );
}

// 2. Componente de Animação de Emoji (VERSÃO ATUALIZADA)
function EmojiSparkle({ reactions }) {
  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-30">
      {/*
        AnimatePresence é o que permite a animação de "saída" (exit)
        quando o emoji é removido do array 'reactions'.
      */}
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.key} // A key é essencial para o AnimatePresence
            className="absolute text-5xl"
            style={{
              left: `${reaction.x}%`, // Posição X aleatória
              bottom: '10%', // Começa perto da parte de baixo
              textShadow: '0 0 8px rgba(192, 132, 252, 0.8), 0 0 16px rgba(192, 132, 252, 0.6)', // Cyberpunk glow
            }}
            // Animação de entrada
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            // Animação principal
            animate={{ opacity: [1, 1, 0.8, 0], y: -250, scale: 1.2 }}
            // Animação de saída (não será usada se 'animate' já define 'opacity: 0')
            exit={{ opacity: 0, y: -300, scale: 0.8 }}
            // Duração e tipo de animação
            transition={{ duration: 2, ease: 'easeOut', times: [0, 0.3, 0.8, 1] }}
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// 3. Componente Principal da Tela (Sem mudanças na lógica)
export default function RoundEndScreen({ results, salaId, meuJogadorId, temas = [], jogadores = [], handleExitClick, navigate }) {
  const [activeReactions, setActiveReactions] = useState([]);

  // Pega os IDs dos jogadores a partir dos resultados (mais confiável)
  const playerIds = Object.keys(results[Object.keys(results)[0]] || {});
  
  // Nomes dos jogadores (mockado - você deve passar isso via props)
  const playerNames = {
    [meuJogadorId]: 'Você',
    ...playerIds
      .filter(id => Number(id) !== meuJogadorId)
      .reduce((acc, id) => ({ ...acc, [id]: `Oponente ${id}` }), {})
  };
  
  // Lista de temas a partir dos resultados
  const temaNomes = Object.keys(results);

  // Listener para receber reações
  useEffect(() => {
    const handleReaction = ({ fromPlayerId, emojiId }) => {
      const emojiMap = { 'gg': 'GG', 'wow': '😮', 'laugh': '😂', 'fail': '🤦' };
      const newReaction = {
        key: Date.now() + Math.random(), // Chave única
        emoji: emojiMap[emojiId] || '?',
        fromId: fromPlayerId,
        x: Math.random() * 80 + 10, // Posição X aleatória (entre 10% e 90%)
      };
      
      // Adiciona a nova reação ao estado
      setActiveReactions(prev => [...prev, newReaction]);
      
      // Limpa a reação do estado após a animação (2000ms = 2s)
      // O AnimatePresence cuidará da animação de saída
      setTimeout(() => {
        setActiveReactions(prev => prev.filter(r => r.key !== newReaction.key));
      }, 2000);
    };

    socket.on('player:reacted', handleReaction);
    return () => {
      socket.off('player:reacted', handleReaction);
    };
  }, []);

  return (
    // 'relative' é crucial para o 'absolute' dos emojis funcionar
    <div className="relative w-full h-full flex flex-col items-center justify-center text-white p-8 overflow-hidden">
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => handleExitClick(() => navigate('/'))}
          className="bg-red-600/50 hover:bg-red-500/80 text-white p-2 rounded-lg transition-colors cursor-target"
          title="Sair da Partida"
        >
          <LogOut size={20} />
        </button>
      </div>
      
      {/* Efeito de animação de emoji */}
      <EmojiSparkle reactions={activeReactions} />

      <h1 className="text-4xl font-bold mb-6 text-yellow-400 z-10">Resultados da Rodada</h1>
      
      <div className="w-full max-w-4xl bg-gray-800 bg-opacity-80 rounded-lg shadow-xl overflow-hidden z-20">
        <table className="w-full min-w-full text-left">
          <thead className="bg-gray-900">
            <tr>
              <th className="p-4 uppercase text-sm font-semibold">Tema</th>
              {playerIds.map(id => (
                <th key={id} className="p-4 uppercase text-sm font-semibold">
                  {playerNames[id] || `Jogador ${id}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {temaNomes.map(tema => (
              <tr key={tema} className="hover:bg-gray-700">
                <td className="p-4 font-bold">{tema}</td>
                {playerIds.map(pId => {
                  const item = results[tema][pId];
                  const pontos = item?.pontos || 0;
                  const cor = pontos === 10 ? 'text-green-400' : (pontos === 5 ? 'text-yellow-400' : 'text-red-500');

                  return (
                    <td key={pId} className="p-4">
                      <span className="block">{item?.resposta || '-'}</span>
                      <span className={`font-bold ${cor}`}>{pontos} pts</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-lg animate-pulse z-10">Aguardando próxima rodada...</p>
      
      {/* Modal de Emojis */}
      <EmojiReactions salaId={salaId} />
    </div>
  );
}
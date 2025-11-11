// src/components/game/PlayerCard.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { avatarList } from '../../lib/avatarList'; 

// Lógica do Avatar
const getAvatarUrl = (avatarId) => {
  if (!avatarId) return avatarList[0].src; //
  const avatar = avatarList.find(a => a.nome === avatarId); //
  return avatar ? avatar.src : avatarList[0].src; //
};

export default function PlayerCard({ 
  player,           // Objeto: { nome, avatarId, rank }
  playerTitle,      // String: "PLAYER 01" ou "PLAYER 02"
  isOpponent = false, 
  aguardando = false 
}) {
  
  const avatarUrl = getAvatarUrl(player?.avatarId); //

  const variants = {
    hidden: { x: isOpponent ? '100vw' : '-100vw', opacity: 0 }, //
    visible: { x: 0, opacity: 1, transition: { type: 'spring', duration: 0.8 } }, //
    exit: { x: isOpponent ? '100vw' : '-100vw', opacity: 0, transition: { duration: 0.3 } } //
  };

  // Define as cores Neon com base no oponente
  const glowColor = isOpponent ? 'shadow-red-500/30' : 'shadow-cyan-500/30'; //
  const borderColor = isOpponent ? 'border-red-500' : 'border-cyan-400'; //
  const textColor = isOpponent ? 'text-red-400' : 'text-cyan-400'; //

  // --- Renderização condicional (Aguardando vs. Conectado) ---
  
  const renderCardContent = () => {
    if (aguardando) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <span className="text-8xl font-mono animate-pulse">?</span>
          <h3 className="text-3xl font-bold font-cyber mt-4">SEARCHING...</h3>
          <span className="font-mono text-lg mt-2">RANK: --</span>
          <span className="font-mono text-lg mt-1">STATUS: OFFLINE</span>
        </div>
      );
    }
    
    // Jogador Conectado
    return (
      <div className="flex flex-col items-center justify-between h-full p-6">
        {/* 1. Título (PLAYER 01) - ISSO COMBINA COM A IMAGEM */}
        <h2 className={`text-2xl font-bold font-cyber ${textColor}`}>
          {playerTitle}
        </h2>
        
        {/* 2. Avatar */}
        <motion.img 
          src={avatarUrl} 
          alt="Avatar" 
          className="w-48 h-48 rounded-full border-4 border-gray-700 shadow-lg object-cover" //
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, transition: { delay: 0.5 } }} //
        />
        
        {/* 3. Informações (Nome, Rank, Status) */}
        <div className="text-center">
          <h3 className="text-3xl font-bold font-cyber text-white">
            {player?.nome || 'CARREGANDO...'}
          </h3>
          <span className="font-mono text-lg text-gray-300 block mt-2">
            RANK: {player?.rank || '??'}
          </span>
          <span className={`font-mono text-lg ${textColor} block mt-1`}>
            STATUS: READY
          </span>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      className={`w-80 h-[28rem] bg-gray-950 border-2 ${aguardando ? 'border-dashed border-gray-700' : borderColor} rounded-lg shadow-lg ${glowColor}`} //
      variants={variants}
      initial="hidden"
      animate="visible"
      exit="exit"
      // Recriando o efeito "augmented-ui" da imagem
      style={{
        clipPath: 'polygon(0 10%, 10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%)' //
      }}
    >
      {renderCardContent()}
    </motion.div>
  );
}
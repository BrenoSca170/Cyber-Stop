// frontend/src/components/PlayerCard.jsx
import React from 'react';
import { User, Shield, Gem } from 'lucide-react';
import avatarList from '../lib/avatarList';
import characterList from '../lib/characterList';

const PlayerCard = ({ playerName, isHost, avatarNome, personagemNome, ranking, isPlayer2 }) => {
    const avatar = avatarList.find(a => a.nome === avatarNome);
    const avatarUrl = avatar ? avatar.url : avatarList.find(a => a.nome === 'default')?.url;

    const character = characterList.find(c => c.nome === personagemNome);
    const characterUrl = character ? character.url : characterList.find(c => c.nome === 'default')?.url;

    const cardAlignment = isPlayer2 ? 'items-end' : 'items-start';
    const textAlign = isPlayer2 ? 'text-right' : 'text-left';

    return (
        <div className={`w-full md:w-2/5 lg:w-1/3 flex flex-col ${cardAlignment} relative`}>
            {/* Holographic Avatar */}
            <div className={`relative w-48 h-32 mb-4 border-2 ${isPlayer2 ? 'border-secondary' : 'border-warning'} bg-black/50 p-2`}>
                {avatarUrl ? (
                    <img src={avatarUrl} alt={`Avatar de ${playerName || 'Jogador'}`} className="w-full h-full object-cover opacity-75" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <User size={60} className="text-text-muted" />
                    </div>
                )}
                <div className="absolute inset-0 bg-grid-pattern opacity-20"></div>
                <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2_ opacity-50"></div>
                <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2_ opacity-50"></div>
                <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2_ opacity-50"></div>
                <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2_ opacity-50"></div>
            </div>

            {/* Player Name */}
            <h2 className={`text-4xl lg:text-5xl font-bold font-cyber tracking-widest uppercase ${isPlayer2 ? 'text-secondary' : 'text-warning'}`}>
                {playerName || 'Aguardando...'}
            </h2>
            {isHost && <span className="text-sm text-warning font-semibold mt-1">(Host)</span>}

            {/* Character Image */}
            <div className="relative w-full h-96 mt-4">
                {characterUrl ? (
                    <img src={characterUrl} alt={`Personagem de ${playerName || 'Jogador'}`} className="w-full h-full object-contain" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <User size={120} className="text-text-muted" />
                    </div>
                )}
            </div>

            {/* No Status Section */}
        </div>
    );
};

export default PlayerCard;


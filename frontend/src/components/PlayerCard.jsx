// frontend/src/components/PlayerCard.jsx
import React from 'react';
import { User } from 'lucide-react';
import avatarList from '../lib/avatarList';

const PlayerCard = ({ playerName, isHost, avatarNome, isPlayer2 }) => {
    const avatar = avatarList.find(a => a.nome === avatarNome);
    const avatarUrl = avatar ? avatar.url : avatarList.find(a => a.nome === 'default')?.url;

    const cardClasses = `
        w-full md:w-2/5 lg:w-1/3 
        bg-black/50 p-6 
        flex flex-col items-center 
        [transform-style:preserve-3d]
        transition-all duration-500
        ${isPlayer2 ? 'md:flex-col-reverse' : ''}
    `;

    const nameClasses = `
        text-3xl lg:text-4xl font-bold font-cyber tracking-widest
        mt-4
        ${isPlayer2 ? 'text-secondary' : 'text-warning'}
        ${isPlayer2 ? 'md:mt-0 md:mb-4' : ''}
    `;

    return (
        <div 
            className={cardClasses}
            data-augmented-ui={isPlayer2 ? "tl-clip-x tr-clip br-clip-x bl-clip border" : "tl-clip tr-clip-x br-clip bl-clip-x border"}
            style={{
                '--aug-border-bg': isPlayer2 ? '#00e5ff' : '#ffc700',
                '--aug-tl-clip-x': '50%',
                '--aug-tr-clip-x': '50%',
                '--aug-br-clip-x': '50%',
                '--aug-bl-clip-x': '50%',
            }}
        >
            <div className="w-48 h-48 lg:w-64 lg:h-64 rounded-full overflow-hidden border-4 border-current">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={`Avatar de ${playerName || 'Jogador'}`} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-bg-secondary flex items-center justify-center">
                        <User size={80} className="text-text-muted" />
                    </div>
                )}
            </div>
            <h2 className={nameClasses}>
                {playerName || 'Aguardando...'}
            </h2>
            {isHost && <span className="text-xs text-warning font-semibold mt-1">(Host)</span>}
        </div>
    );
};

export default PlayerCard;

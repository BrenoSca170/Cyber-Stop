// src/components/game/MatchEndScreen.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Users, GitMerge, Home } from 'lucide-react'; // Ícones temáticos

export default function MatchEndScreen({ totais, vencedor, meuJogadorId, onReFetchInventory }) {
  const navigate = useNavigate();

  // Rebusca o inventário (para moedas) quando esta tela aparece
  useEffect(() => {
    if(onReFetchInventory) {
      onReFetchInventory();
    }
  }, [onReFetchInventory]);

  const isEmpate = vencedor?.empate;
  const myScore = totais[meuJogadorId] || 0;
  const isWinner = !isEmpate && vencedor?.jogador_id === meuJogadorId;
  const isLoser = !isEmpate && vencedor?.jogador_id !== meuJogadorId;
  const isTieParticipant = isEmpate && vencedor?.jogadores?.includes(meuJogadorId);

  return (
    // Aplicado tema: fonte, cores, augmented-ui e 3D
    <div 
      className="max-w-xl mx-auto text-white p-6 bg-bg-secondary shadow-xl text-center font-cyber [perspective:1000px]"
      data-augmented-ui="tl-clip tr-clip br-clip bl-clip border inlay"
    >
      <h2 className="text-3xl font-bold mb-4 text-text-header">Partida encerrada!</h2>

      {/* Mensagem de Resultado */}
      {isWinner && (
        <div className="mb-3 [transform:translateZ(10px)]">
          <Trophy className="w-16 h-16 text-warning mx-auto animate-pulse" />
          <p className="text-2xl text-warning font-semibold mt-2">🎉 Você Venceu! 🎉</p>
        </div>
      )}
      {isLoser && (
         <div className="mb-3 [transform:translateZ(10px)]">
            <p className="text-2xl text-text-muted font-semibold">😢 Fim da Conexão 😢</p>
         </div>
      )}
      {isTieParticipant && (
        <div className="mb-3 [transform:translateZ(10px)]">
          <Users className="w-16 h-16 text-secondary mx-auto" />
          <p className="text-2xl text-secondary font-semibold mt-2">🤝 Empate! 🤝</p>
        </div>
      )}
      {isEmpate && !isTieParticipant && (
        <div className="mb-3 [transform:translateZ(10px)]">
          <GitMerge className="w-16 h-16 text-text-muted mx-auto" />
          <p className="text-2xl text-text-muted font-semibold mt-2">🤝 Empate entre outros jogadores.</p>
        </div>
      )}

      {/* Detalhes do Vencedor/Empate */}
      {isEmpate ? (
        <p className="mb-2 [transform:translateZ(10px)]">
          <b>Empate</b> entre Jogadores <b className="text-secondary">{Array.isArray(vencedor?.jogadores) ? vencedor.jogadores.join(' e ') : '-'}</b>
          {' '}com <b className="text-warning">{vencedor?.total ?? 0} pontos</b> cada.
        </p>
      ) : (
        <p className="mb-2 [transform:translateZ(10px)]">
          Vencedor: Jogador <b className="text-warning">{vencedor?.jogador_id ?? '-'}</b> com <b className="text-warning">{vencedor?.total ?? 0} pontos</b>.
        </p>
      )}
       <p className="mb-4 [transform:translateZ(10px)]">Sua pontuação final: <b className="text-xl text-accent">{myScore}</b></p>

      {/* Placar Final Detalhado */}
      <h3 className="mt-5 mb-2 font-medium text-lg text-text-header [transform:translateZ(10px)]">Placar Final Detalhado</h3>
      <pre className="bg-bg-input p-3 rounded mt-1 text-sm text-left overflow-x-auto max-h-40 [transform:translateZ(10px)]">
        {JSON.stringify(totais, null, 2)}
      </pre>
      
      {/* Botão para voltar ao Lobby */}
      <button
          onClick={() => navigate('/')}
          className="mt-6 bg-secondary hover:bg-secondary/80 text-black px-6 py-2 rounded text-lg font-semibold 
                     transition-all hover:scale-105 [transform-style:preserve-3d] hover:[transform:translateZ(15px)] active:[transform:translateZ(5px)]
                     flex items-center justify-center gap-2 mx-auto cursor-target"
          data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
      >
          <Home size={20} />
          Voltar ao Lobby
      </button>
    </div>
  );
}
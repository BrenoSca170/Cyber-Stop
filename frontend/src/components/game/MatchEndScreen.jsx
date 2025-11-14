// src/components/game/MatchEndScreen.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Users, GitMerge, Home } from 'lucide-react'; // Ícones temáticos
import Ranking from '../Ranking.jsx'; // Componente de ranking

export default function MatchEndScreen({ totais, vencedor, meuJogadorId, salaId, onReFetchInventory }) {
  const navigate = useNavigate();

  // Rebusca o inventário (para moedas) quando esta tela aparece
  // Rebusca o inventário (para moedas) quando esta tela aparece
  useEffect(() => {
    if (onReFetchInventory) {
      onReFetchInventory();
    }
    // Queremos rodar só uma vez quando a tela monta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const isEmpate = vencedor?.empate;
  const myScore = totais[meuJogadorId] || 0;
  const isWinner = !isEmpate && vencedor?.jogador_id === meuJogadorId;
  const isLoser = !isEmpate && vencedor?.jogador_id !== meuJogadorId;
  const isTieParticipant = isEmpate && vencedor?.jogadores?.includes(meuJogadorId);

  // --- [NOVO] Transforma o placar em um array ordenado ---
  // Transforma { "1": 100, "2": 150 } em [ ["2", 150], ["1", 100] ]
  const sortedTotais = Object.entries(totais || {}).sort(([, ptsA], [, ptsB]) => ptsB - ptsA);


  return (
    // Aplicado tema: fonte, cores, augmented-ui e 3D
    <div 
      className="max-w-xl mx-auto text-white p-6 bg-bg-secondary shadow-xl text-center font-cyber [perspective:1000px]"
      data-augmented-ui="tl-clip tr-clip br-clip bl-clip border inlay"
    >
      <h2 className="text-3xl font-bold mb-4 text-text-header">Partida encerrada!</h2>

      {/* Mensagem de Resultado (sem alteração) */}
      {isWinner && (
        <div 
          className="mb-3 p-4 [transform:translateZ(10px)] bg-bg-input/30"
          data-augmented-ui="tl-clip br-clip border inlay"
        >
          <Trophy className="w-16 h-16 text-warning mx-auto animate-pulse" />
          <p className="text-2xl text-warning font-semibold mt-2">🎉 Você Venceu! 🎉</p>
        </div>
      )}
      {isLoser && (
         <div 
           className="mb-3 p-4 [transform:translateZ(10px)] bg-bg-input/30"
           data-augmented-ui="tl-clip br-clip border inlay"
         >
            <p className="text-2xl text-text-muted font-semibold">😢 Você perdeu 😢</p>
         </div>
      )}
      {isTieParticipant && (
        <div 
          className="mb-3 p-4 [transform:translateZ(10px)] bg-bg-input/30"
          data-augmented-ui="tl-clip br-clip border inlay"
        >
          <Users className="w-16 h-16 text-secondary mx-auto" />
          <p className="text-2xl text-secondary font-semibold mt-2">🤝 Empate! 🤝</p>
        </div>
      )}
      {isEmpate && !isTieParticipant && (
        <div 
          className="mb-3 p-4 [transform:translateZ(10px)] bg-bg-input/30"
          data-augmented-ui="tl-clip br-clip border inlay"
        >
          <GitMerge className="w-16 h-16 text-text-muted mx-auto" />
          <p className="text-2xl text-text-muted font-semibold mt-2">🤝 Empate entre outros jogadores.</p>
        </div>
      )}

      {/* Detalhes do Vencedor/Empate (sem alteração) */}
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

      {/* === [INÍCIO] PLACAR FINAL EM TABELA === */}
      <h3 className="mt-5 mb-2 font-medium text-lg text-text-header [transform:translateZ(10px)]">Placar Final Detalhado</h3>
      <div className="overflow-x-auto [transform:translateZ(10px)]">
        <table className="w-full border-collapse border border-secondary/30 font-mono text-sm">
          <thead data-augmented-ui="tl-clip tr-clip" className="bg-bg-input/70">
            <tr>
              <th className="p-2 border-r border-secondary/30 text-center text-text-muted uppercase">Posição</th>
              <th className="p-2 border-r border-secondary/30 text-left text-text-muted uppercase">Jogador ID</th>
              <th className="p-2 text-right text-text-muted uppercase">Pontuação Final</th>
            </tr>
          </thead>
          <tbody>
            {sortedTotais.map(([jId, pts], index) => {
              const isMe = Number(jId) === meuJogadorId;
              return (
                <tr 
                  key={jId} 
                  // Destaca a linha do jogador atual
                  className={`bg-bg-input/30 hover:bg-bg-input/50 transition-colors ${isMe ? 'bg-accent/20 hover:bg-accent/30' : ''}`}
                >
                  <td className="p-2 border-r border-t border-secondary/30 font-medium text-warning text-center">
                    #{index + 1}
                  </td>
                  <td className={`p-2 border-r border-t border-secondary/30 font-medium ${isMe ? 'text-accent font-bold' : 'text-secondary'}`}>
                    Jogador {jId}
                  </td>
                  <td className={`p-2 border-t border-secondary/30 text-right font-bold text-lg ${isMe ? 'text-accent' : 'text-white'}`}>
                    {pts} pts
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* === [FIM] PLACAR FINAL EM TABELA === */}
      
      {/* Ranking da Sala */}
      {salaId && (
        <div className="mt-8">
          <Ranking salaId={salaId} limit={10} autoRefresh={false} />
        </div>
      )}
      
      {/* Botão para voltar ao Lobby (sem alteração) */}
      <button
          onClick={() => navigate('/')}
          className="mt-6 bg-secondary hover:bg-secondary/80 text-black px-6 py-2 rounded text-lg font-semibold 
                     transition-all hover:scale-105 [transform-style:preserve-3d] 
                     [transform:translateZ(0px)]
                     hover:[transform:translateZ(15px)] active:[transform:translateZ(5px)]
                     flex items-center justify-center gap-2 mx-auto cursor-target
                     relative z-10"
          data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
      >
          <Home size={20} />
          Voltar ao Lobby
      </button>
    </div>
  );
}
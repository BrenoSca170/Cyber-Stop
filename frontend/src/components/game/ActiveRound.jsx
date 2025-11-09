// src/components/game/ActiveRound.jsx
import CategoryRow from '../CategoryRow';
import { Zap, Loader2, Star, SkipForward, Eye, Ghost } from 'lucide-react';

export default function ActiveRound({
  salaId,
  meuJogadorId,
  gameState,
  effectsState,
  inputState,
  powerUpState,
  onSkipOpponentCategory,
}) {
  const { 
    letra, 
    temas, 
    timeLeft, 
    placarRodada, 
    totais, 
    rodadaId, 
    isLocked, 
    finalizado 
  } = gameState;

  const { activeSkipPowerUpId, setActiveSkipPowerUpId, activeSkipOpponentPowerUpId, setActiveSkipOpponentPowerUpId, revealPending, revealedAnswer } = effectsState;
  const { answers, updateAnswer, onStop, skippedCategories, disregardedCategories, handleSkipCategory } = inputState;
  const { inventario, loadingInventory, handleUsePowerUp } = powerUpState;

  const onSkip = (temaId) => {
    if (!activeSkipPowerUpId || isLocked) return;
    handleSkipCategory(temaId);
    setActiveSkipPowerUpId(null); 
  }
  
  const onSkipOpponent = (temaNome) => {
    if (!activeSkipOpponentPowerUpId || isLocked) return;
    if (onSkipOpponentCategory) {
      onSkipOpponentCategory(temaNome);
    }
    setActiveSkipOpponentPowerUpId(null); 
  };

  const onUsePowerUp = (powerUp) => {
    if (powerUp.code === 'SKIP_OWN_CATEGORY' && activeSkipPowerUpId) {
      alert("Pular Categoria já está ativo!"); return;
    }
    if ((powerUp.code === 'DISREGARD_OPPONENT_WORD' || powerUp.code === 'SKIP_OPPONENT_CATEGORY') && activeSkipOpponentPowerUpId) {
      alert("Desconsiderar Categoria do Oponente já está ativo!"); return;
    }
    if (powerUp.code === 'REVEAL_OPPONENT_ANSWER' && revealPending) {
      alert("Você já ativou a revelação para esta rodada."); return;
    }
    if (powerUp.code === 'SKIP_WORD') {
      // Mostra um diálogo para escolher qual palavra pular
      const temasList = temas.map(t => t.nome).join(', ');
      const escolha = window.prompt(`Qual palavra você deseja pular?\n\nTemas disponíveis: ${temasList}`);
      if (!escolha) return; // Usuário cancelou
      
      // Verifica se a escolha é válida
      const temaEscolhido = temas.find(t => t.nome.toLowerCase().trim() === escolha.toLowerCase().trim());
      if (!temaEscolhido) {
        alert(`Tema "${escolha}" não encontrado nesta rodada.`);
        return;
      }
      
      // Passa o nome do tema para o handleUsePowerUp
      handleUsePowerUp(powerUp, temaEscolhido.nome);
      return;
    }
    handleUsePowerUp(powerUp);
  }

  return (
    // Aplicada fonte cyber e perspectiva
    <div className="max-w-3xl mx-auto text-white space-y-4 p-4 relative font-cyber [perspective:1000px]">
      
      {/* Cabeçalho com Timer e ID (com augmented-ui) */}
      <header 
        className="flex items-center justify-between bg-bg-secondary p-3 shadow sticky top-[72px] z-10"
        data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
      >
        <div className="text-sm">
            Nó <b className="font-mono text-secondary">#{salaId}</b> | ID: <b className="font-mono text-accent">{meuJogadorId}</b>
        </div>
        {/* Timer */}
        <div className={`font-mono text-2xl font-bold tabular-nums ${timeLeft !== null && timeLeft <= 10 ? 'text-primary animate-pulse' : 'text-warning'}`}>
           ⏱ {timeLeft !== null ? `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}` : '--:--'}
        </div>
      </header>

      <>
        {/* Mostra a Letra da Rodada (com augmented-ui) */}
        <div 
          className="text-center bg-bg-secondary p-3 shadow"
          data-augmented-ui="tl-clip tr-clip br-clip bl-clip border inlay"
        >
          <h2 className="text-2xl font-semibold text-text-header">
            Letra da Rodada: <span className="font-mono text-4xl text-accent ml-2">{letra || '?'}</span>
          </h2>
        </div>

        {/* Linhas de Categoria com Botão Skip */}
        <div className="space-y-3">
          {(temas || []).map(t => {
            const isSkipped = skippedCategories.has(t.id);
            const isDisregarded = disregardedCategories.has(t.id);
            return (
              <div key={t.id} className="flex items-center gap-2">
                 <CategoryRow
                    categoryName={t.nome}
                    value={isSkipped ? '--- PULADO ---' : (isDisregarded ? '--- DESCONSIDERADA ---' : (answers[t.id] || ''))}
                    onChange={e => updateAnswer(t.id, e.target.value)}
                    isDisabled={isLocked || timeLeft === 0 || isSkipped || isDisregarded}
                    // Passa a classe para o input quando pulado ou desconsiderado
                    inputClassName={isSkipped ? 'text-text-muted/70 italic bg-bg-input/50' : (isDisregarded ? 'text-red-400/70 italic bg-red-900/30' : '')}
                  />
                  {/* Botão de Pular */}
                  {activeSkipPowerUpId && !isSkipped && (
                       <button
                          onClick={() => onSkip(t.id)}
                          disabled={isLocked || timeLeft === 0}
                          className="bg-warning hover:bg-warning/80 text-black p-2 rounded-lg disabled:opacity-50 transition-transform hover:scale-110"
                          title="Pular esta categoria (usará o power-up)"
                        >
                           <SkipForward size={20}/>
                       </button>
                  )}
                  {/* Botão de Desconsiderar Categoria do Oponente */}
                  {activeSkipOpponentPowerUpId && (
                       <button
                          onClick={() => onSkipOpponent(t.nome)}
                          disabled={isLocked || timeLeft === 0}
                          className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg disabled:opacity-50 transition-transform hover:scale-110"
                          title="Desconsiderar esta categoria do oponente (usará o power-up)"
                        >
                           <SkipForward size={20} className="rotate-180"/>
                       </button>
                  )}
              </div>
             );
           })}
        </div>

        {/* Botões de Ação: STOP e Power-ups */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-6 [transform-style:preserve-3d]">
          <button
            className="bg-primary px-8 py-3 rounded-lg text-xl font-bold text-black hover:bg-primary/80 
                       disabled:bg-gray-600 disabled:cursor-not-allowed flex-grow md:flex-grow-0 
                       transition-all 
                       [transform:translateZ(0px)]
                       hover:scale-105 hover:[transform:translateZ(10px)] active:[transform:translateZ(2px)]
                       relative z-10"
            onClick={onStop}
            disabled={!rodadaId || isLocked || timeLeft === 0}
            data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
          >
            STOP!
          </button>

          {/* Seção de Power-ups disponíveis */}
          <div className="flex items-center gap-2 flex-wrap justify-center md:justify-end flex-grow">
             <h3 className="text-sm font-semibold mr-2 text-secondary w-full md:w-auto text-center md:text-right hidden sm:block">Módulos (Power-ups):</h3>
              {loadingInventory && <Loader2 className="animate-spin text-secondary" />}
              {!loadingInventory && inventario.length === 0 && <span className="text-xs text-text-muted/70 italic">Nenhum</span>}
              {!loadingInventory && inventario.map(p => (
                  <button
                      key={p.power_up_id}
                      onClick={() => onUsePowerUp(p)} 
                      disabled={isLocked || timeLeft === 0}
                      className="bg-primary/80 border border-primary text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg shadow-primary/30
                                 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-transform hover:scale-110"
                      title={`${p.nome} - ${p.descricao} (x${p.quantidade})`}
                  >
                      <Zap size={12} /> {p.nome} <span className="bg-bg-primary text-secondary text-[10px] px-1.5 py-0.5 rounded-full ml-1">{p.quantidade}</span>
                  </button>
              ))}
          </div>
        </div>

        {/* Área de Resultados da Rodada / Revelação / Totais */}
        {(Object.keys(placarRodada).length > 0 || revealedAnswer || revealPending) && (
          <div 
            className="mt-6 bg-bg-secondary p-4 rounded-lg shadow space-y-4"
            data-augmented-ui="tl-clip tr-clip br-clip bl-clip border inlay"
          >

            {/* Seção para Resposta Revelada */}
            {revealedAnswer && (
               <div className="p-3 bg-bg-input rounded border border-secondary/50">
                   <h4 className="font-semibold text-md text-secondary flex items-center gap-1"><Eye size={16}/> Resposta Revelada!</h4>
                   <p className="text-xs text-text-muted">(Resposta do Jogador {revealedAnswer.oponenteId})</p>
                   <p className="mt-1">
                       <span className="text-text-muted">{revealedAnswer.temaNome}:</span>{' '}
                       <b className="text-lg text-white font-mono break-words">{revealedAnswer.resposta || '(Vazio)'}</b>
                   </p>
               </div>
            )}
            {/* Mensagem enquanto espera a revelação */}
            {revealPending && !revealedAnswer && (
                <div className="p-3 bg-bg-input rounded border border-secondary/50 text-center">
                   <p className="text-secondary flex items-center justify-center gap-1"><Loader2 size={16} className="animate-spin"/> Decriptando resposta do oponente...</p>
                </div>
            )}

            {/* Placar da Rodada */}
            {Object.keys(placarRodada).length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-2 text-warning">⭐ Placar da Rodada {rodadaId} ⭐</h3>
                <div className="space-y-1 text-sm">
                  {Object.entries(placarRodada).map(([tema, scores]) => (
                      <div key={tema} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-bg-input/50 px-2 py-1 rounded gap-1 sm:gap-3">
                        <span className="text-text-muted font-medium uppercase">{tema}:</span>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs sm:text-sm">
                            {Object.entries(scores).map(([jId, pts]) => (
                              <span key={jId} className={Number(jId) === meuJogadorId ? 'text-accent' : 'text-secondary'}>
                                Jgdr {jId}: <b className={`font-bold ${pts > 0 ? (pts === 10 ? 'text-warning' : 'text-orange-400') : 'text-text-muted/50'}`}>{pts}pts</b>
                              </span>
                            ))}
                        </div>
                      </div>
                  ))}
                </div>
              </div>
            )}

             {/* Totais Acumulados */}
             {Object.keys(totais).length > 0 && (
               <div>
                  <h3 className="font-semibold text-lg mt-4 mb-1 text-warning">📊 Totais Acumulados</h3>
                   <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
                     {Object.entries(totais).map(([jId, pts]) => (
                       <span key={jId} className={Number(jId) === meuJogadorId ? 'text-accent' : 'text-secondary'}>
                          Jogador {jId}: <b className="text-xl">{pts}pts</b>
                       </span>
                     ))}
                  </div>
               </div>
             )}

            {/* Mensagem "Aguardando próxima rodada" */}
            {Object.keys(placarRodada).length > 0 && (
               <p className="text-center mt-4 text-text-muted text-sm italic">Aguardando próximo NÓ...</p>
            )}
          </div>
        )}

        {/* Totais (se o placar da rodada ainda não chegou) */}
        {(Object.keys(placarRodada).length === 0 && !revealedAnswer && !revealPending && Object.keys(totais).length > 0 && !finalizado && rodadaId) && (
           <div 
             className="mt-6 bg-bg-secondary p-4 rounded-lg shadow"
             data-augmented-ui="tl-clip tr-clip br-clip bl-clip border inlay"
           >
               <h3 className="font-semibold text-lg mb-1 text-warning">📊 Totais Acumulados</h3>
               <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
                  {Object.entries(totais).map(([jId, pts]) => (
                      <span key={jId} className={Number(jId) === meuJogadorId ? 'text-accent' : 'text-secondary'}>
                      Jogador {jId}: <b className="text-xl">{pts}pts</b>
                      </span>
                  ))}
               </div>
           </div>
        )}
      </>
    </div>
  )
}
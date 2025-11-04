// src/components/game/ActiveRound.jsx
import { useState, useEffect } from 'react'; 
import CategoryRow from '../CategoryRow';
import { Zap, Loader2, Star, SkipForward, Eye, Ghost } from 'lucide-react';
import Carousel from './Carousel'; 

import { motion } from 'framer-motion';


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

  // --- LÓGICA DO CARROSSEL SIMPLIFICADA ---

  // 1. Constantes de layout
  const carouselBaseWidth = 280;

  // 2. Itens do Carrossel (formato que o Carrossel espera)
  const carouselItems = inventario.map((p) => ({
    id: p.power_up_id,
    title: p.nome,
    description: `(x${p.quantidade}) ${p.descricao.substring(0, 30)}...`, 
    icon: <Zap className="carousel-icon" />,
    powerUpData: p, // Objeto original
  }));
  
  // === [CORREÇÃO] A variável 'loop' precisa ser definida aqui ===
  const loop = carouselItems.length > 2;

  // 3. Estado de Seleção
  const [selectedPowerUp, setSelectedPowerUp] = useState(null);

  // 4. Efeito para definir o item selecionado inicial
  useEffect(() => {
    if (!selectedPowerUp && !loadingInventory && carouselItems.length > 0) {
      setSelectedPowerUp(carouselItems[0].powerUpData);
    }
    if (inventario.length === 0) {
        setSelectedPowerUp(null);
    }
  }, [loadingInventory, carouselItems, selectedPowerUp, inventario.length]);
  
  // 6. Função para o botão "Usar"
  const handleUseSelectedPowerUp = () => {
    if (loadingInventory || !selectedPowerUp || isLocked || timeLeft === 0) return;
    onUsePowerUp(selectedPowerUp); 
  };
  // --- FIM DA LÓGICA DO CARROSSEL ---


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
    // ... (lógica de validação - sem alteração) ...
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
      const temasList = temas.map(t => t.nome).join(', ');
      const escolha = window.prompt(`Qual palavra você deseja pular?\n\nTemas disponíveis: ${temasList}`);
      if (!escolha) return; 
      
      const temaEscolhido = temas.find(t => t.nome.toLowerCase().trim() === escolha.toLowerCase().trim());
      if (!temaEscolhido) {
        alert(`Tema "${escolha}" não encontrado nesta rodada.`);
        return;
      }
      
      handleUsePowerUp(powerUp, temaEscolhido.nome);
      return;
    }
    handleUsePowerUp(powerUp);
  }

  // Lógica de renderização da tabela
  const allPlayerIds = [...new Set(
    Object.values(placarRodada).flatMap(scores => Object.keys(scores))
  )].sort((a, b) => Number(a) - Number(b)); 

  return (
    <div className="max-w-6xl mx-auto text-white space-y-4 p-4 relative font-cyber [perspective:1000px]">
      
      {/* Cabeçalho */}
      <header 
        className="flex items-center justify-between bg-bg-secondary p-3 shadow sticky top-[72px] z-10"
        data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
      >
        <div className="text-sm">
            Nó <b className="font-mono text-secondary">#{salaId}</b> | ID: <b className="font-mono text-accent">{meuJogadorId}</b>
        </div>
        <div className={`font-mono text-2xl font-bold tabular-nums ${timeLeft !== null && timeLeft <= 10 ? 'text-primary animate-pulse' : 'text-warning'}`}>
           ⏱ {timeLeft !== null ? `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}` : '--:--'}
        </div>
      </header>

      <>
        {/* Letra da Rodada */}
        <div 
          className="text-center bg-bg-secondary p-3 shadow"
          data-augmented-ui="tl-clip tr-clip br-clip bl-clip border inlay"
        >
          <h2 className="text-2xl font-semibold text-text-header">
            Letra da Rodada: <span className="font-mono text-4xl text-accent ml-2">{letra || '?'}</span>
          </h2>
        </div>

        {/* Grid Principal (Jogo + Lateral) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          
          {/* Coluna da Esquerda (Jogo Principal) */}
          <div className="md:col-span-2 space-y-4">
            
            {/* Linhas de Categoria */}
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
                        inputClassName={isSkipped ? 'text-text-muted/70 italic bg-bg-input/50' : (isDisregarded ? 'text-red-400/70 italic bg-red-900/30' : '')}
                      />
                      {activeSkipPowerUpId && !isSkipped && ( <button onClick={() => onSkip(t.id)} disabled={isLocked || timeLeft === 0} className="bg-warning hover:bg-warning/80 text-black p-2 rounded-lg disabled:opacity-50 transition-transform hover:scale-110" title="Pular esta categoria (usará o power-up)"> <SkipForward size={20}/> </button> )}
                      {activeSkipOpponentPowerUpId && ( <button onClick={() => onSkipOpponent(t.nome)} disabled={isLocked || timeLeft === 0} className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg disabled:opacity-50 transition-transform hover:scale-110" title="Desconsiderar esta categoria do oponente (usará o power-up)"> <SkipForward size={20} className="rotate-180"/> </button> )}
                  </div>
                );
              })}
            </div>

            {/* Botão STOP */}
            <div className="mt-6 [transform-style:preserve-3d]">
              <button
                className="bg-primary px-8 py-3 rounded-lg text-xl font-bold text-black hover:bg-primary/80 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all hover:scale-105 hover:[transform:translateZ(10px)] active:[transform:translateZ(2px)] cursor-target w-full sm:w-auto"
                onClick={onStop}
                disabled={!rodadaId || isLocked || timeLeft === 0}
                data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
              >
                STOP!
              </button>
            </div>
          </div>
          
          {/* Coluna da Direita (Painel Lateral de Power-ups) */}
          <div className="md:col-span-1 space-y-4">
            
            <div 
              className="bg-bg-secondary p-4 shadow-lg sticky top-[150px]"
              data-augmented-ui="tl-clip tr-clip br-clip bl-clip border inlay"
            >
              <h3 className="text-sm font-semibold mb-3 text-secondary w-full text-left">TERMINAL DE MÓDULOS</h3>
              
              {loadingInventory && <Loader2 className="animate-spin text-secondary mx-auto block" />}

              {/* Card de Informação (Não arrastável) */}
              <div
                 className="relative z-10"
              >
                {!loadingInventory && selectedPowerUp && (
                    <div 
                      className="bg-bg-input p-3 mb-4 border border-secondary/30" 
                      data-augmented-ui="tl-clip br-clip border"
                    >
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="text-lg font-bold text-accent">{selectedPowerUp.nome}</h4>
                            <span 
                              className="text-sm font-mono text-secondary bg-bg-primary px-2 py-0.5"
                              data-augmented-ui="tl-clip br-clip"
                            >
                              x{selectedPowerUp.quantidade}
                            </span>
                        </div>
                        <p className="text-xs text-text-muted italic">{selectedPowerUp.descricao}</p>
                    </div>
                )}
                
                {!loadingInventory && inventario.length === 0 && (
                    <div className="bg-bg-input p-3 mb-4 border border-secondary/30" data-augmented-ui="tl-clip br-clip border">
                      <p className="text-xs text-text-muted italic text-center">Nenhum módulo disponível.</p>
                    </div>
                )}
              </div>

              {/* Carrossel (Controlado de fora) */}
              {!loadingInventory && inventario.length > 0 && (
                <Carousel
                  items={carouselItems} 
                  baseWidth={carouselBaseWidth}
                  loop={loop} // <-- Agora 'loop' está definido
                  
                  onSelectionChange={setSelectedPowerUp} 
                />
              )}
              
              {/* Botão "Usar" */}
              {!loadingInventory && inventario.length > 0 && (
                <button
                  onClick={handleUseSelectedPowerUp}
                  disabled={isLocked || timeLeft === 0 || loadingInventory}
                  className="mt-4 bg-accent px-6 py-2 rounded-lg text-lg font-bold text-black hover:bg-accent/80 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all hover:scale-105 [transform-style:preserve-3d] hover:[transform:translateZ(10px)] active:[transform:translateZ(2px)] flex items-center justify-center gap-2 w-full cursor-target"
                  data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
                >
                  <Zap size={18} /> ATIVAR MÓDULO
                </button>
              )}

            </div>
          </div>

        </div>

        {/* Área de Resultados (Placar) */}
        {(Object.keys(placarRodada).length > 0 || revealedAnswer || revealPending) && (
          <div 
            className="mt-6 bg-bg-secondary p-4 rounded-lg shadow space-y-4"
            data-augmented-ui="tl-clip tr-clip br-clip bl-clip border inlay"
          >
            {revealedAnswer && ( <div className="p-3 bg-bg-input rounded border border-secondary/50" data-augmented-ui="tl-clip br-clip border"> <h4 className="font-semibold text-md text-secondary flex items-center gap-1"><Eye size={16}/> Resposta Revelada!</h4> <p className="text-xs text-text-muted">(Resposta do Jogador {revealedAnswer.oponenteId})</p> <p className="mt-1"> <span className="text-text-muted">{revealedAnswer.temaNome}:</span>{' '} <b className="text-lg text-white font-mono break-words">{revealedAnswer.resposta || '(Vazio)'}</b> </p> </div> )}
            {revealPending && !revealedAnswer && ( <div className="p-3 bg-bg-input rounded border border-secondary/50 text-center" data-augmented-ui="tl-clip br-clip border"> <p className="text-secondary flex items-center justify-center gap-1"><Loader2 size={16} className="animate-spin"/> Decriptando resposta do oponente...</p> </div> )}
            {Object.keys(placarRodada).length > 0 && ( <div> <h3 className="font-semibold text-lg mb-2 text-warning">⭐ Placar da Rodada {rodadaId} ⭐</h3> <div className="overflow-x-auto"> <table className="w-full border-collapse border border-secondary/30 font-mono text-sm"> <thead data-augmented-ui="tl-clip tr-clip" className="bg-bg-input/70"> <tr> <th className="p-2 border-r border-secondary/30 text-left text-text-muted uppercase">Tema</th> {allPlayerIds.map(jId => ( <th key={jId} className={`p-2 border-r border-secondary/30 last:border-r-0 ${Number(jId) === meuJogadorId ? 'text-accent' : 'text-secondary'}`} > Jgdr {jId} </th> ))} </tr> </thead> <tbody> {Object.entries(placarRodada).map(([tema, scores]) => ( <tr key={tema} className="bg-bg-input/30 hover:bg-bg-input/50 transition-colors"> <td className="p-2 border-r border-t border-secondary/30 font-medium text-text-muted uppercase">{tema}</td> {allPlayerIds.map(jId => { const pts = scores[jId]; const hasScore = pts !== undefined; const ptsClass = hasScore ? (pts > 0 ? (pts === 10 ? 'text-warning' : 'text-orange-400') : 'text-text-muted/50') : 'text-text-muted/40'; return ( <td key={jId} className={`p-2 border-r border-t border-secondary/30 last:border-r-0 text-center ${ptsClass} ${Number(jId) === meuJogadorId ? 'font-bold' : ''}`} > {hasScore ? `${pts}pts` : '-'} </td> ); })} </tr> ))} </tbody> </table> </div> </div> )}
            {Object.keys(totais).length > 0 && ( <div> <h3 className="font-semibold text-lg mt-4 mb-1 text-warning">📊 Totais Acumulados</h3> <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm"> {Object.entries(totais).map(([jId, pts]) => ( <span key={jId} className={Number(jId) === meuJogadorId ? 'text-accent' : 'text-secondary'}> Jogador {jId}: <b className="text-xl">{pts}pts</b> </span> ))} </div> </div> )}
            {Object.keys(placarRodada).length > 0 && ( <p className="text-center mt-4 text-text-muted text-sm italic">Aguardando próximo NÓ...</p> )}
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
// src/components/game/WaitingForRound.jsx
import { Loader2 } from 'lucide-react';

export default function WaitingForRound() {
  return (
    // Aplicado tema: fonte, cores e augmented-ui
    <div 
      className="text-center p-10 bg-bg-secondary rounded-lg shadow font-cyber"
      data-augmented-ui="tl-clip tr-clip br-clip bl-clip border inlay"
    >
        {/* Mensagem principal com cores do tema */}
        <div className="flex items-center justify-center gap-2 mb-4 text-xl text-text-header">
            <Loader2 className="animate-spin text-secondary" />
            Sincronizando com o GRID...
        </div>
         <p className="text-xs text-text-muted mt-2">(Carregando próxima rodada...)</p>
    </div>
  );
}
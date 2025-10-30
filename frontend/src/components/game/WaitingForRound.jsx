// src/components/game/WaitingForRound.jsx
import { Loader2 } from 'lucide-react';

// Este componente agora é "burro" (dummy component). 
// Ele apenas mostra um spinner.
// A lógica real foi movida para o 'useGameSocket' hook.
export default function WaitingForRound() {

  return (
    <div className="text-center p-10 bg-gray-800 rounded-lg shadow">
        {/* Mensagem principal de loading */}
        <div className="flex items-center justify-center gap-2 mb-4 text-xl text-gray-300">
            <Loader2 className="animate-spin" />
            Carregando rodada...
        </div>
         <p className="text-xs text-gray-500 mt-2">(Sincronizando com o servidor...)</p>
    </div>
  );
}
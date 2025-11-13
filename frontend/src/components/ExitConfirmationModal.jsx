// src/components/ExitConfirmationModal.jsx
import { X, AlertTriangle } from 'lucide-react';

export default function ExitConfirmationModal({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div 
        className="bg-bg-secondary border-2 border-warning/50 p-6 max-w-md mx-4 text-white font-cyber relative"
        data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
      >
        {/* Botão de fechar (X) */}
        <button
          onClick={onCancel}
          className="absolute top-2 right-2 text-text-muted hover:text-primary transition-colors cursor-target"
          aria-label="Fechar"
        >
          <X size={20} />
        </button>

        {/* Ícone de alerta */}
        <div className="flex items-center justify-center mb-4">
          <AlertTriangle className="w-12 h-12 text-warning animate-pulse" />
        </div>

        {/* Título */}
        <h2 className="text-2xl font-bold text-center mb-4 text-warning">
          Tem certeza que deseja sair?
        </h2>

        {/* Mensagem */}
        <p className="text-center text-text-muted mb-6">
          Você está em uma sala ou partida em andamento. Se sair agora, você será removido da partida.
        </p>

        {/* Botões */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-bg-input hover:bg-bg-input/80 text-white rounded transition-all cursor-target
                     hover:scale-105 [transform-style:preserve-3d]
                     [transform:translateZ(0px)]
                     hover:[transform:translateZ(10px)]"
            data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-2 bg-warning hover:bg-warning/80 text-black rounded font-semibold transition-all cursor-target
                     hover:scale-105 [transform-style:preserve-3d]
                     [transform:translateZ(0px)]
                     hover:[transform:translateZ(10px)]"
            data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
          >
            Confirmar Saída
          </button>
        </div>
      </div>
    </div>
  );
}


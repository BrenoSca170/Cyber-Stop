// frontend/src/components/BuyCoinsModal.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, X, ShoppingCart, Loader2 } from 'lucide-react';

const coinPackages = [
  { id: 1, amount: 10, price: "R$ 4,99" },
  { id: 2, amount: 50, price: "R$ 24,99" },
  { id: 3, amount: 130, price: "R$ 49,99" },
  { id: 4, amount: 300, price: "R$ 99,99" },
];

function BuyCoinsModal({ isOpen, onClose, onRequestPaymentMethod }) {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = () => {
    if (!selectedPackage) return;
    onRequestPaymentMethod(selectedPackage.amount, selectedPackage.price);
    setSelectedPackage(null);
    onClose();
  };

  const handleSelectPackage = (pkg) => {
    setSelectedPackage(pkg);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-cyber"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Modal com augmented-ui */}
          <motion.div
            className="bg-bg-secondary w-full max-w-lg overflow-hidden"
            data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Header do Modal */}
            <div className="flex justify-between items-center p-4 border-b border-border-color/30">
              <h2 className="text-xl font-semibold text-warning flex items-center gap-2">
                <Coins /> Adquirir Créditos
              </h2>
              <button onClick={onClose} className="text-text-muted hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-6 space-y-4 bg-bg-primary/50" data-augmented-ui="inlay">
              <p className="text-text-muted text-sm">Selecione um pacote de créditos :</p>
              
              {/* Grid de Pacotes */}
              <div className="grid grid-cols-2 gap-4">
                {coinPackages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => handleSelectPackage(pkg)}
                    className={`p-4 rounded-md border-2 transition-all text-center focus:outline-none cursor-target 
                    ${
                      selectedPackage?.id === pkg.id 
                        ? 'border-warning bg-warning/20 ring-2 ring-warning/50' 
                        : 'border-border-color/30 bg-bg-input hover:bg-bg-input/70 hover:border-warning/50'
                    }`}
                  >
                    <p className="text-lg font-bold text-warning flex items-center justify-center gap-1 font-mono">
                      <Coins size={16} /> {pkg.amount.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-sm text-text-muted cursor-target">{pkg.price}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="flex justify-end p-4 border-t border-border-color/30">
              <button 
                onClick={handleConfirm}
                disabled={!selectedPackage || isProcessing}
                className="bg-accent hover:bg-accent/80 text-black font-semibold py-2 px-6 rounded-md flex items-center gap-2 
                           disabled:bg-gray-500 disabled:cursor-not-allowed
                           [transform-style:preserve-3d] hover:[transform:translateZ(10px)] active:[transform:translateZ(2px)] cursor-target"
                data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <ShoppingCart size={20} />}
                {isProcessing ? 'Processando...' : `Confirmar (+${selectedPackage?.amount.toLocaleString('pt-BR') || 0})`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BuyCoinsModal;
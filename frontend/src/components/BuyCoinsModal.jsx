// frontend/src/components/BuyCoinsModal.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, X, ShoppingCart, Loader2 } from 'lucide-react';

// Pacotes de moedas "figurativos"
const coinPackages = [
  { id: 1, amount: 100, price: "R$ 4,99" },
  { id: 2, amount: 550, price: "R$ 24,99" },
  { id: 3, amount: 1200, price: "R$ 49,99" },
  { id: 4, amount: 3000, price: "R$ 99,99" },
];

function BuyCoinsModal({ isOpen, onClose, onConfirmPurchase }) {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    if (!selectedPackage) return;
    setIsProcessing(true);
    await onConfirmPurchase(selectedPackage.amount); // Chama a função passada por props
    setIsProcessing(false);
    setSelectedPackage(null); // Reseta a seleção
    onClose(); // Fecha o modal após a confirmação
  };

  const handleSelectPackage = (pkg) => {
    setSelectedPackage(pkg);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden border border-gray-700"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Header do Modal */}
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-yellow-400 flex items-center gap-2">
                <Coins /> Adquirir Moedas
              </h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-6 space-y-4">
              <p className="text-gray-300 text-sm">Selecione um pacote de moedas para adicionar à sua conta (simulação):</p>
              
              {/* Grid de Pacotes */}
              <div className="grid grid-cols-2 gap-4">
                {coinPackages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => handleSelectPackage(pkg)}
                    className={`p-4 rounded-md border-2 transition-all text-center focus:outline-none ${
                      selectedPackage?.id === pkg.id 
                        ? 'border-yellow-500 bg-yellow-900/30 ring-2 ring-yellow-500/50' 
                        : 'border-gray-600 bg-gray-700 hover:bg-gray-600/70 hover:border-gray-500'
                    }`}
                  >
                    <p className="text-lg font-bold text-yellow-400 flex items-center justify-center gap-1">
                      <Coins size={16} /> {pkg.amount.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-sm text-gray-300">{pkg.price}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer do Modal */}
            <div className="flex justify-end p-4 bg-gray-900/50 border-t border-gray-700">
              <button 
                onClick={handleConfirm}
                disabled={!selectedPackage || isProcessing}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-md flex items-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <ShoppingCart size={20} />}
                {isProcessing ? 'Processando...' : `Confirmar (+${selectedPackage?.amount || 0} Moedas)`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BuyCoinsModal;
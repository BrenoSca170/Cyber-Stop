// frontend/src/components/BuyCoinsModal.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, X, ShoppingCart, Loader2, CreditCard, QrCode, ArrowLeft } from 'lucide-react'; // Ícones adicionados

const coinPackages = [
  { id: 1, amount: 100, price: "R$ 4,99" },
  { id: 2, amount: 550, price: "R$ 24,99" },
  { id: 3, amount: 1200, price: "R$ 49,99" },
  { id: 4, amount: 3000, price: "R$ 99,99" },
];

// Configurações de animação para as etapas
const stepVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 },
};

function BuyCoinsModal({ isOpen, onClose, onConfirmPurchase }) {
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false); // Agora usado para a simulação de 10s
  const [step, setStep] = useState('selectPackage'); // 'selectPackage', 'selectPayment', 'showCard', 'showPix'
  const [paymentMethod, setPaymentMethod] = useState(null); // 'pix' | 'card'
  const [cardDetails, setCardDetails] = useState({ number: '', expiry: '', cvv: '' });
  const [pixCode, setPixCode] = useState('');

  // Reseta todo o estado interno do modal
  const resetState = () => {
    setSelectedPackage(null);
    setIsProcessing(false);
    setStep('selectPackage');
    setPaymentMethod(null);
    setCardDetails({ number: '', expiry: '', cvv: '' });
    setPixCode('');
  };

  // Função para fechar o modal (chamada pelo 'X' ou overlay)
  const handleClose = () => {
    if (isProcessing) return; // Impede o fechamento durante o "pagamento"
    onClose();
    setTimeout(resetState, 300); // Reseta o estado após a animação de saída
  };

  // Simulação de pagamento de 10 segundos
  const handleFinalPurchase = async () => {
    setIsProcessing(true);
    setTimeout(async () => {
      await onConfirmPurchase(selectedPackage.amount); // Confirma a compra
      onClose(); // Fecha o modal
      setTimeout(resetState, 300); // Reseta o estado para a próxima vez
    }, 10000); // 10 segundos
  };

  // --- Navegação entre Etapas ---

  // Etapa 1 -> Etapa 2
  const handleProceedToPayment = () => {
    if (!selectedPackage) return;
    setStep('selectPayment');
  };

  // Etapa 2 -> Etapa 3 (Card ou PIX)
  const handlePaymentSubmit = () => {
    if (paymentMethod === 'card') {
      setStep('showCard');
    } else if (paymentMethod === 'pix') {
      // Gera um código PIX aleatório para simulação
      const code = 'simulacao-pix-' + Math.random().toString(16).slice(2, 12);
      setPixCode(code);
      setStep('showPix');
      handleFinalPurchase(); // Inicia o timer de 10s imediatamente
    }
  };

  // Etapa 3 (Card) -> Confirmação Final
  const handleCardSubmit = (e) => {
    e.preventDefault();
    if (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvv) {
      // Idealmente, trate essa validação de forma mais elegante
      alert("Por favor, preencha todos os dados do cartão.");
      return;
    }
    handleFinalPurchase(); // Inicia o timer de 10s
  };

  // Botão "Voltar"
  const handleBack = () => {
    if (isProcessing) return;
    if (step === 'selectPayment') setStep('selectPackage');
    if (step === 'showCard') setStep('selectPayment');
  };

  // Input do formulário de cartão
  const handleCardChange = (e) => {
    const { name, value } = e.target;
    setCardDetails(prev => ({ ...prev, [name]: value }));
  };

  // Renderiza o corpo do modal com base na etapa
  const renderBody = () => (
    <AnimatePresence mode="wait">
      {step === 'selectPackage' && (
        <motion.div
          key="selectPackage"
          variants={stepVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <p className="text-text-muted text-sm mb-4">Selecione um pacote de créditos (simulação):</p>
          <div className="grid grid-cols-2 gap-4">
            {coinPackages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setSelectedPackage(pkg)}
                className={`p-4 rounded-md border-2 transition-all text-center focus:outline-none 
                ${
                  selectedPackage?.id === pkg.id 
                    ? 'border-warning bg-warning/20 ring-2 ring-warning/50' 
                    : 'border-border-color/30 bg-bg-input hover:bg-bg-input/70 hover:border-warning/50'
                }`}
              >
                <p className="text-lg font-bold text-warning flex items-center justify-center gap-1 font-mono">
                  <Coins size={16} /> {pkg.amount.toLocaleString('pt-BR')}
                </p>
                <p className="text-sm text-text-muted">{pkg.price}</p>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {step === 'selectPayment' && (
        <motion.div
          key="selectPayment"
          variants={stepVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="space-y-4"
        >
          <p className="text-text-muted text-sm">Selecione o método de pagamento:</p>
          <button
            onClick={() => setPaymentMethod('pix')}
            className={`w-full p-4 rounded-md border-2 flex items-center gap-3 transition-all ${
              paymentMethod === 'pix' ? 'border-warning bg-warning/20' : 'border-border-color/30 bg-bg-input hover:border-warning/50'
            }`}
          >
            <QrCode className="text-warning" />
            <span className="text-lg">PIX</span>
          </button>
          <button
            onClick={() => setPaymentMethod('card')}
            className={`w-full p-4 rounded-md border-2 flex items-center gap-3 transition-all ${
              paymentMethod === 'card' ? 'border-warning bg-warning/20' : 'border-border-color/30 bg-bg-input hover:border-warning/50'
            }`}
          >
            <CreditCard className="text-warning" />
            <span className="text-lg">Cartão de Crédito / Débito</span>
          </button>
        </motion.div>
      )}

      {step === 'showCard' && (
        <motion.div
          key="showCard"
          variants={stepVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <p className="text-text-muted text-sm mb-4">Insira os dados do cartão (simulação):</p>
          <form onSubmit={handleCardSubmit} className="space-y-4">
            <input type="text" name="number" placeholder="Número do Cartão (ex: 4444...)" onChange={handleCardChange} value={cardDetails.number} className="w-full bg-bg-input border border-border-color/30 rounded p-2" disabled={isProcessing} />
            <div className="flex gap-4">
              <input type="text" name="expiry" placeholder="Validade (MM/AA)" onChange={handleCardChange} value={cardDetails.expiry} className="w-1/2 bg-bg-input border border-border-color/30 rounded p-2" disabled={isProcessing} />
              <input type="text" name="cvv" placeholder="CVV (ex: 123)" onChange={handleCardChange} value={cardDetails.cvv} className="w-1/2 bg-bg-input border border-border-color/30 rounded p-2" disabled={isProcessing} />
            </div>
          </form>
        </motion.div>
      )}

      {step === 'showPix' && (
        <motion.div
          key="showPix"
          variants={stepVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="text-center"
        >
          <p className="text-text-muted text-sm mb-2">Copie o código PIX (simulação):</p>
          <div className="p-3 bg-bg-input border border-border-color/30 rounded font-mono text-warning break-all">
            {pixCode}
          </div>
          <div className="flex justify-center items-center gap-2 mt-4 text-accent">
            <Loader2 className="animate-spin" size={20} />
            <span>Aguardando pagamento... O modal fechará em 10s.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Renderiza o footer do modal com base na etapa
  const renderFooter = () => (
    <AnimatePresence mode="wait">
      {step === 'selectPackage' && (
        <motion.button
          key="footerPackage"
          onClick={handleProceedToPayment}
          disabled={!selectedPackage}
          className="bg-accent hover:bg-accent/80 text-black font-semibold py-2 px-6 rounded-md flex items-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed"
          data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <ShoppingCart size={20} />
          {`Confirmar (+${selectedPackage?.amount.toLocaleString('pt-BR') || 0})`}
        </motion.button>
      )}

      {step === 'selectPayment' && (
        <motion.button
          key="footerPayment"
          onClick={handlePaymentSubmit}
          disabled={!paymentMethod}
          className="bg-accent hover:bg-accent/80 text-black font-semibold py-2 px-6 rounded-md flex items-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed"
          data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          Continuar
        </motion.button>
      )}

      {step === 'showCard' && (
        <motion.button
          key="footerCard"
          onClick={handleCardSubmit}
          disabled={isProcessing || !cardDetails.number || !cardDetails.expiry || !cardDetails.cvv}
          className="bg-accent hover:bg-accent/80 text-black font-semibold py-2 px-6 rounded-md flex items-center gap-2 disabled:bg-gray-500 disabled:cursor-not-allowed"
          data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <CreditCard size={20} />}
          {isProcessing ? 'Processando...' : `Pagar ${selectedPackage?.price}`}
        </motion.button>
      )}

      {/* Nenhum footer para a etapa PIX, pois é automático */}
    </AnimatePresence>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-cyber"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
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
              <div className="flex items-center gap-2">
                {(step === 'selectPayment' || step === 'showCard') && !isProcessing && (
                  <button onClick={handleBack} className="text-text-muted hover:text-white mr-2">
                    <ArrowLeft size={20} />
                  </button>
                )}
                <h2 className="text-xl font-semibold text-warning flex items-center gap-2">
                  <Coins /> Adquirir Créditos
                </h2>
              </div>
              <button onClick={handleClose} disabled={isProcessing} className="text-text-muted hover:text-white disabled:text-gray-600">
                <X size={24} />
              </button>
            </div>

            {/* Corpo do Modal (Renderizado dinamicamente) */}
            <div className="p-6 space-y-4 bg-bg-primary/50 min-h-[220px]" data-augmented-ui="inlay">
              {renderBody()}
            </div>

            {/* Footer do Modal (Renderizado dinamicamente) */}
            <div className="flex justify-end p-4 border-t border-border-color/30 min-h-[68px]">
              {renderFooter()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BuyCoinsModal;
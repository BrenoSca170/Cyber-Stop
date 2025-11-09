// frontend/src/components/PaymentModal.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CreditCard, QrCode, Loader2 } from 'lucide-react';
import QRCode from 'react-qr-code';
import InputMask from 'react-input-mask';

function PaymentModal({ isOpen, onClose, onConfirm, amount, price }) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardData, setCardData] = useState({
    cardNumber: '',
    cardHolder: '',
    expDate: '',
    cvv: '',
  });
  const [error, setError] = useState('');

  // --- FUNÇÃO DE VALIDAÇÃO (ATUALIZADA) ---
  const validateCardData = () => {
    const { cardNumber, cardHolder, expDate, cvv } = cardData;

    if (!cardHolder.trim()) {
      return 'O nome no cartão é obrigatório.';
    }
    // Remove todos os não-dígitos
    if (cardNumber.replace(/\D/g, '').length !== 16) {
      return 'O número do cartão está incompleto.';
    }
    
    // Remove todos os não-dígitos
    const expDateClean = expDate.replace(/\D/g, '');
    if (expDateClean.length !== 4) {
      return 'A data de validade está incompleta.';
    }
    
    // Remove todos os não-dígitos
    if (cvv.replace(/\D/g, '').length !== 3) {
      return 'O CVV está incompleto (deve ter 3 dígitos).';
    }

    // Validação da data de expiração
    try {
      const monthStr = expDateClean.substring(0, 2);
      const yearStr = expDateClean.substring(2, 4);
      const month = parseInt(monthStr, 10);
      const year = parseInt(`20${yearStr}`, 10); // Assume anos 20xx

      if (month < 1 || month > 12) {
        return 'Mês de validade inválido.';
      }

      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1; // Meses são 0-indexados

      if (year < currentYear) {
        return 'Este cartão expirou (ano).';
      }
      if (year === currentYear && month < currentMonth) {
        return 'Este cartão expirou (mês).';
      }
    } catch (e) {
      return 'Formato da data de validade inválido.';
    }

    return null; // Sem erros
  };

  const handleConfirm = async () => {
    if (!selectedMethod) return;
    
    setError(''); 
    if (selectedMethod === 'Credit Card') {
      const validationError = validateCardData();
      if (validationError) {
        setError(validationError); 
        return; 
      }
    }

    setIsProcessing(true);
    await new Promise((res) => setTimeout(res, 1000));
    onConfirm(amount);

    setIsProcessing(false);
    setSelectedMethod(null);
    setCardData({ cardNumber: '', cardHolder: '', expDate: '', cvv: '' });
    onClose();
  };

  const handleCardChange = (e) => {
    if (error) setError(''); 
    setCardData({ ...cardData, [e.target.name]: e.target.value });
  };

  // ===============================================
  // === CORREÇÃO APLICADA AQUI ===
  // ===============================================
  // Helper para desabilitar o botão (agora usa replace(/\D/g, '') 
  // para remover todos os não-dígitos antes de checar o tamanho)
  const isCardFormInvalid =
    selectedMethod === 'Credit Card' &&
    (!cardData.cardHolder.trim() ||
     cardData.cardNumber.replace(/\D/g, '').length !== 16 || // CORRIGIDO
     cardData.expDate.replace(/\D/g, '').length !== 4 ||    // CORRIGIDO
     cardData.cvv.replace(/\D/g, '').length !== 3);         // CORRIGIDO


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
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-border-color/30">
              <h2 className="text-xl font-semibold text-warning flex items-center gap-2">
                {amount ? `Comprar ${amount.toLocaleString('pt-BR')} créditos por ${price.toLocaleString('pt-BR')}` : 'Selecionar Método de Pagamento'}
              </h2>
              <button onClick={onClose} className="text-text-muted hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 bg-bg-primary/50" data-augmented-ui="inlay">
              <p className="text-text-muted text-sm">Escolha um método de pagamento:</p>
              
              {/* Payment Options */}
              <div className="flex gap-4">
                <button
                  className={` flex-1 p-4 rounded-md border-2 transition-all focus:outline-none text-center cursor-target
                    ${selectedMethod === 'PIX' ? 'border-warning bg-warning/20 ring-2 ring-warning/50' : 'border-border-color/30 hover:border-warning/50 hover:bg-bg-input/70'}`}
                  onClick={() => { setSelectedMethod('PIX'); setError(''); }}
                >
                  <QrCode size={24} className="mx-auto mb-2" />
                  PIX
                </button>

                <button
                  className={`flex-1 p-4 rounded-md border-2 transition-all focus:outline-none text-center cursor-target
                    ${selectedMethod === 'Credit Card' ? 'border-warning bg-warning/20 ring-2 ring-warning/50' : 'border-border-color/30 hover:border-warning/50 hover:bg-bg-input/70'}`}
                  onClick={() => setSelectedMethod('Credit Card')}
                >
                  <CreditCard size={24} className="mx-auto mb-2" />
                  Cartão de Crédito
                </button>
              </div>

              {/* Credit Card Form */}
              {selectedMethod === 'Credit Card' && (
                <form className="mt-4 space-y-3" onSubmit={(e) => e.preventDefault()}>
                  <div>
                    <label className="block text-sm text-text-muted mb-1 ">Número do cartão</label>
                    <InputMask
                      mask="9999 9999 9999 9999"
                      maskChar=" "
                      value={cardData.cardNumber}
                      onChange={handleCardChange}
                    >
                      {(inputProps) => (
                        <input
                          {...inputProps}
                          name="cardNumber"
                          placeholder="1234 5678 9012 3456"
                          className={`w-full p-2 rounded border  ${error.includes('cartão') ? 'border-red-500' : 'border-border-color/30'} bg-bg-input text-gray-300 placeholder:text-text-muted cursor-target`}
                          autoComplete="cc-number"
                        />
                      )}
                    </InputMask>
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Nome no cartão</label>
                    <input
                      type="text"
                      name="cardHolder"
                      autoComplete="cc-name"
                      value={cardData.cardHolder}
                      onChange={handleCardChange}
                      placeholder="Nome do Titular"
                      className={`w-full p-2 rounded border ${error.includes('nome') ? 'border-red-500' : 'border-border-color/30'} bg-bg-input text-gray-300 placeholder:text-text-muted cursor-target`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-sm text-text-muted mb-1">Validade</label>
                      <InputMask
                        mask="99/99"
                        maskChar=" "
                        value={cardData.expDate}
                        onChange={handleCardChange}
                      >
                        {(inputProps) => (
                          <input
                            {...inputProps}
                            name="expDate"
                            placeholder="MM/AA"
                            className={`w-full p-2 rounded border ${error.includes('data') || error.includes('expirou') || error.includes('Mês') ? 'border-red-500' : 'border-border-color/30'} bg-bg-input text-gray-300 placeholder:text-text-muted cursor-target`}
                            autoComplete="cc-exp"
                          />
                        )}
                      </InputMask>
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm text-text-muted mb-1">CVV</label>
                      <InputMask
                        mask="999"
                        maskChar=""
                        value={cardData.cvv}
                        onChange={handleCardChange}
                      >
                        {(inputProps) => (
                          <input
                            {...inputProps}
                            name="cvv"
                            placeholder="123"
                            className={`w-full p-2 rounded border ${error.includes('CVV') ? 'border-red-500' : 'border-border-color/30'} bg-bg-input text-gray-300 placeholder:text-text-muted cursor-target`}
                            autoComplete="cc-csc"
                          />
                        )}
                      </InputMask>
                    </div>
                  </div>
                </form>
              )}

              {/* PIX QR Code */}
              {selectedMethod === 'PIX' && (
                <div className="mt-4 flex flex-col items-center">
                  <p className="text-text-muted text-sm mb-2">Escaneie o QR Code para pagar com PIX:</p>
                  <QRCode
                    value={`pix:${Math.random().toString(36).substring(2, 18)}@fakebank.com?amount=${amount}`}
                    size={180}
                  />
                </div>
              )}
            </div>

            {/* Exibição de Erro */}
            {error && (
              <div className="px-6 pb-2 text-center">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end p-4 border-t border-border-color/30">
              <button
                onClick={handleConfirm}
                // Condição de 'disabled' corrigida
                disabled={!selectedMethod || isProcessing || isCardFormInvalid}
                className="bg-accent hover:bg-accent/80 text-black font-semibold py-2 px-6 rounded-md flex items-center gap-2
                           disabled:bg-gray-500 disabled:cursor-not-allowed [transform-style:preserve-3d] 
                           [transform:translateZ(0px)]
                           hover:[transform:translateZ(10px)] active:[transform:translateZ(2px)] 
                           cursor-target relative z-10"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={20}/> : 'Finalizar Compra'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PaymentModal;
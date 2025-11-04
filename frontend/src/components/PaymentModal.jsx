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

  const handleConfirm = async () => {
    if (!selectedMethod) return;
    setIsProcessing(true);

    await new Promise((res) => setTimeout(res, 1000));

    // Callback para adicionar moedas
    onConfirm(amount);

    setIsProcessing(false);
    setSelectedMethod(null);
    setCardData({ cardNumber: '', cardHolder: '', expDate: '', cvv: '' });
    onClose();
  };

  const handleCardChange = (e) => {
    setCardData({ ...cardData, [e.target.name]: e.target.value });
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
                  className={`flex-1 p-4 rounded-md border-2 transition-all focus:outline-none text-center
                    ${selectedMethod === 'PIX' ? 'border-warning bg-warning/20 ring-2 ring-warning/50' : 'border-border-color/30 hover:border-warning/50 hover:bg-bg-input/70'}`}
                  onClick={() => setSelectedMethod('PIX')}
                >
                  <QrCode size={24} className="mx-auto mb-2" />
                  PIX
                </button>

                <button
                  className={`flex-1 p-4 rounded-md border-2 transition-all focus:outline-none text-center
                    ${selectedMethod === 'Credit Card' ? 'border-warning bg-warning/20 ring-2 ring-warning/50' : 'border-border-color/30 hover:border-warning/50 hover:bg-bg-input/70'}`}
                  onClick={() => setSelectedMethod('Credit Card')}
                >
                  <CreditCard size={24} className="mx-auto mb-2" />
                  Cartão de Crédito
                </button>
              </div>

              {/* Credit Card Form */}
              {selectedMethod === 'Credit Card' && (
                <form className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm text-text-muted mb-1">Número do cartão</label>
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
                          className="w-full p-2 rounded border border-border-color/30 bg-bg-input text-gray-300 placeholder:text-text-muted"
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
                      className="w-full p-2 rounded border border-border-color/30 bg-bg-input text-gray-300 placeholder:text-text-muted"
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
                            className="w-full p-2 rounded border border-border-color/30 bg-bg-input text-gray-300 placeholder:text-text-muted"
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
                            className="w-full p-2 rounded border border-border-color/30 bg-bg-input text-gray-300 placeholder:text-text-muted"
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

            {/* Footer */}
            <div className="flex justify-end p-4 border-t border-border-color/30">
              <button
                onClick={handleConfirm}
                disabled={!selectedMethod || isProcessing}
                className="bg-accent hover:bg-accent/80 text-black font-semibold py-2 px-6 rounded-md flex items-center gap-2
                           disabled:bg-gray-500 disabled:cursor-not-allowed [transform-style:preserve-3d] hover:[transform:translateZ(10px)] active:[transform:translateZ(2px)]"
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

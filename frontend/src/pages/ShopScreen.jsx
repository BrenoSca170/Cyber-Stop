// frontend/src/pages/ShopScreen.jsx
import { useState, useEffect } from 'react';
import api from '../lib/api'; 
import ShopItem from '../components/ShopItem'; 
import BuyCoinsModal from '../components/BuyCoinsModal';
import PaymentModal from '../components/PaymentModal';
import { Wallet, Store, Loader2, PlusCircle, Package } from 'lucide-react'; // Ícones

function ShopScreen() {
  const [moedas, setMoedas] = useState(0); 
  const [inventario, setInventario] = useState([]); 
  const [shopItems, setShopItems] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [purchasingId, setPurchasingId] = useState(null); 
  const [message, setMessage] = useState(''); 
  const [error, setError] = useState(''); 
  const [isBuyCoinsModalOpen, setIsBuyCoinsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [pkgPrice, setPkgPrice] = useState('');

  // ... (NENHUMA alteração na lógica: fetchData, handlePurchase, handleConfirmCoinPurchase) ...

  const fetchData = async () => {
    setLoading(true); 
    setMessage(''); 
    setError('');
    try {
      const [itemsRes, inventoryRes] = await Promise.all([
        api.get('/shop/items'), 
        api.get('/shop/inventory') 
      ]);
      setShopItems(itemsRes.data || []); 
      setMoedas(inventoryRes.data?.moedas || 0); 
      setInventario(inventoryRes.data?.inventario || []); 

    } catch (err) {
      console.error("Erro ao carregar loja ou inventário", err);
      setError("Não foi possível carregar os dados da loja. Tente recarregar a página."); 
    } finally {
      setLoading(false); 
    }
  };

  useEffect(() => {
    fetchData();
  }, []); 

  const handlePurchase = async (item) => {
    setMessage(''); 
    setError('');
    if (moedas < item.price) {
      setError("Saldo insuficiente!");
      setTimeout(() => setError(''), 3000); 
      return;
    }
    setPurchasingId(item.id); 
    try {
      const response = await api.post('/shop/purchase', { power_up_id: item.id });
      setMoedas(response.data.novo_saldo); 
      setMessage(`'${item.name}' comprado com sucesso!`); 
      fetchData(); 
    } catch (err) {
      console.error("Erro na compra", err);
      setError(err.response?.data?.error || "Ocorreu um erro na sua compra.");
    } finally {
      setPurchasingId(null); 
      setTimeout(() => { setMessage(''); setError(''); }, 3000);
    }
  };

  const handleConfirmCoinPurchase = async (amount) => {
    setMessage(''); 
    setError('');
    console.log(`Simulando compra de ${amount} moedas...`);
    try {
        const response = await api.post('/shop/add-coins', { amount });
        setMoedas(response.data.novo_saldo); 
        setMessage(`${amount.toLocaleString('pt-BR')} moedas adicionadas com sucesso!`); 
        setTimeout(() => setMessage(''), 4000); 
    } catch (err) {
        console.error("Erro ao adicionar moedas:", err);
        setError(err.response?.data?.error || "Ocorreu um erro ao adicionar moedas.");
        setTimeout(() => setError(''), 4000); 
    }
  };

  const handleRequestPaymentMethod = (amount, price) => {
    setPendingAmount(amount);
    setPkgPrice(price);
    setIsPaymentModalOpen(true);
  };

  // --- Renderização Atualizada ---

  if (loading && shopItems.length === 0) {
    return (
      <div className="text-white text-center p-10 flex items-center justify-center gap-2 font-cyber">
        <Loader2 className="animate-spin text-secondary" /> Carregando Mercado Paralelo...
      </div>
    );
  }

  return (
    // Adicionada fonte e perspectiva
    <div className="p-4 md:p-8 text-white font-cyber [perspective:1000px]">
      <div className="max-w-4xl mx-auto">
        
        {/* Seção da Carteira com augmented-ui */}
        <div 
          className="flex flex-col md:flex-row items-center justify-between bg-bg-secondary p-4 md:p-6 mb-8 gap-4 md:gap-2"
          data-augmented-ui="tl-clip tr-clip br-clip bl-clip border inlay"
        >
          {/* Saldo Atual */}
          <div className="flex items-center gap-3 md:gap-4 [transform:translateZ(10px)]">
            <Wallet className="h-8 w-8 md:h-10 md:w-10 text-accent" />
            <div>
              <h2 className="text-lg md:text-xl font-bold text-accent">Meus Créditos</h2>
            </div>
            <span className="text-2xl md:text-3xl font-bold text-warning flex items-center gap-1 font-mono">
               {loading ? <Loader2 className="animate-spin h-5 w-5" /> : moedas.toLocaleString('pt-BR')} 
               <span className="text-sm font-normal text-text-muted">c</span>
            </span>
          </div>
          
          {/* Botão para Abrir o Modal de Compra de Moedas */}
          <button 
            onClick={() => setIsBuyCoinsModalOpen(true)} 
            className="bg-warning hover:bg-warning/80 text-black font-semibold py-2 px-4 rounded-md flex items-center gap-2 text-sm md:text-base w-full md:w-auto justify-center 
                       transition-all hover:scale-105 [transform-style:preserve-3d] hover:[transform:translateZ(15px)] active:[transform:translateZ(5px)] cursor-target"
            data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
          >
            <PlusCircle size={18} /> Adquirir Créditos
          </button>
        </div>
        
        {/* Mensagens de Feedback */}
        {message && <div className="text-center mb-4 font-semibold text-accent bg-accent/20 py-2 px-4 rounded">{message}</div>}
        {error && <div className="text-center mb-4 font-semibold text-primary bg-primary/20 py-2 px-4 rounded">{error}</div>}

        {/* Seção da Loja de Power-ups */}
        <div className="flex items-center gap-3 md:gap-4 mb-6">
          <Store className="h-7 w-7 md:h-8 md:w-8 text-primary" />
          <h1 className="text-3xl md:text-4xl font-bold text-text-header">Mercado Paralelo</h1>
        </div>
        
        {loading && <div className="text-center text-text-muted">Atualizando...</div>}

        {/* Grid com os Itens da Loja */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {shopItems.map((item) => {
            const isBuyingThis = purchasingId === item.power_up_id; 
            const canAfford = moedas >= item.preco; 
            return (
              <ShopItem
                key={item.power_up_id} 
                item={{ 
                    id: item.power_up_id, 
                    code: item.codigo_identificador, 
                    name: item.nome,
                    description: item.descricao,
                    price: item.preco
                }}
                onPurchase={handlePurchase} 
                canAfford={canAfford && !purchasingId} 
                isPurchasing={isBuyingThis} 
              />
            );
          })}
           {!loading && shopItems.length === 0 && (
              <p className="text-text-muted md:col-span-2 lg:col-span-3 text-center">Nenhum item disponível no Mercado Paralelo no momento.</p>
           )}
        </div>

         {/* Seção Inventário Atual */}
         <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4 text-secondary flex items-center gap-2">
              <Package size={24} /> Meu Inventário
            </h2>
            <div 
              className="bg-bg-secondary p-4 rounded-lg" 
              data-augmented-ui="tl-clip tr-clip br-clip bl-clip border inlay"
            >
              {!loading && inventario.length > 0 ? (
                  <ul className="space-y-2">
                  {inventario.map(invItem => (
                      <li key={invItem.power_up_id} className="bg-bg-input p-3 rounded flex justify-between items-center shadow border border-secondary/20">
                      <span>{invItem.nome} <span className="text-text-muted text-sm hidden sm:inline">({invItem.descricao})</span></span>
                      <span className="font-bold text-lg text-secondary font-mono">x{invItem.quantidade}</span>
                      </li>
                  ))}
                  </ul>
              ) : !loading ? (
                  <p className="text-text-muted/70 italic">Você não possui módulos.</p>
              ) : (
                  <div className="text-center text-text-muted"><Loader2 className="animate-spin inline mr-2"/> Carregando inventário...</div>
              )}
            </div>
         </div>
      </div>

      {/* Renderiza o Modal (só é visível quando isBuyCoinsModalOpen é true) */}
      <BuyCoinsModal 
        isOpen={isBuyCoinsModalOpen} 
        onClose={() => setIsBuyCoinsModalOpen(false)} 
        onRequestPaymentMethod={handleRequestPaymentMethod}
      />
      {/* Renderiza o Modal de Pagamento */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onConfirm={(amount) => {
          handleConfirmCoinPurchase(amount);
          setIsPaymentModalOpen(false);
        }}
        amount={pendingAmount}
        price={pkgPrice}
      />
    </div>
  );
}

export default ShopScreen;
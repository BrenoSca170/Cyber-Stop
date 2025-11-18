// fronted/src/pages/ShopScreen.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { ArrowLeft, Loader2, ShoppingCart, Gem, Package, Info } from 'lucide-react';
import { toast } from 'sonner';
// (NOVO) Importa o PaymentModal
import PaymentModal from '../components/PaymentModal';
import MatrixRain from '../components/MatrixRain';
import GlitchText from '../components/GlitchText';


// Um componente interno para o Cartão do Item (Power-up)
function StoreItemCard({ item, onBuy, isBuying }) {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    if (isBuying) return;
    onBuy(item.item_id);
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 300); // Duração da animação
  };

  return (
    <div 
      className="bg-purple-900/80 p-4 border border-primary/50 rounded-lg shadow-lg
                 flex flex-col justify-between transition-all hover:scale-[1.02] cursor-target"
      data-augmented-ui="tl-clip tr-2-clip-x br-clip bl-2-clip-x border"
    >
      
      <div>
        <h3 className="text-xl font-bold text-accent mb-2">{item.nome}</h3>
        <p className="text-sm text-white text-text-muted mb-3">{item.descricao}</p>
      </div>
      <div className="flex justify-between items-center mt-4">
        <span className="text-lg font-semibold text-warning flex items-center gap-1">
          <Gem size={16} /> {item.preco}
        </span>
        <button
          onClick={handleClick}
          disabled={isBuying}
          className={`px-4 py-2 font-semibold text-black bg-amber-500 rounded
                      hover:bg-primary transition-all duration-150 cursor-target
                      disabled:bg-white disabled:cursor-not-allowed
                      flex items-center gap-2
                      ${isClicked ? 'scale-95' : ''}`}
        >
          {isBuying ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
          Comprar
        </button>
      </div>
    </div>
  );
}

// Um componente interno para o Cartão do Pacote (Moedas)
function PackageCard({ pkg, onBuy, isBuying }) {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    if (isBuying) return;
    onBuy(pkg.pacote_id);
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 300);
  };

  return (
    <div 
      className="bg-bg-secondary p-4 border border-secondary/50 rounded-lg shadow-lg cursor-target
                 flex flex-col justify-between transition-all hover:scale-[1.02]"
      data-augmented-ui="tl-clip tr-2-clip-x br-clip bl-2-clip-x border"
    >
      <div>
        <h3 className="text-xl font-bold text-secondary mb-2">{pkg.nome}</h3>
        <p className="text-sm text-text-muted mb-1">Receba:</p>
        <p className="text-2xl font-bold text-warning flex items-center gap-2 mb-3">
          <Gem size={20} /> {pkg.qtde_moedas}
        </p>
      </div>
      <div className="flex justify-between items-center mt-4">
        <span className="text-lg font-semibold text-accent">
          R$ {pkg.preco.toFixed(2).replace('.', ',')}
        </span>
        <button
          onClick={handleClick}
          disabled={isBuying}
          className={`px-4 py-2 font-semibold text-black bg-secondary rounded
                      hover:bg-secondary/80 transition-all duration-150 cursor-target
                      disabled:bg-gray-500 disabled:cursor-not-allowed
                      flex items-center gap-2
                      ${isClicked ? 'scale-95' : ''}`}
        >
          {isBuying ? <Loader2 size={18} className="animate-spin" /> : <Package size={18} />}
          Comprar
        </button>
      </div>
    </div>
  );
}

// Componente Principal da Loja
export default function ShopScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('items'); // 'items' ou 'packages'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Estados da Loja
  const [storeItems, setStoreItems] = useState([]); // Power-ups à venda
  const [storePackages, setStorePackages] = useState([]); // Pacotes de moedas à venda
  
  // Estado do Jogador
  const [moedas, setMoedas] = useState(0); // Saldo atual de moedas
  
  // Estado de Compra
  const [buyingId, setBuyingId] = useState(null); // ID do item/pacote sendo comprado
  
  // (NOVO) Estados para o Modal de Pagamento
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null); // { compra_pacote_id, amount, price }

  // Função para carregar todos os dados da loja e do jogador
  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Busca o inventário (saldo de moedas)
      const invPromise = api.get('/shop/inventory');
      // 2. Busca os itens (power-ups) à venda
      const itemsPromise = api.get('/shop/store-items');
      // 3. Busca os pacotes de moedas à venda
      const packagesPromise = api.get('/shop/store-packages');

      const [invRes, itemsRes, packagesRes] = await Promise.all([
        invPromise,
        itemsPromise,
        packagesPromise,
      ]);

      setMoedas(invRes.data?.moedas || 0);
      setStoreItems(itemsRes.data || []);
      setStorePackages(packagesRes.data || []);

    } catch (err) {
      console.error('Erro ao carregar dados da loja:', err);
      setError(err.response?.data?.error || 'Falha ao carregar loja. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Carrega os dados quando o componente é montado
  useEffect(() => {
    fetchData();
  }, []);
  
  // (NOVO) Handlers para o Modal de Pagamento
  const closePaymentModal = () => {
      setIsPaymentModalOpen(false);
      setPaymentDetails(null);
  };

  const handleConfirmPayment = (confirmedAmount) => {
      // Esta função é chamada pelo PaymentModal após a "simulação" de sucesso
      console.log(`Pagamento de ${confirmedAmount} moedas confirmado (Simulação).`);
      toast.success(`Pagamento confirmado! ${confirmedAmount} moedas foram adicionadas à sua conta.`);
      fetchData(); 
  };


  // Handler para comprar um Item (Power-up)
  const handleBuyItem = async (itemId) => {
    if (buyingId) return; // Já está comprando algo
    setBuyingId(itemId);
    setError('');

    try {
      await api.post('/shop/buy-item', { item_id: itemId });
      toast.success('Item comprado com sucesso!');
      await fetchData(); // Recarrega tudo para simplicidade
    } catch (err) {
      console.error('Erro ao comprar item:', err);
      toast.error(err.response?.data?.error || 'Saldo insuficiente ou falha na transação.');
    } finally {
      setBuyingId(null);
    }
  };

  // Handler para comprar um Pacote (Moedas)
  const handleBuyPackage = async (packageId) => {
    if (buyingId) return;
    setBuyingId(packageId);
    setError('');

    // (NOVO) 1. Encontra os detalhes do pacote no estado local
    const pkg = storePackages.find(p => p.pacote_id === packageId);
    if (!pkg) {
        setError('Detalhes do pacote não encontrados.');
        setBuyingId(null);
        return;
    }

    try {
      // 2. Chama a API para registrar o pedido como PENDENTE (backend/routes/shop.js)
      const { data } = await api.post('/shop/buy-package', { pacote_id: packageId });
      // data.compra_pacote_id é o ID da transação
      
      // (ATUALIZADO) 3. Abre o modal de pagamento, passando os dados necessários
      setPaymentDetails({
          compra_pacote_id: data.compra_pacote_id,
          amount: pkg.qtde_moedas,
          price: pkg.preco, 
      });
      setIsPaymentModalOpen(true);

    } catch (err) {
      console.error('Erro ao comprar pacote:', err);
      setError(err.response?.data?.error || 'Falha ao iniciar compra.');
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="relative flex flex-col min-h-[calc(100vh-120px)] text-white p-4 font-cyber">
      <MatrixRain
        color="#ff00ffff"
        fontSize={12}
        className="fixed inset-0 z-0 rounded-lg"
      />
      {/* Cabeçalho e Botão Voltar */}
      <header className="flex items-center justify-between mb-6 px-2 z-10">
        <button
          onClick={() => navigate('/')}
          className="text-text-muted hover:text-primary transition-colors flex items-center gap-1 text-sm cursor-target"
          title="Voltar ao Lobby"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>

        <GlitchText text="Loja" fontSize={5} color="rgba(115, 255, 0, 1)" fontWeight="normal" textAlign="center" font="/src/assets/fonts/Dena.otf" />
        {/* <h1 className="text-3xl md:text-4xl font-bold text-center text-accent z-10">
          LOJA
        </h1> */}

        {/* Saldo de Moedas */}
        <div className="bg-bg-secondary border border-warning/50 rounded px-4 py-2 flex items-center gap-2">
          <span className="text-lg font-semibold text-warning">{moedas}</span>
          <Gem size={20} className="text-warning" />
        </div>
      </header>

      {/* Abas de Navegação */}
      <nav className="flex justify-center gap-4 mb-6 z-10">
        <button
          onClick={() => setTab('items')}
          className={`px-6 py-2 text-lg font-semibold rounded-t-lg transition-colors cursor-target
                      ${tab === 'items' ? 'bg-primary text-black' : 'bg-bg-secondary text-primary/70 hover:bg-bg-input'}`}
        >
          Itens (Power-ups)
        </button>
        <button
          onClick={() => setTab('packages')}
          className={`px-6 py-2 text-lg font-semibold rounded-t-lg transition-colors cursor-target
                      ${tab === 'packages' ? 'bg-secondary text-black' : 'bg-bg-input text-secondary/70 hover:bg-bg-input'}`}
        >
          Pacotes (Moedas)
        </button>
      </nav>

      {/* Mensagem de Erro Global */}
      {error && (
        <div className="bg-red-900 border border-red-500 text-red-200 p-3 rounded-lg text-center mb-4 z-10">
          {error}
        </div>
      )}

      {/* Conteúdo da Loja */}
      {loading ? (
        <div className="flex justify-center items-center py-20 z-10">
          <Loader2 size={40} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="w-full max-w-5xl mx-auto z-10">
          {/* Aba de Itens (Power-ups) */}
          {tab === 'items' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {storeItems.length > 0 ? (
                storeItems.map(item => (
                  <StoreItemCard 
                    key={item.item_id}
                    item={item}
                    onBuy={handleBuyItem}
                    isBuying={buyingId === item.item_id}
                  />
                ))
              ) : (
                <p className="text-text-muted col-span-full text-center">Nenhum item à venda no momento.</p>
              )}
            </div>
          )}

          {/* Aba de Pacotes (Moedas) */}
          {tab === 'packages' && (
            <div>
              <div className="bg-blue-900/50 border border-blue-400 text-blue-200 p-3 rounded-lg text-center mb-6 flex items-center gap-2">
                  <Info size={20} />
                  <span>A compra de pacotes é simulada. Nenhum valor real será cobrado.</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {storePackages.length > 0 ? (
                  storePackages.map(pkg => (
                    <PackageCard 
                      key={pkg.pacote_id}
                      pkg={pkg}
                      onBuy={handleBuyPackage}
                      isBuying={buyingId === pkg.pacote_id}
                    />
                  ))
                ) : (
                  <p className="text-text-muted col-span-full text-center">Nenhum pacote à venda no momento.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* (NOVO) Renderiza o PaymentModal */}
      {paymentDetails && (
          <PaymentModal
              isOpen={isPaymentModalOpen}
              onClose={closePaymentModal}
              onConfirm={handleConfirmPayment}
              amount={paymentDetails.amount}
              // Passamos o preço formatado, como a PackageCard faz
              price={paymentDetails.price.toFixed(2).replace('.', ',')} 
          />
      )}
    </div>
  );
}
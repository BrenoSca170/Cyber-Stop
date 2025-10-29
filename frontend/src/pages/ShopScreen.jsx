// frontend/src/pages/ShopScreen.jsx
import { useState, useEffect } from 'react';
import api from '../lib/api'; // Importa a instância configurada do Axios
import ShopItem from '../components/ShopItem'; // Componente para cada item da loja
import BuyCoinsModal from '../components/BuyCoinsModal'; // Importa o modal de compra de moedas
import { Wallet, Store, Loader2, PlusCircle } from 'lucide-react'; // Ícones necessários

function ShopScreen() {
  // --- ESTADOS DO COMPONENTE ---
  const [moedas, setMoedas] = useState(0); // Guarda o saldo de moedas do usuário
  const [inventario, setInventario] = useState([]); // Guarda os power-ups que o usuário possui
  const [shopItems, setShopItems] = useState([]); // Guarda a lista de itens disponíveis na loja
  const [loading, setLoading] = useState(true); // Indica se os dados iniciais estão a carregar
  const [purchasingId, setPurchasingId] = useState(null); // ID do power-up que está a ser comprado (para feedback visual)
  const [message, setMessage] = useState(''); // Mensagem de sucesso (compra, adição de moedas)
  const [error, setError] = useState(''); // Mensagem de erro
  const [isBuyCoinsModalOpen, setIsBuyCoinsModalOpen] = useState(false); // Controla a visibilidade do modal de compra de moedas

  // ==================================================================
  // FUNÇÃO PARA CARREGAR DADOS DA LOJA E INVENTÁRIO (API GET)
  // ==================================================================
  const fetchData = async () => {
    setLoading(true); // Começa a carregar
    setMessage(''); // Limpa mensagens anteriores
    setError('');
    try {
      // Busca os itens da loja E o inventário/moedas do jogador em paralelo para otimizar
      const [itemsRes, inventoryRes] = await Promise.all([
        api.get('/shop/items'), // Endpoint que lista os power-ups
        api.get('/shop/inventory') // Endpoint que retorna moedas e inventário do jogador logado
      ]);

      setShopItems(itemsRes.data || []); // Atualiza a lista de itens da loja
      setMoedas(inventoryRes.data?.moedas || 0); // Atualiza o saldo de moedas
      setInventario(inventoryRes.data?.inventario || []); // Atualiza o inventário

    } catch (err) {
      console.error("Erro ao carregar loja ou inventário", err);
      setError("Não foi possível carregar os dados da loja. Tente recarregar a página."); // Define mensagem de erro
    } finally {
      setLoading(false); // Termina o carregamento
    }
  };

  // Carrega os dados iniciais quando o componente é montado pela primeira vez
  useEffect(() => {
    fetchData();
  }, []); // O array vazio [] garante que isto só corre uma vez

  // ==================================================================
  // FUNÇÃO PARA LIDAR COM A COMPRA DE POWER-UPS (API POST)
  // ==================================================================
  const handlePurchase = async (item) => {
    setMessage(''); // Limpa mensagens
    setError('');
    // 1. Verificação rápida no cliente (o backend fará a verificação final)
    if (moedas < item.price) {
      setError("Saldo insuficiente!");
      setTimeout(() => setError(''), 3000); // Limpa o erro após 3 segundos
      return;
    }

    setPurchasingId(item.id); // Define qual item está a ser comprado (para mostrar loading no botão)
    try {
      // 2. Chama o endpoint do backend para realizar a compra
      const response = await api.post('/shop/purchase', { power_up_id: item.id });

      // 3. Se a compra foi bem-sucedida no backend:
      setMoedas(response.data.novo_saldo); // Atualiza o saldo de moedas com o valor retornado
      setMessage(`'${item.name}' comprado com sucesso!`); // Mostra mensagem de sucesso
      // Re-busca todos os dados para atualizar inventário e saldo de forma simples
      // (O ideal em apps maiores seria atualizar o estado localmente sem rebuscar tudo)
      fetchData(); 

    } catch (err) {
      console.error("Erro na compra", err);
      // Mostra o erro retornado pelo backend ou uma mensagem genérica
      setError(err.response?.data?.error || "Ocorreu um erro na sua compra.");
    } finally {
      setPurchasingId(null); // Limpa o ID do item em compra (para remover o loading do botão)
      // Limpa as mensagens após alguns segundos
      setTimeout(() => { setMessage(''); setError(''); }, 3000);
    }
  };

  // ==================================================================
  // FUNÇÃO PARA CONFIRMAR A "COMPRA" FIGURATIVA DE MOEDAS (API POST)
  // ==================================================================
  const handleConfirmCoinPurchase = async (amount) => {
    setMessage(''); // Limpa mensagens
    setError('');
    console.log(`Simulando compra de ${amount} moedas...`);
    try {
        // Chama o endpoint do backend que simula a adição de moedas
        const response = await api.post('/shop/add-coins', { amount });
        setMoedas(response.data.novo_saldo); // Atualiza o saldo com a resposta do backend
        setMessage(`${amount.toLocaleString('pt-BR')} moedas adicionadas com sucesso!`); // Mostra sucesso
        setTimeout(() => setMessage(''), 4000); // Limpa a mensagem
    } catch (err) {
        console.error("Erro ao adicionar moedas:", err);
        // Mostra o erro retornado pelo backend ou uma mensagem genérica
        setError(err.response?.data?.error || "Ocorreu um erro ao adicionar moedas.");
        setTimeout(() => setError(''), 4000); // Limpa a mensagem
    }
    // O modal fechará automaticamente (lógica dentro de BuyCoinsModal)
  };

  // --- RENDERIZAÇÃO ---

  // Estado de carregamento inicial
  if (loading && shopItems.length === 0) {
    return (
      <div className="text-white text-center p-10 flex items-center justify-center gap-2">
        <Loader2 className="animate-spin" /> Carregando loja...
      </div>
    );
  }

  // Tela principal da loja
  return (
    <div className="p-4 md:p-8 text-white">
      <div className="max-w-4xl mx-auto">
        {/* Seção da Carteira e Botão Adicionar Moedas */}
        <div className="flex flex-col md:flex-row items-center justify-between rounded-lg bg-gray-800 p-4 md:p-6 mb-8 shadow-md gap-4 md:gap-2">
          {/* Saldo Atual */}
          <div className="flex items-center gap-3 md:gap-4">
            <Wallet className="h-8 w-8 md:h-10 md:w-10 text-green-400" />
            <div>
              <h2 className="text-lg md:text-xl font-bold">Minha Carteira</h2>
            </div>
            {/* Exibe o saldo formatado */}
            <span className="text-2xl md:text-3xl font-bold text-yellow-400 flex items-center gap-1">
               {loading ? <Loader2 className="animate-spin h-5 w-5" /> : moedas.toLocaleString('pt-BR')} 
               <span className="text-sm font-normal">moedas</span>
            </span>
          </div>
          
          {/* Botão para Abrir o Modal de Compra de Moedas */}
          <button 
            onClick={() => setIsBuyCoinsModalOpen(true)} // Define o estado para abrir o modal
            className="bg-yellow-600 hover:bg-yellow-700 text-gray-900 font-semibold py-2 px-4 rounded-md flex items-center gap-2 text-sm md:text-base w-full md:w-auto justify-center transition-transform hover:scale-105"
          >
            <PlusCircle size={18} /> Adquirir Mais Moedas
          </button>
        </div>
        
        {/* Área para Mensagens de Feedback (Sucesso ou Erro) */}
        {message && <div className="text-center mb-4 font-semibold text-green-400 bg-green-900/50 py-2 px-4 rounded">{message}</div>}
        {error && <div className="text-center mb-4 font-semibold text-red-400 bg-red-900/50 py-2 px-4 rounded">{error}</div>}

        {/* Seção da Loja de Power-ups */}
        <div className="flex items-center gap-3 md:gap-4 mb-6">
          <Store className="h-7 w-7 md:h-8 md:w-8 text-purple-400" />
          <h1 className="text-3xl md:text-4xl font-bold">Loja de Power-ups</h1>
        </div>
        
        {/* Indicador de carregamento se estiver a rebuscar dados */}
        {loading && <div className="text-center text-gray-400">Atualizando...</div>}

        {/* Grid com os Itens da Loja */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Mapeia os itens da loja para o componente ShopItem */}
          {shopItems.map((item) => {
            const isBuyingThis = purchasingId === item.power_up_id; // Verifica se este item está a ser comprado
            const canAfford = moedas >= item.preco; // Verifica se o jogador tem moedas suficientes
            return (
              <ShopItem
                key={item.power_up_id} // Chave única para o React
                // Passa as propriedades do item para o componente filho
                item={{ 
                    id: item.power_up_id, 
                    code: item.codigo_identificador, 
                    name: item.nome,
                    description: item.descricao,
                    price: item.preco
                }}
                onPurchase={handlePurchase} // Passa a função de compra
                canAfford={canAfford && !purchasingId} // Só pode comprar se tiver dinheiro E nenhuma outra compra estiver em andamento
                isPurchasing={isBuyingThis} // Informa se este botão específico deve mostrar loading
              />
            );
          })}
           {/* Mensagem se a loja estiver vazia */}
           {(!loading && shopItems.length === 0) && (
              <p className="text-gray-400 md:col-span-2 lg:col-span-3 text-center">Nenhum item disponível na loja no momento.</p>
           )}
        </div>

         {/* Seção Opcional: Mostrar Inventário Atual do Jogador */}
         <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4 text-cyan-400">Meu Inventário</h2>
            {/* Mostra o inventário se não estiver a carregar e houver itens */}
            {!loading && inventario.length > 0 ? (
                <ul className="space-y-2">
                {/* Mapeia os itens do inventário */}
                {inventario.map(invItem => (
                    <li key={invItem.power_up_id} className="bg-gray-800 p-3 rounded flex justify-between items-center shadow">
                    {/* Nome e descrição do item */}
                    <span>{invItem.nome} <span className="text-gray-400 text-sm hidden sm:inline">({invItem.descricao})</span></span>
                    {/* Quantidade */}
                    <span className="font-bold text-lg text-cyan-300">x{invItem.quantidade}</span>
                    </li>
                ))}
                </ul>
            // Mensagem se o inventário estiver vazio
            ) : !loading ? (
                <p className="text-gray-500 italic">Você não possui power-ups.</p>
            // Mostra loading se ainda estiver a carregar
            ) : (
                 <div className="text-center text-gray-400"><Loader2 className="animate-spin inline mr-2"/> Carregando inventário...</div>
            )}
         </div>

      </div>

      {/* Renderiza o Modal (só é visível quando isBuyCoinsModalOpen é true) */}
      <BuyCoinsModal 
        isOpen={isBuyCoinsModalOpen} 
        onClose={() => setIsBuyCoinsModalOpen(false)} // Função para fechar o modal
        onConfirmPurchase={handleConfirmCoinPurchase} // Passa a função que chama o backend
      />
    </div>
  );
}

export default ShopScreen;
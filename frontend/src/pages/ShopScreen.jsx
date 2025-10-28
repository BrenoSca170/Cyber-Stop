import { useState, useEffect } from 'react';
import axios from 'axios';
import ShopItem from '../components/ShopItem'; // Importamos o novo componente
import { Wallet, Store } from 'lucide-react'; // Ícones para a tela

function ShopScreen() {
  // --- ESTADOS DO COMPONENTE ---
  const [wallet, setWallet] = useState({ balance: 0 }); // Guarda o saldo do usuário
  const [shopItems, setShopItems] = useState([]); // Guarda a lista de itens da loja
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // ==================================================================
  // EFEITO PARA CARREGAR DADOS DA CARTEIRA E DA LOJA (API GET)
  // ==================================================================
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setMessage('Carregando informações...');
      try {
        // Simular busca do saldo do usuário (URL futura: /api/users/me/wallet)
        const walletFromMongo = { balance: 300 };
        setWallet(walletFromMongo);

        // Simular busca dos itens da loja (URL futura: /api/shop/items)
        const itemsFromMongo = [
          { id: 'pwr001', name: 'Palavra Mágica', description: 'Preenche uma categoria vazia aleatoriamente.', price: 100 },
          { id: 'pwr002', name: 'Tempo Extra', description: 'Adiciona 15 segundos ao cronômetro.', price: 75 },
          { id: 'pwr003', name: 'Dica de Letra', description: 'Mostra a primeira letra de uma resposta.', price: 200 },
          { id: 'pwr004', name: 'Dobra Pontos', description: 'Dobra a pontuação da próxima rodada.', price: 500 },
        ];
        setShopItems(itemsFromMongo);

        setMessage('');
      } catch (error) {
        console.error("Erro ao carregar loja", error);
        setMessage("Não foi possível carregar a loja.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // ==================================================================
  // FUNÇÃO PARA LIDAR COM A COMPRA (API POST)
  // ==================================================================
  const handlePurchase = async (item) => {
    setMessage('');
    // 1. Verifica se o usuário tem saldo suficiente
    if (wallet.balance < item.price) {
      setMessage("Saldo insuficiente!");
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setLoading(true); // Desabilita botões durante a "transação"
    try {
      // --- PONTO DE INTEGRAÇÃO COM A API (POST) ---
      // Envia o ID do item que o usuário quer comprar
      // URL futura: /api/shop/purchase
      await axios.post('/api/shop/purchase', { itemId: item.id });

      // 3. Se a compra no backend foi um sucesso, atualiza o estado no frontend
      setWallet((prevWallet) => ({
        ...prevWallet,
        balance: prevWallet.balance - item.price,
      }));
      setMessage(`'${item.name}' comprado com sucesso!`);

    } catch (error) {
      console.error("Erro na compra", error);
      setMessage("Ocorreu um erro na sua compra.");
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading && shopItems.length === 0) {
    return <div className="text-white text-center p-10">{message}</div>;
  }

  return (
    <div className="p-8 text-white">
      <div className="max-w-4xl mx-auto">
        {/* Seção da Carteira */}
        <div className="flex items-center justify-between rounded-lg bg-gray-800 p-6 mb-8">
          <div className="flex items-center gap-4">
            <Wallet className="h-10 w-10 text-green-400" />
            <div>
              <h2 className="text-xl font-bold">Minha Carteira</h2>
              <p className="text-gray-400">Seu saldo de moedas</p>
            </div>
          </div>
          <span className="text-3xl font-bold text-yellow-400">{wallet.balance}</span>
        </div>
        
        {/* Mensagem de Feedback */}
        {message && <div className="text-center mb-4 font-semibold text-green-400">{message}</div>}

        {/* Seção da Loja */}
        <div className="flex items-center gap-4 mb-6">
          <Store className="h-8 w-8 text-purple-400" />
          <h1 className="text-4xl font-bold">Loja de Power-ups</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {shopItems.map((item) => {
            const canAfford = wallet.balance >= item.price;
            return (
              <ShopItem
                key={item.id}
                item={item}
                onPurchase={handlePurchase}
                canAfford={canAfford && !loading} // Só pode comprar se tiver dinheiro E não estiver carregando
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ShopScreen;
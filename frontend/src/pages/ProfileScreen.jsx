import { useState, useEffect } from 'react';
// import api from '../lib/api'; // Removido import duplicado
// (CORRIGIDO) Importa 'avatarList' (objetos) e 'DEFAULT_AVATAR' (que é o primeiro objeto da lista)
import { avatarList, DEFAULT_AVATAR } from '../lib/avatarList'; 
import GlitchText from '../components/GlitchText'; 
import MatrixRain from '../components/MatrixRain';
import api from '../lib/api'; // <-- Mantido este import
import InventoryItem from '../components/InventoryItem'; // <-- IMPORTADO O NOVO COMPONENTE
import { Coins } from 'lucide-react'; // <-- IMPORTADO ÍCONE DE MOEDAS

function ProfileScreen() {
  const [profileData, setProfileData] = useState({
    nome_de_usuario: '',
    email: '',
    // (CORRIGIDO) Usamos o .nome do avatar padrão para o estado inicial
    avatar_nome: DEFAULT_AVATAR.nome, 
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); 

  // --- NOVO STATE PARA O INVENTÁRIO ---
  // Usamos nomes de estado separados para não conflitar com 'loading' do perfil
  const [inventoryItems, setInventoryItems] = useState([]);
  const [coins, setCoins] = useState(0);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState(null);
  // --- FIM DO NOVO STATE ---

  // (REMOVIDO) Não precisamos mais disso, pois o .src já vem completo do avatarList
  // const avatarBasePath = '/avatars/'; 

  // useEffect existente para o perfil
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/auth/me'); 
        if (data.jogador) {
          if (!data.jogador.avatar_nome) {
            // (CORRIGIDO) Usamos o .nome do avatar padrão
            data.jogador.avatar_nome = DEFAULT_AVATAR.nome;
          }
          setProfileData(data.jogador);
        }
      } catch (error) {
        console.error('Erro ao buscar perfil:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // --- NOVO EFFECT PARA BUSCAR INVENTÁRIO ---
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        setInventoryLoading(true);
        // Usamos a rota que corrigimos no shop.js [cite: UploadiaBreno/backend/routes/shop.js]
        const { data } = await api.get('/shop/inventory');
        
        // Os dados já vêm formatados do backend
        setInventoryItems(data.inventario || []);
        setCoins(data.moedas || 0);
        setInventoryError(null);
      } catch (err) {
        console.error("Erro ao buscar inventário:", err);
        setInventoryError("Falha ao carregar inventário.");
      } finally {
        setInventoryLoading(false);
      }
    };

    fetchInventory();
  }, []); // Roda uma vez quando o componente monta
  // --- FIM DO NOVO EFFECT ---

  const handleRandomAvatar = async () => {
    // (CORRIGIDO) Usa 'avatarList'
    if (isSaving || avatarList.length === 0) return;
    setIsSaving(true);
    
    let newAvatarName = profileData.avatar_nome; // (Mudei o nome da var para clareza)

    // (CORRIGIDO) Usa 'avatarList'
    if (avatarList.length > 1) {
      do {
        const randomIndex = Math.floor(Math.random() * avatarList.length);
        // (CORRIGIDO) Pega apenas o .nome do objeto sorteado
        newAvatarName = avatarList[randomIndex].nome; 
      } while (newAvatarName === profileData.avatar_nome);
    } else if (avatarList.length === 1) {
        // (CORRIGIDO) Pega apenas o .nome
      newAvatarName = avatarList[0].nome;
    }
    
    // (CORRIGIDO) Atualiza o estado com o novo nome
    setProfileData((prev) => ({ ...prev, avatar_nome: newAvatarName }));

    try {
      // (CORRIGIDO) Envia apenas o nome para a API
      await api.put('/auth/avatar', { avatar_nome: newAvatarName });
    } catch (error) {
      console.error('Erro ao salvar avatar:', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // (NOVO) Encontra o objeto do avatar atual para pegar o .src correto
  const currentAvatar = avatarList.find(
    avatar => avatar.nome === profileData.avatar_nome
  ) || DEFAULT_AVATAR;

  // --- NOVA FUNÇÃO HELPER PARA RENDERIZAR O INVENTÁRIO ---
  const renderInventory = () => {
    if (inventoryLoading) {
      return <p className="text-gray-400 text-sm">Carregando power-ups...</p>;
    }
    if (inventoryError) {
      return <p className="text-red-500 text-sm">{inventoryError}</p>;
    }
    if (inventoryItems.length === 0) {
      return <p className="text-gray-400 text-sm">Nenhum power-up no inventário.</p>;
    }
    return (
      // Grid responsiva para os power-ups
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {inventoryItems.map((item) => (
          // Usamos 'power_up_id' que o backend agora envia
          <InventoryItem key={item.power_up_id} item={item} />
        ))}
      </div>
    );
  };
  // --- FIM DA FUNÇÃO HELPER ---


  return (
    <div className="flex justify-center items-center min-h-screen p-4 sm:p-8 text-white">
      <MatrixRain className='z-0' />
      <div className="w-full max-w-md p-6 sm:p-8 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 z-10 opacity-95 overflow-y-auto max-h-[90vh]">
        
        <GlitchText text="Meu perfil" fontSize={2} color="rgb(57, 255, 20)" fontWeight="bold" textAlign="center" font="https://fonts.gstatic.com/s/orbitron/v35/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1ny_Cmxpg.ttf" />
        
        <div className="flex flex-col items-center mb-8">
          
          <div className="relative w-32 h-32 md:w-40 md:h-40">
            <img
              // (CORRIGIDO) Usa o .src do objeto do avatar encontrado
              src={currentAvatar.src} 
              alt="Avatar Atual"
              className="w-full h-full rounded-full bg-gray-700 border-4 border-blue-500 object-cover shadow-lg shadow-blue-500/30"
            />
            <div className="absolute inset-0 rounded-full border border-white/10 animate-pulse"></div>
          </div>
          
          <button
            onClick={handleRandomAvatar}
            disabled={isSaving || loading}
            className="mt-4 p-2 rounded-full cursor-target text-blue-400 hover:text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-all duration-200 disabled:text-gray-600 disabled:bg-transparent disabled:cursor-not-allowed"
            aria-label="Sortear novo avatar" 
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-8 w-8 ${isSaving ? 'animate-spin' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={2}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.183M4.031 9.348a8.25 8.25 0 0113.803-3.183l3.181 3.183m-4.992-4.992v4.992m0 0H9.345" 
              />
            </svg>
          </button>
        </div>

        {/* --- SEÇÃO DE INVENTÁRIO ADICIONADA --- */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Inventário
          </label>
          
          {/* Moedas */}
          <div className="flex items-center gap-3 mt-1 block w-full rounded-md border-gray-600 bg-gray-900 p-3 shadow-sm sm:text-lg text-white font-mono mb-4">
            <Coins size={20} className="text-blue-400" />
            <span>Moedas:</span>
            <span className="text-blue-400">
              {inventoryLoading ? '...' : coins}
            </span>
          </div>

          {/* Power-ups */}
          {renderInventory()}
        </div>
        {/* --- FIM DA SEÇÃO DE INVENTÁRIO --- */}

        <div className="space-y-6 mb-10">
          <div>
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider">
              Nome de Usuário
            </label>
            <div className="mt-1 block w-full rounded-md border-gray-600 bg-gray-900 p-3 shadow-sm sm:text-lg text-white font-mono cursor-target">
              {profileData.nome_de_usuario || (loading ? 'Carregando...' : 'N/A')}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider">
              Email
            </label>
            <div className="mt-1 block w-full rounded-md border-gray-600 bg-gray-900 p-3 text-gray-400 shadow-sm sm:text-lg font-mono cursor-target">
              {profileData.email || (loading ? 'Carregando...' : 'N/A')}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}

export default ProfileScreen;
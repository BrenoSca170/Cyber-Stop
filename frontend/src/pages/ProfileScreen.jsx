import { useState, useEffect, useCallback } from 'react';
import avatarList from '../lib/avatarList';
import characterList from '../lib/characterList';
import api from '../lib/api';
import InventoryItem from '../components/InventoryItem';
import MatrixRain from '../components/MatrixRain';

function ProfileScreen() {
  const [profileData, setProfileData] = useState({
    nome_de_usuario: '',
    email: '',
    avatar_nome: 'default',       // garante default inicialmente
    personagem_nome: 'jax',
    ranking_stats: {
      partidas_jogadas: 0,
      vitorias: 0,
      pontuacao_total: 0,
    },
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [coins, setCoins] = useState(0);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/auth/me');
        if (cancelled) return;
        if (data && data.jogador) {
          setProfileData(prev => ({
            ...prev,
            ...data.jogador,
            // fallback para 'default' caso backend retorne undefined/null
            avatar_nome: data.jogador.avatar_nome || prev.avatar_nome || 'default',
            personagem_nome: data.jogador.personagem_nome || prev.personagem_nome || 'default',
            ranking_stats: data.jogador.ranking_stats || prev.ranking_stats,
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar perfil:', error?.message ?? error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchInventory = async () => {
      setInventoryLoading(true);
      setInventoryError(null);
      try {
        const { data } = await api.get('/shop/inventory');
        if (cancelled) return;
        setInventoryItems(data?.inventario ?? []);
        setCoins(data?.moedas ?? 0);
      } catch (err) {
        console.error('Erro ao buscar inventário:', err);
        setInventoryError('Falha ao carregar inventário.');
      } finally {
        if (!cancelled) setInventoryLoading(false);
      }
    };
    fetchInventory();
    return () => { cancelled = true; };
  }, []);

  /**
   * handleCycleSelect: percorre a lista (avatarList ou characterList) passo a passo em ciclo.
   * type: 'avatar' ou 'personagem'
   */
  const handleCycleSelect = useCallback(async (type) => {
    if (isSaving) return;
    setIsSaving(true);

    const list = type === 'avatar' ? (avatarList || []) : (characterList || []);
    const key = `${type}_nome`;
    const currentName = profileData[key] ?? '';

    if (!list.length) {
      console.warn(`Lista de ${type} vazia ou não encontrada.`);
      setIsSaving(false);
      return;
    }

    // encontra índice atual na lista
    const currentIndex = list.findIndex(item => item.nome === currentName);
    const nextIndex = (currentIndex + 1) % list.length; // ciclo
    const newName = list[nextIndex].nome;

    // otimista update local
    setProfileData(prev => ({ ...prev, [key]: newName }));

    try {
      // endpoint esperado: /auth/avatar ou /auth/personagem
      await api.put(`/auth/${type}`, { [key]: newName });
    } catch (error) {
      console.error(`Erro ao salvar ${type}:`, error?.message ?? error);
      // rollback em caso de erro
      setProfileData(prev => ({ ...prev, [key]: currentName }));
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, profileData]);

  const currentAvatar = (avatarList || []).find(a => a.nome === profileData.avatar_nome)
                       || (avatarList || []).find(a => a.nome === 'default')
                       || { url: '/avatars/default.png' };

  const currentPersonagem = (characterList || []).find(c => c.nome === profileData.personagem_nome)
                           || (characterList || []).find(c => c.nome === 'default')
                           || { url: '/characters/default.png' };

  return (
    <div className="relative flex items-center justify-center h-screen text-white font-cyber overflow-hidden">
      <MatrixRain className="absolute inset-0 z-0" />
      <div className="absolute inset-0 bg-black/70 z-0"></div>

      <div className="relative z-10 w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 p-6">

        {/* Coluna Esquerda: Identidade */}
        <div
          className="md:col-span-1 flex flex-col items-center p-4 border-2 border-pink-500 bg-black/50"
          data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        >
          <h2 className="text-2xl font-bold text-pink-400 uppercase tracking-widest mb-4">Identidade</h2>
          <div className="relative w-40 h-40 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-pink-500 animate-pulse"></div>
            <img
              src={currentAvatar.url}
              alt="Avatar"
              className="w-full h-full rounded-full object-cover p-1"
            />
          </div>
          <div className="w-full p-2 mb-4 text-center border border-pink-500 bg-black/30">
            <p className="text-sm"><span className="font-bold">Usuário:</span> {profileData.nome_de_usuario}</p>
            <p className="text-sm"><span className="font-bold">Email:</span> {profileData.email}</p>
          </div>
          <button
            onClick={() => handleCycleSelect('avatar')}
            disabled={isSaving}
            className="w-full bg-cyan-500 text-black font-bold py-2 hover:bg-cyan-400 transition-colors"
          >
            {isSaving ? 'Salvando...' : 'Mudar Avatar'}
          </button>
        </div>

        {/* Coluna Central: Perfil */}
        <div
          className="md:col-span-1 flex flex-col items-center p-4 border-2 border-green-500 bg-black/50"
          data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        >
          <h2 className="text-2xl font-bold text-green-400 uppercase tracking-widest mb-4">Perfil</h2>
          <div className="relative w-full h-80 mb-4 flex items-center justify-center">
            <img
              src={currentPersonagem.url}
              alt="Personagem"
              className="w-full h-full object-contain"
            />
          </div>
          <button
            onClick={() => handleCycleSelect('personagem')}
            disabled={isSaving}
            className="w-full bg-cyan-500 text-black font-bold py-2 hover:bg-cyan-400 transition-colors"
          >
            {isSaving ? 'Salvando...' : 'Mudar Personagem'}
          </button>
        </div>

        {/* Coluna Direita: Status e Inventário */}
        <div className="md:col-span-1 flex flex-col justify-between">
          <div
            className="w-full p-4 border-2 border-pink-500 bg-black/50 mb-6"
            data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
          >
            <h2 className="text-2xl font-bold text-pink-400 uppercase tracking-widest mb-4">Status</h2>
            <div className="text-base space-y-2">
              <p><span className="font-bold">Partidas Jogadas:</span> {profileData.ranking_stats?.partidas_jogadas ?? 0}</p>
              <p><span className="font-bold">Vitórias:</span> {profileData.ranking_stats?.vitorias ?? 0}</p>
              <p><span className="font-bold">Pontuação Total:</span> {profileData.ranking_stats?.pontuacao_total ?? 0}</p>
            </div>
          </div>

          <div
            className="w-full p-4 border-2 border-pink-500 bg-black/50 flex-grow"
            data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
          >
            <h2 className="text-2xl font-bold text-pink-400 uppercase tracking-widest mb-4">Inventário</h2>
            <div className="overflow-y-auto h-48 pr-2">
              {inventoryLoading && <p>Carregando...</p>}
              {!inventoryLoading && inventoryItems.length === 0 && <p>Nenhum item no inventário.</p>}
              {!inventoryLoading && inventoryItems.map((item) => {
                const key = item.power_up_id ?? item.id ?? JSON.stringify(item);
                return <InventoryItem key={key} item={item} />;
              })}
              {inventoryError && <p className="text-red-500">{inventoryError}</p>}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default ProfileScreen;

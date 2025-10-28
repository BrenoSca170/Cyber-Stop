import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function MatchSettingsScreen() {
  const navigate = useNavigate();

  // --- ESTADOS DO COMPONENTE ---
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [roundTime, setRoundTime] = useState(60);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  // ==================================================================
  // EFEITO PARA CARREGAR DADOS INICIAIS DO SUPABASE (GET)
  // ==================================================================
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setMessage('Carregando configurações...');
      try {
        // --- PONTO DE INTEGRAÇÃO REAL COM SUPABASE ---
        // 1. Buscar TODAS as categorias disponíveis da tabela 'tema'
        const { data: temas, error: temasError } = await supabase
          .from('tema')
          .select('tema_nome');

        if (temasError) throw temasError;

        // Extrai apenas os nomes dos temas do array de objetos
        const categoryNames = temas.map(tema => tema.tema_nome);
        setAllCategories(categoryNames);

        // 2. Simular busca das PREFERÊNCIAS SALVAS do usuário (LÓGICA FUTURA)
        // QUANDO a tabela de preferências existir, você fará uma busca aqui.
        // Por enquanto, vamos pré-selecionar os 4 primeiros temas da lista.
        const userPreferencesFromMongo = {
          selected: categoryNames.slice(0, 4), // Pega os 4 primeiros como padrão
          time: 90,
        };
        setSelectedCategories(userPreferencesFromMongo.selected);
        setRoundTime(userPreferencesFromMongo.time);
        
        setMessage('');
      } catch (error) {
        console.error("Erro ao buscar configurações:", error.message);
        setMessage("Não foi possível carregar as configurações.");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []); // Array vazio [] para rodar apenas uma vez

  const handleCategoryChange = (category) => {
    setSelectedCategories((prevSelected) => {
      if (prevSelected.includes(category)) {
        return prevSelected.filter((item) => item !== category);
      }
      return [...prevSelected, category];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedCategories.length < 3) {
      setMessage("Selecione pelo menos 3 categorias!");
      return;
    }
    
    // --- PONTO DE INTEGRAÇÃO FUTURO (PUT/POST) ---
    // Aqui você salvaria as preferências do usuário no banco de dados.
    // Ex: await supabase.from('jogador_configuracoes').update({ ... })
    console.log('Configurações salvas (simulação):', {
      categories: selectedCategories,
      time: roundTime,
    });

    // Navega para a tela de jogo, passando as configurações escolhidas
    navigate('/', { state: { settings: { categories: selectedCategories, time: roundTime } } });
  };
  
  // O JSX do formulário continua o mesmo, agora alimentado por dados reais
  if (loading && allCategories.length === 0) {
    return <div className="text-white text-center p-10">{message}</div>;
  }

  return (
    <div className="flex justify-center p-8 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl">
        <h1 className="text-4xl font-bold mb-8">Configurações da Partida</h1>

        {/* Seleção de Tempo */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Tempo da Rodada</h2>
          <div className="flex justify-around rounded-lg bg-gray-800 p-2">
            {[60, 90, 120].map((time) => (
              <label key={time} className={`flex-1 text-center cursor-pointer p-3 rounded-md transition-colors ${roundTime === time ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>
                <input type="radio" name="roundTime" value={time} checked={roundTime === time} onChange={() => setRoundTime(time)} className="hidden" />
                {time}s
              </label>
            ))}
          </div>
        </div>

        {/* Seleção de Categorias */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Selecione os Tópicos</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 rounded-lg bg-gray-800 p-6">
            {allCategories.map((category) => (
              <label key={category} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => handleCategoryChange(category)}
                  className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-600"
                />
                <span className="text-lg">{category}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Botão de Ação */}
        <div className="mt-10 text-center">
          <button type="submit" disabled={loading} className="rounded-lg bg-green-600 px-10 py-4 text-xl font-bold text-white shadow-lg hover:bg-green-700 disabled:bg-gray-500">
            {loading ? 'Carregando...' : 'Iniciar Jogo'}
          </button>
          {message && !loading && <p className="text-red-400 mt-4">{message}</p>}
        </div>
      </form>
    </div>
  );
}

export default MatchSettingsScreen;
import { useState, useEffect } from 'react';

function ProfileScreen() {
  // O estado agora reflete as colunas da tabela 'jogador'
  const [profileData, setProfileData] = useState({
    nome_de_usuario: '',
    email: '',
  });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState(null); // Estado para guardar o usuário da sessão

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);

      // 1. Pega o usuário da sessão de autenticação atual
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUser(user);
        try {
          // 2. Usa o ID do usuário da sessão para buscar o perfil na tabela 'jogador'
          // IMPORTANTE: O ideal é que a tabela 'jogador' tenha uma coluna 'id' (UUID) que seja uma chave estrangeira para a tabela 'auth.users' do Supabase.
          // Como o schema atual não tem, usaremos o email como chave para encontrar o jogador correspondente.
          let { data: jogador, error } = await supabase
            .from('jogador')
            .select('nome_de_usuario, email')
            .eq('email', user.email) // Buscando o jogador pelo email do usuário logado
            .single();

          if (error) throw error;

          if (jogador) {
            setProfileData(jogador);
          }
        } catch (error) {
          console.error('Erro ao buscar perfil:', error.message);
          setMessage('Erro ao carregar o perfil.');
        }
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('Salvando alterações...');
    setLoading(true);

    try {
      // Usa o ID do usuário da sessão para saber qual registro atualizar
      const { data, error } = await supabase
        .from('jogador')
        .update({
          nome_de_usuario: profileData.nome_de_usuario,
        })
        .eq('email', user.email); // Atualizando o jogador com base no email

      if (error) throw error;

      setMessage('Perfil salvo com sucesso!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Erro ao salvar perfil:', error.message);
      setMessage('Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // O JSX do formulário foi levemente ajustado para os novos nomes de campos
  if (loading) {
    return <div className="text-white text-center p-10">Carregando...</div>;
  }

  return (
    <div className="flex justify-center p-8 text-white">
      <div className="w-full max-w-lg">
        <h1 className="text-4xl font-bold mb-6">Meu Perfil</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="nome_de_usuario" className="block text-sm font-medium text-gray-300">
              Nome de Usuário
            </label>
            <input
              type="text"
              id="nome_de_usuario"
              name="nome_de_usuario"
              value={profileData.nome_de_usuario}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 p-3 shadow-sm sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email (não pode ser alterado)
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={profileData.email}
              disabled
              className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 p-3 text-gray-400 shadow-sm sm:text-sm"
            />
          </div>
          {/* O campo de idade não existe na tabela 'jogador', então foi removido. */}
          
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-500"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            {message && <span className="text-green-400">{message}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProfileScreen;
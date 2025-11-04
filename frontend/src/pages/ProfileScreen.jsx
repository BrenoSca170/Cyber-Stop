import { useState, useEffect } from 'react';
// Presumindo que 'supabase' está acessível globalmente ou importado de um arquivo de configuração
// import { supabase } from '../lib/api'; // Exemplo de como poderia ser importado

function ProfileScreen() {
  // O estado ainda armazena os dados do jogador
  const [profileData, setProfileData] = useState({
    nome_de_usuario: '',
    email: '',
  });

  const [loading, setLoading] = useState(true);
  // Removemos os estados de 'message' e 'user', pois não há mais formulário
  // O 'user' será obtido e usado apenas dentro do useEffect

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);

      try {
        // 1. Pega o usuário da sessão de autenticação atual
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // 2. Usa o ID do usuário da sessão para buscar o perfil na tabela 'jogador'
          let { data: jogador, error } = await supabase
            .from('jogador')
            .select('nome_de_usuario, email')
            .eq('email', user.email) // Buscando o jogador pelo email do usuário logado
            .single();

          if (error) throw error;

          if (jogador) {
            setProfileData(jogador);
          }
        } else {
          // Se não houver usuário, pode redirecionar ou mostrar mensagem
          console.log("Nenhum usuário logado encontrado.");
        }
      } catch (error) {
        console.error('Erro ao buscar perfil:', error.message);
        // Você poderia adicionar um estado de erro para exibir ao usuário aqui
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []); // O array de dependências vazio garante que isso rode apenas uma vez

  // Funções 'handleChange' e 'handleSubmit' foram removidas pois não há edição
  
  if (loading) {
    return <div className="text-white text-center p-10">Carregando...</div>;
  }

  return (
    <div className="flex justify-center p-8 text-white">
      <div className="w-full max-w-lg">
        <h1 className="text-4xl font-bold mb-8 text-center">Meu Perfil</h1>
        
        {/* Espaço para a Foto de Perfil Padrão */}
        <div className="flex justify-center mb-6">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 border-4 border-gray-600">
            {/* Você pode usar um SVG ou um <img> para uma foto padrão */}
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-20 w-20 md:h-24 md:w-24" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
              />
            </svg>
          </div>
        </div>

        {/* Informações do Perfil (Apenas Visualização) */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Nome de Usuário
            </label>
            <div className="mt-1 block w-full rounded-md border-gray-600 bg-gray-700 p-3 shadow-sm sm:text-lg text-white cursor-target">
              {profileData.nome_de_usuario || 'NeoBoladão'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <div className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 p-3 text-gray-400 shadow-sm sm:text-lg cursor-target">
              {profileData.email || 'NeoRedpill@outlook.com'}
            </div>
          </div>
          
          {/* Botão de salvar e mensagens de status foram removidos */}
        </div>
      </div>
    </div>
  );
}

export default ProfileScreen;
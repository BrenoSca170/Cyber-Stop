// src/pages/AuthScreen.jsx - REFATORADO PARA USAR O BACKEND NODE.JS

import { useState, useEffect, useRef } from 'react';
// Importamos o cliente de API correto (o mesmo da Loja)
import api from '../lib/api';
import { useNavigate } from 'react-router-dom';


function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Estado extra para o cadastro
  const [nomeDeUsuario, setNomeDeUsuario] = useState('');

  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState('');

  const navigate = useNavigate();

  // Ref para o áudio de fundo
  const audioRef = useRef(null);

  // Inicializa o áudio de fundo quando o componente monta
  useEffect(() => {
    // Cria elemento de áudio
    const audio = new Audio('/login-music.mp3');
    audio.loop = true; // Loop infinito
    audio.volume = 0.5; // Volume 50%
    audioRef.current = audio;

    // Tenta tocar automaticamente
    const playAudio = async () => {
      try {
        await audio.play();
        console.log('[AuthScreen] Música de fundo iniciada');
      } catch (error) {
        console.log('[AuthScreen] Autoplay bloqueado pelo navegador. Clique na página para iniciar a música.', error);
        // Se o autoplay for bloqueado, tenta tocar no primeiro clique do usuário
        const handleFirstClick = async () => {
          try {
            await audio.play();
            console.log('[AuthScreen] Música iniciada após interação do usuário');
            document.removeEventListener('click', handleFirstClick);
          } catch (err) {
            console.error('[AuthScreen] Erro ao tocar música:', err);
          }
        };
        document.addEventListener('click', handleFirstClick);
      }
    };

    playAudio();

    // Cleanup: para a música quando sair da tela de login
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);

  const handleAuth = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isLogin) {
        // --- LÓGICA DE LOGIN COM O BACKEND NODE.JS ---
        // Rota: /auth/login
        const response = await api.post('/auth/login', {
          email,
          password,
        });
        
        // Salva o token recebido (o backend node retorna 'token')
        //
        localStorage.setItem('token', response.data.token); 
        
        // Força recarregamento ou redireciona
        window.location.reload();
        // navigate('/home'); // Alternativa

      } else {
        // --- LÓGICA DE CADASTRO COM O BACKEND NODE.JS ---
        // Rota: /auth/register
        // Precisa de: email, password, nome_de_usuario
        await api.post('/auth/register', {
          email,
          password,
          nome_de_usuario: nomeDeUsuario, // Usando o novo estado
        });

        setMessage('Cadastro realizado! Agora você pode fazer o login.');
        setIsLogin(true); // Muda para a tela de login após o cadastro
        setNomeDeUsuario(''); // Limpa o campo
      }
    } catch (error) {
      // Pega a mensagem de erro da resposta da API
      const errorMessage = error.response?.data?.error || error.message;
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center">
          {isLogin ? 'Login' : 'Crie sua Conta'}
        </h1>
        <form onSubmit={handleAuth} className="space-y-6">
          
          {/* Campo de Nome de Usuário (só aparece no cadastro) */}
          {!isLogin && (
            <input
              type="text"
              placeholder="Seu nome de usuário"
              value={nomeDeUsuario}
              required
              onChange={(e) => setNomeDeUsuario(e.target.value)}
              className="w-full px-4 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          <input
            type="email"
            placeholder="Seu email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Sua senha"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-500"
          >
            {loading ? 'Carregando...' : (isLogin ? 'Entrar' : 'Cadastrar')}
          </button>
        </form>
        <div className="text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-blue-400 hover:underline"
          >
            {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Faça login'}
          </button>
        </div>
        {message && <p className="mt-4 text-center text-red-400">{message}</p>}
      </div>
    </div>
  );
}

export default AuthScreen;
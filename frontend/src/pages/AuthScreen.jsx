// src/pages/AuthScreen.jsx - REFATORADO

import { useState } from 'react';
// Importamos nosso novo cliente de API
import apiClient from '../apiClient'; 
// A função `useNavigate` pode ser útil para redirecionar após o login
import { useNavigate } from 'react-router-dom';


function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState('');
  
  // O useNavigate não é estritamente necessário aqui, pois o App.jsx
  // vai detectar a mudança, mas é bom tê-lo.
  const navigate = useNavigate();

  const handleAuth = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isLogin) {
        // --- LÓGICA DE LOGIN COM A API FLASK ---
        const response = await apiClient.post('/auth/sign_in', {
          email,
          password,
        });
        
        // Salva o token recebido do backend no localStorage
        localStorage.setItem('authToken', response.data.access_token);
        
        // Força um recarregamento da página para que o App.jsx detecte o token
        // e mude o estado para logado.
        window.location.reload();

      } else {
        // --- LÓGICA DE CADASTRO COM A API FLASK ---
        await apiClient.post('/auth/sign_up', {
          email,
          password,
        });

        setMessage('Cadastro realizado! Agora você pode fazer o login.');
        setIsLogin(true); // Muda para a tela de login após o cadastro
      }
    } catch (error) {
      // Pega a mensagem de erro da resposta da API
      const errorMessage = error.response?.data?.error || error.message;
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // O JSX (a parte visual) continua exatamente o mesmo
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center">
          {isLogin ? 'Login' : 'Crie sua Conta'}
        </h1>
        <form onSubmit={handleAuth} className="space-y-6">
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
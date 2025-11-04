// frontend/src/components/Header.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Home, User, CircleDollarSign, LogOut } from 'lucide-react';
import CyberLogo from './CyberLogo';
import api from '../lib/api';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation(); // 👈 usado para saber a rota atual

  const [moedas, setMoedas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [username] = useState('NetRunner_01');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/shop/inventory');
      setMoedas(response.data?.moedas || 0);
    } catch (err) {
      console.error('Erro ao buscar saldo do inventário:', err);
      setError('Não foi possível carregar o saldo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    navigate('/login');
  };

  // 👇 Se o usuário estiver na tela da loja, ocultar moedas
  const isOnShopScreen = location.pathname === '/shop';

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-bg-secondary/90 backdrop-blur-sm text-white font-cyber"
      data-augmented-ui="br-clip bl-clip border"
    >
      <nav className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between">

        {/* Lado Esquerdo: Logo e Navegação */}
        <div className="flex items-center gap-4">
          <Link to="/" className="w-10 h-10 cursor-target" title="Voltar ao Início">
            <CyberLogo />
          </Link>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/"
              className={`flex items-center gap-2 px-3 py-2 text-text-muted hover:text-accent transition-colors rounded cursor-target ${
                location.pathname === '/' ? 'text-accent' : ''
              }`}
              title="Início"
            >
              <Home size={18} />
              <span className="text-sm font-semibold">Início</span>
            </Link>
          </div>
        </div>

        {/* Lado Direito: Moedas, Perfil e Logout */}
        <div className="flex items-center gap-3">
          
          {/* 🔹 Exibir moedas somente fora da página /shop */}
          {!isOnShopScreen && (
            <div
              className="flex items-center gap-2 bg-bg-input px-3 py-2 rounded cursor-target"
              data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
              title="Suas Moedas"
              onClick={() => navigate('/shop')}
            >
              <CircleDollarSign size={20} className="text-warning" />
              <span className="text-lg font-bold text-warning tabular-nums">
                {loading ? '...' : moedas.toLocaleString('pt-BR')}
              </span>
            </div>
          )}

          {/* Perfil */}
          <button
            onClick={() => navigate('/profile')}
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-accent/20 text-accent rounded-full border border-accent/50 hover:bg-accent/40 transition-colors cursor-target"
            title={`Perfil: ${username}`}
          >
            <User size={20} />
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-primary/20 text-primary rounded-full border border-primary/50 hover:bg-primary/40 transition-colors cursor-target"
            title="Desconectar"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>
    </header>
  );
}

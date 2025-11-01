// frontend/src/components/Header.jsx
import { Link, useNavigate } from 'react-router-dom';
import { Home, Store, User, CircleDollarSign, LogOut } from 'lucide-react';
import CyberLogo from './CyberLogo'; 

export default function Header() {
  const navigate = useNavigate();

  // Mock de dados do usuário (você pode substituir isso por um hook de autenticação/contexto)
  const userData = {
    coins: 1250,
    username: 'NetRunner_01',
  };

  const navItems = [
    { icon: Home, label: 'Início', path: '/' },
  ];

  // 2. Criar a função de Logout
  const handleLogout = () => {
    // Limpa os dados de autenticação/sessão
    localStorage.clear();
    sessionStorage.clear();
    
    // 3. CORREÇÃO: Redireciona para /login (baseado no seu arquivo Login.jsx)
    // A rota anterior era '/auth', que poderia não estar configurada.
    navigate('/login'); 
  };

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-50 h-[72px] bg-bg-secondary/90 backdrop-blur-sm text-white font-cyber"
      data-augmented-ui="br-clip bl-clip border" // Estilo cyber na borda inferior
    >
      <nav className="max-w-7xl mx-auto h-full px-4 flex items-center justify-between">
        
        {/* Lado Esquerdo: Logo e Links Principais */}
        <div className="flex items-center gap-4">
          {/* Logo Clicável */}
          <Link to="/" className="w-10 h-10 cursor-target" title="Voltar ao Início">
            <CyberLogo />
          </Link>
          
          {/* Links de Navegação */}
          <div className="hidden md:flex items-center gap-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-2 px-3 py-2 text-text-muted hover:text-accent transition-colors rounded cursor-target"
                title={item.label}
              >
                <item.icon size={18} />
                <span className="text-sm font-semibold">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Lado Direito: Moedas, Perfil e Sair */}
        <div className="flex items-center gap-3"> 
          {/* Moedas */}
          <div 
            className="flex items-center gap-2 bg-bg-input px-3 py-2 rounded cursor-target"
            data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
            title="Suas Moedas"
            onClick={() => navigate('/shop')} // Atalho para a loja
          >
            <CircleDollarSign size={20} className="text-warning" />
            <span className="text-lg font-bold text-warning tabular-nums">
              {userData.coins.toLocaleString('pt-BR')}
            </span>
          </div>

          {/* Perfil */}
          <button 
            onClick={() => navigate('/profile')} // Atalho para o perfil
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-accent/20 text-accent rounded-full border border-accent/50 hover:bg-accent/40 transition-colors cursor-target"
            title={`Perfil: ${userData.username}`}
          >
            <User size={20} />
          </button>
          
          {/* Botão de Sair (Logout) */}
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

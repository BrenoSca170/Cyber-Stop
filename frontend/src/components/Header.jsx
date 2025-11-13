// fronted/src/components/Header.jsx
import { useState, useEffect } from 'react'; // (NOVO) Importar useState e useEffect
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Gem, User, LogOut, Store } from 'lucide-react';
import { avatarList } from '../lib/avatarList';
import api from '../lib/api'; // (NOVO) Importar a API
import socket from '../lib/socket'; // (NOVO) Importar o socket
import { useExitConfirmation } from '../hooks/useExitConfirmation';
import ExitConfirmationModal from './ExitConfirmationModal';

// (NOVO) Hook simples para pegar dados do usuário
// Como não há Contexto, cada componente que precisa do usuário busca por si
function useUserData() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.jogador);
      } catch (error) {
        console.error("Erro ao buscar dados do usuário:", error);
        // (Opcional) deslogar se o token for inválido
        // localStorage.removeItem('token');
        // window.location.href = '/'; 
      } finally {
        setLoading(false);
      }
    };
    
    // Só busca se houver um token
    if (localStorage.getItem('token')) {
        fetchUser();
    } else {
        setLoading(false);
    }
  }, []);

  return { user, loading };
}


export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: userLoading } = useUserData(); // (NOVO) Busca dados do usuário
  const [moedas, setMoedas] = useState(0); // (NOVO) Estado local para moedas

  // Detecta se está em uma sala ou partida
  const isWaitingRoom = location.pathname.startsWith('/waiting/');
  const isGameScreen = location.pathname.startsWith('/game/');
  
  // Extrai o salaId da URL diretamente (ex: /waiting/123 ou /game/123)
  let salaId = null;
  if (isWaitingRoom || isGameScreen) {
    const match = location.pathname.match(/\/(?:waiting|game)\/(\d+)/);
    salaId = match ? match[1] : null;
  }
  
  const matchStarted = isGameScreen; // Se está na tela de jogo, a partida já começou

  // Hook de confirmação de saída - só ativo se estiver em sala/partida
  const { 
    showModal, 
    confirmExit, 
    cancelExit, 
    handleExitClick,
    exitConfirmed
  } = useExitConfirmation(salaId, matchStarted);

  // (NOVO) Efeito para buscar e atualizar o saldo de moedas
  useEffect(() => {
    // 1. Função para buscar o saldo
    const fetchMoedas = async () => {
      try {
        const { data } = await api.get('/shop/inventory');
        setMoedas(data?.moedas || 0);
      } catch (error) {
        console.error("Header: Erro ao buscar saldo de moedas:", error);
        setMoedas(0);
      }
    };

    // 2. Busca o saldo inicial
    fetchMoedas();

    // 3. Ouve por atualizações (quando usa power-up)
    const onInventoryUpdate = () => {
      console.log("Header: 'inventory:updated' recebido. Buscando novo saldo.");
      fetchMoedas();
    };
    
    socket.on('inventory:updated', onInventoryUpdate);

    // 4. Limpa o listener ao sair
    return () => {
      socket.off('inventory:updated', onInventoryUpdate);
    };
  }, []); // Roda apenas uma vez


  // Função de logout que será interceptada se estiver em sala/partida
  const performLogout = () => {
    // Desconecta o socket primeiro
    if (socket.connected) {
      socket.disconnect();
    }
    
    // Limpa todos os dados de autenticação
    localStorage.removeItem('token');
    localStorage.removeItem('meuJogadorId');
    sessionStorage.removeItem('meuJogadorId');
    
    // Remove o header de autorização da API
    delete api.defaults.headers.common['Authorization'];
    
    // Navega diretamente para a página de login (replace: true evita voltar com back button)
    navigate('/login', { replace: true });
  };

  // Wrapper para o handleLogout que intercepta se estiver em sala/partida
  const handleLogout = (e) => {
    // Previne qualquer ação padrão
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Se estiver em sala/partida, intercepta e mostra o modal
    // Caso contrário, executa o logout diretamente
    if (salaId) {
      // Se há salaId, sempre intercepta usando o hook
      handleExitClick(() => {
        performLogout();
      });
    } else {
      // Se não há salaId, executa o logout diretamente
      performLogout();
    }
  };

  // Wrapper para confirmExit - o hook já executa a ação pendente (performLogout) após sair da sala
  const handleConfirmExit = async () => {
    // O confirmExit já vai executar a ação pendente (performLogout) após sair da sala
    // Não precisamos chamar performLogout novamente aqui
    await confirmExit();
  };

  // Enquanto busca o usuário, pode mostrar um estado simplificado
  if (userLoading) {
    return (
      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-black/30 backdrop-blur-sm border-b border-primary/20">
         <Link to="/" className="text-2xl font-bold text-primary hover:text-accent transition-colors font-cyber" title="Voltar à Tela Inicial">
            CYBER-STOP
         </Link>
         {/* Não mostra nada enquanto carrega */}
      </header>
    );
  }
  
  // Se não houver usuário (ex: tela de login), não mostra nada
  if (!user) {
    return null;
  }

  // (ATUALIZADO) Pega o avatar do usuário
  const userAvatar = avatarList.find(avatar => avatar.nome === user?.avatar_nome) || avatarList[0];

  return (
    <>
      {/* Modal de confirmação de saída - só aparece se estiver em sala/partida */}
      {salaId && (
        <ExitConfirmationModal 
          isOpen={showModal}
          onConfirm={handleConfirmExit}
          onCancel={cancelExit}
        />
      )}

      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-black/30 backdrop-blur-sm border-b border-primary/20">
        {/* Logo ou Nome do Jogo */}
        <Link to="/" className="text-2xl font-bold text-primary hover:text-accent transition-colors font-cyber cursor-target" title="Voltar à Tela Inicial">
          CYBER-STOP
        </Link>

      {/* Informações do Usuário e Moedas */}
      <div className="flex items-center gap-4">
        {/* Link da Loja */}
        <button
          onClick={() => navigate('/shop')}
          className="text-text-muted hover:text-secondary transition-colors flex items-center gap-2 cursor-target"
          title="Loja"
        >
          <Store size={20} />
          <span className="hidden md:inline">Loja</span>
        </button>

        {/* Saldo de Moedas (ATUALIZADO) */}
        <div className="bg-bg-secondary border border-warning/50 rounded px-3 py-1.5 flex items-center gap-2" title="Seu Saldo">
          <span className="text-lg font-semibold text-warning">{moedas}</span>
          <Gem size={18} className="text-warning" />
        </div>

        {/* Perfil do Usuário */}
        <div className="flex items-center gap-2">
          <img
            src={userAvatar.src}
            alt="Avatar"
            className="h-10 w-10 rounded-full border-2 border-primary/50 object-cover"
          />
          <div className="hidden md:flex flex-col text-left">
            <span className="text-sm font-semibold text-white">{user?.nome_de_usuario || 'Jogador'}</span>
            <Link to="/profile" className="text-xs text-text-muted hover:text-primary cursor-target">
              Ver Perfil
            </Link>
          </div>
        </div>

        {/* Botão de Logout */}
        <button
          onClick={handleLogout}
          className="bg-red-600/50 hover:bg-red-500/80 text-white p-2 rounded-lg transition-colors cursor-target"
          title="Sair"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
    </>
  );
}
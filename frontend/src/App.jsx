import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useEffect, useRef } from 'react';

// 1. Importar o componente TargetCursor que você criou
import TargetCursor from './components/TargetCursor';
// 2. IMPORTAR O HEADER DE VOLTA
import Header from './components/Header'; // Assumindo que está em /components/Header.jsx

function App() {
  // Ref para o áudio de fundo global
  const audioRef = useRef(null);

  // Inicializa o áudio de fundo quando o app monta
  useEffect(() => {
    // Cria elemento de áudio global
    const audio = new Audio('/login-music.mp3');
    audio.loop = true; // Loop infinito
    audio.volume = 0.5; // Volume 50%
    audioRef.current = audio;

    // Tenta tocar automaticamente
    const playAudio = async () => {
      try {
        await audio.play();
        console.log('[App] Música de fundo iniciada');
      } catch (error) {
        console.log('[App] Autoplay bloqueado. A música iniciará após a primeira interação.', error);
        // Se o autoplay for bloqueado, tenta tocar no primeiro clique/interação
        const handleFirstInteraction = async () => {
          try {
            await audio.play();
            console.log('[App] Música iniciada após interação do usuário');
            // Remove listeners após tocar
            document.removeEventListener('click', handleFirstInteraction);
            document.removeEventListener('keydown', handleFirstInteraction);
          } catch (err) {
            console.error('[App] Erro ao tocar música:', err);
          }
        };
        document.addEventListener('click', handleFirstInteraction);
        document.addEventListener('keydown', handleFirstInteraction);
      }
    };

    playAudio();

    // Cleanup: para a música quando o app desmonta (não acontece normalmente)
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, []);
  return (
    <>
      {/* Componente do Cursor */}
      <TargetCursor 
        spinDuration={2}
        hideDefaultCursor={true}
      />

      {/* Componente para mostrar notificações (sonner) */}
      <Toaster 
        position="top-center" 
        richColors 
        theme="dark"
        toastOptions={{
          style: { 
            fontFamily: '"Rajdhani", sans-serif', 
            border: '1px solid #444',
            background: '#1a1a1a',
            color: '#eee',
          },
        }}
      />
      
      {/* 3. ADICIONAR O HEADER AQUI */}
      {/* Ele ficará fixo no topo de todas as páginas */}
      <Header />

      {/* O 'main' agora tem o padding-top (pt-[72px]) 
          para não ficar escondido atrás do Header */}
      <main className="pt-[72px] min-h-screen">
        {/* O Outlet renderiza as páginas (Home, Lobby, etc.) */}
        <Outlet /> 
      </main>
    </>
  );
}

export default App;

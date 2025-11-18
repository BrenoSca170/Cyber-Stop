import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';

// 1. Importar o componente TargetCursor que você criou
import TargetCursor from './components/TargetCursor';
// 2. IMPORTAR O HEADER DE VOLTA
import Header from './components/Header'; // Assumindo que está em /components/Header.jsx

// --- Audio Singleton ---
// Create a single audio instance for the entire application
const backgroundMusic = new Audio('/login-music.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.04;

// Flag to ensure we only attach the interaction listener once
let hasAttachedInteractionListener = false;

const playAudio = async () => {
  // If it's already playing, don't do anything
  if (backgroundMusic.currentTime > 0 && !backgroundMusic.paused) {
    return;
  }
  
  try {
    await backgroundMusic.play();
    console.log('[App] Música de fundo iniciada');
  } catch (error) {
    console.log('[App] Autoplay bloqueado. A música iniciará após a primeira interação.', error);
    
    if (!hasAttachedInteractionListener) {
      hasAttachedInteractionListener = true;
      const handleFirstInteraction = async () => {
        try {
          await backgroundMusic.play();
          console.log('[App] Música iniciada após interação do usuário');
          // Remove listeners after the first successful play
          document.removeEventListener('click', handleFirstInteraction);
          document.removeEventListener('keydown', handleFirstInteraction);
        } catch (err) {
          console.error('[App] Erro ao tocar música após interação:', err);
        }
      };
      
      document.addEventListener('click', handleFirstInteraction);
      document.addEventListener('keydown', handleFirstInteraction);
    }
  }
};
// --- End Audio Singleton ---


function App() {
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = () => {
    // We now just toggle the state. The effect will handle the volume.
    setIsMuted(prev => !prev);
  };

  // This effect runs only once per application lifecycle to start the music.
  useEffect(() => {
    playAudio();
  }, []);

  // This effect toggles the volume based on the isMuted state.
  useEffect(() => {
    backgroundMusic.volume = isMuted ? 0 : 0.04;
  }, [isMuted]);

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
      <Header isMuted={isMuted} toggleMute={toggleMute} />

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

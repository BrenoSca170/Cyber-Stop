import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';

import TargetCursor from './components/TargetCursor';
import Header from './components/Header';
import { setVolume as setAudioVolume, stopAudio } from './lib/audio'; // Import and rename audio controls

function App() {
  const location = useLocation();
  const [volume, setVolume] = useState(0.04); // Default volume

  const isGameScreen = location.pathname.startsWith('/game/');
  const isWaitingRoom = location.pathname.startsWith('/waiting/');

  const handleVolumeChange = (newVolume) => {
    setVolume(parseFloat(newVolume));
  };

  // This effect runs when App unmounts (e.g., on logout) to stop the music
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  // This effect updates the volume based on the volume state.
  useEffect(() => {
    setAudioVolume(volume);
  }, [volume]);

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
      
      {!isGameScreen && !isWaitingRoom && <Header volume={volume} onVolumeChange={handleVolumeChange} />}

      {/* O 'main' agora tem o padding-top (pt-[72px]) 
          para não ficar escondido atrás do Header */}
      <main className={!isGameScreen && !isWaitingRoom ? "pt-[72px] min-h-screen" : "min-h-screen"}>
        {/* O Outlet renderiza as páginas (Home, Lobby, etc.) */}
        <Outlet /> 
      </main>
    </>
  );
}

export default App;

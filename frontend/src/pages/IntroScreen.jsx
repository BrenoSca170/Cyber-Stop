import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';

export default function IntroScreen() {
  const navigate = useNavigate();
  const [isMuted, setIsMuted] = useState(false);

  const handleVideoEnd = () => {
    navigate('/');
  };

  const handleSkip = () => {
    navigate('/');
  };

  // Optional: Preload the home screen assets in the background
  useEffect(() => {
    // You can add logic here to preload images or data for the home screen
  }, []);

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center">
      <video
        src="/video/introvideo.mp4"
        autoPlay
        muted={isMuted}
        playsInline
        onEnded={handleVideoEnd}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-8 right-8 flex items-center gap-4">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="bg-white/10 backdrop-blur-md text-white p-3 rounded-full border border-white/20 hover:bg-white/20 transition-colors z-10"
          title={isMuted ? 'Ativar som' : 'Desativar som'}
        >
          {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </button>
        <button
          onClick={handleSkip}
          className="bg-white/10 backdrop-blur-md text-white font-semibold py-3 px-6 rounded-lg border border-white/20 hover:bg-white/20 transition-colors z-10"
        >
          Pular
        </button>
      </div>
    </div>
  );
}

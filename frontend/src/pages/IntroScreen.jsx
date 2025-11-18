import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function IntroScreen() {
  const navigate = useNavigate();

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
        muted
        playsInline
        onEnded={handleVideoEnd}
        className="w-full h-full object-cover"
      />
      <button
        onClick={handleSkip}
        className="absolute bottom-8 right-8 bg-white/10 backdrop-blur-md text-white font-semibold py-2 px-6 rounded-lg border border-white/20 hover:bg-white/20 transition-colors z-10"
      >
        Pular
      </button>
    </div>
  );
}

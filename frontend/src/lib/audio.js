// frontend/src/lib/audio.js

const backgroundMusic = new Audio('/login-music.mp3');
backgroundMusic.loop = true;
backgroundMusic.volume = 0.1;

let hasAttachedInteractionListener = false;

export const playAudio = async () => {
  if (backgroundMusic.currentTime > 0 && !backgroundMusic.paused) {
    return;
  }
  
  try {
    await backgroundMusic.play();
    console.log('[Audio] Música de fundo iniciada');
  } catch (error) {
    console.log('[Audio] Autoplay bloqueado. A música iniciará após a primeira interação.', error);
    
    if (!hasAttachedInteractionListener) {
      hasAttachedInteractionListener = true;
      const handleFirstInteraction = async () => {
        try {
          await backgroundMusic.play();
          console.log('[Audio] Música iniciada após interação do usuário');
          document.removeEventListener('click', handleFirstInteraction);
          document.removeEventListener('keydown', handleFirstInteraction);
        } catch (err) {
          console.error('[Audio] Erro ao tocar música após interação:', err);
        }
      };
      
      document.addEventListener('click', handleFirstInteraction);
      document.addEventListener('keydown', handleFirstInteraction);
    }
  }
};

export const stopAudio = () => {
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  console.log('[Audio] Música de fundo parada.');
};

export const setVolume = (volume) => {
  if (volume >= 0 && volume <= 1) {
    backgroundMusic.volume = volume;
  }
};

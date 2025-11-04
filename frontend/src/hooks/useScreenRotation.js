import { useEffect, useRef } from "react";

/**
 * Hook para aplicar rotações e inversões de tela temporárias.
 * É usado quando o jogador recebe o power-up de "inverter a tela".
 */
export function useScreenRotation() {
  const timeoutRef = useRef(null);

  // Tipos de rotação possíveis
  const rotations = ['upsideDown', 'left', 'right', 'mirror', 'flip'];

  // Aplica a rotação/transformação na tela
  const setScreenRotation = (rotation = 'none') => {
    const root = document.documentElement;
    root.style.transition = 'transform 0.5s ease';
    root.style.transformOrigin = 'center center';

    switch (rotation) {
      case 'upsideDown':
        root.style.transform = 'rotate(180deg)';
        break;
      case 'left':
        root.style.transform = 'rotate(-90deg)';
        break;
      case 'right':
        root.style.transform = 'rotate(90deg)';
        break;
      case 'mirror':
        root.style.transform = 'scaleX(-1)';
        break;
      case 'flip':
        root.style.transform = 'scaleY(-1)';
        break;
      default:
        root.style.transform = 'none';
        break;
    }
  };

  /**
   * Aplica uma rotação aleatória da lista por um tempo limitado
   * @param {number} duration - duração do efeito em ms (ex: 5000 = 5s)
   */
  const applyRandomRotation = (duration = 5000) => {
    // Escolhe uma transformação aleatória
    const randomRotation = rotations[Math.floor(Math.random() * rotations.length)];
    console.log(`🎲 Efeito de rotação aplicado: ${randomRotation}`);

    // Aplica a rotação
    setScreenRotation(randomRotation);

    // Cancela qualquer rotação anterior pendente
    clearTimeout(timeoutRef.current);

    // Agenda para reverter ao normal após a duração
    timeoutRef.current = setTimeout(() => {
      console.log('↩️ Revertendo rotação para normal');
      setScreenRotation('none');
    }, duration);
  };

  // Limpa o efeito quando o componente desmontar
  useEffect(() => {
    return () => {
      clearTimeout(timeoutRef.current);
      setScreenRotation('none');
    };
  }, []);

  return { applyRandomRotation, setScreenRotation };
}

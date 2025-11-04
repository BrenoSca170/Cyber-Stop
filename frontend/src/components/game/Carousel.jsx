// fronted/src/components/game/Carousel.jsx
import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

// Importe o CSS
import './Carousel.css';

const GAP = 16;
const SPRING_OPTIONS = { type: 'spring', stiffness: 300, damping: 30 };
const DRAG_BUFFER = 0;
const VELOCITY_THRESHOLD = 500;

export default function Carousel({
  items, // Os itens originais (com powerUpData)
  baseWidth,
  round = false,
  loop: propLoop, // Permitir que o loop seja passado como prop
  onSelectionChange, // Callback para informar o pai
}) {
  
  // --- LÓGICA MOVIDA DE VOLTA DO ActiveRound ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const x = useMotionValue(0);

  const containerPadding = 16;
  const itemWidth = baseWidth - containerPadding * 2;
  const trackItemOffset = itemWidth + GAP;

  const carouselItems = items || [];
  const loop = propLoop !== undefined ? propLoop : carouselItems.length > 2;
  // NOTA: A lógica de clonagem para o loop infinito não está aqui, 
  // mas o drag/snap funciona.

  // Handler de Drag (lógica interna)
  const handleDragEnd = (_, info) => {
    if (isResetting) return;

    const offset = info.offset.x;
    const velocity = info.velocity.x;
    const itemsLength = carouselItems.length;

    if (offset < -DRAG_BUFFER || velocity < -VELOCITY_THRESHOLD) {
      // Arrastou para a esquerda (próximo item)
      setCurrentIndex((prev) => Math.min(prev + 1, itemsLength - 1));
    } else if (offset > DRAG_BUFFER || velocity > VELOCITY_THRESHOLD) {
      // Arrastou para a direita (item anterior)
      setCurrentIndex((prev) => Math.max(prev - 1, 0));
    } else {
      // Snap back (o useEffect abaixo cuida disso)
    }
  };

  // Efeito para animar o 'x' quando o 'currentIndex' mudar
  useEffect(() => {
    const effectiveTransition = isResetting ? { duration: 0 } : SPRING_OPTIONS;
    
    const animation = animate(x, -(currentIndex * trackItemOffset), {
        ...effectiveTransition,
        onComplete: () => {
            // Lógica de Loop (se necessário)
        }
    });

    return () => animation.stop();
  }, [currentIndex, isResetting, x, trackItemOffset]);

  // === [NOVO] Efeito para informar o Pai (ActiveRound) sobre a mudança ===
  useEffect(() => {
    if (onSelectionChange && carouselItems[currentIndex]) {
      // Passa o objeto powerUpData do item selecionado
      onSelectionChange(carouselItems[currentIndex].powerUpData);
    }
  }, [currentIndex, carouselItems, onSelectionChange]);
  // --- FIM DA LÓGICA MOVIDA ---


  const displayItems = carouselItems;
  const indicatorItems = carouselItems;

  return (
    <div
      className={`carousel-container ${round ? 'round' : ''}`}
      style={{
        width: `${baseWidth}px`,
        ...(round && { height: `${baseWidth}px`, borderRadius: '50%' }),
      }}
    >
      <motion.div
        className="carousel-track"
        // === [ALTERADO] Drag e animação agora são internos ===
        drag="x"
        onDragEnd={handleDragEnd}
        dragConstraints={{
            left: -trackItemOffset * (carouselItems.length - 1),
            right: 0
        }}
        dragElastic={0.1}
        style={{
          x, // Usa o 'x' interno
          width: itemWidth,
          gap: `${GAP}px`,
          perspective: 1000,
          perspectiveOrigin: `${
            currentIndex * trackItemOffset + itemWidth / 2
          }px 50%`,
        }}
      >
        {displayItems.map((item, index) => {
          const range = [
            -(index + 1) * trackItemOffset,
            -index * trackItemOffset,
            -(index - 1) * trackItemOffset,
          ];
          const outputRange = [90, 0, -90];
          // eslint-disable-next-line react-hooks/rules-of-hooks
          const rotateY = useTransform(x, range, outputRange, { clamp: false });
          
          return (
            <motion.div
              key={item.id || index} // Usa o ID do item
              className={`carousel-item ${round ? 'round' : ''}`}
              style={{
                width: itemWidth,
                height: round ? itemWidth : '100%',
                rotateY: rotateY,
                ...(round && { borderRadius: '50%' }),
                justifyContent: 'center', 
                textAlign: 'center',
              }}
              transition={SPRING_OPTIONS}
            >
              <div className={`carousel-item-header ${round ? 'round' : ''}`}>
                <span className="carousel-icon-container" style={{ margin: '0 auto' }}>
                  {item.icon}
                </span>
                <div className="carousel-item-title" style={{ marginTop: '12px' }}>
                  {item.title}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
      
      {/* Indicadores (bolinhas) */}
      <div className={`carousel-indicators-container ${round ? 'round' : ''}`}>
        <div className="carousel-indicators">
          {indicatorItems.map((_, index) => (
            <motion.div
              key={index}
              className={`carousel-indicator ${
                currentIndex % indicatorItems.length === index ? 'active' : 'inactive'
              }`}
              animate={{
                scale: currentIndex % indicatorItems.length === index ? 1.2 : 1,
              }}
              // === [ALTERADO] Usa o setCurrentIndex interno ===
              onClick={() => setCurrentIndex(index)} 
              transition={{ duration: 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
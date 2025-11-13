import { useEffect, useRef } from 'react';

const MatrixRain = ({
  color = '#00ffee',
  fontSize = 14,
  fadeOpacity = 0.05,
  speed = 40,
  characters = 'アァイゥエカキクゲゴサザシジスセタチツナニハヒフホマミムメヤユヨラリルレロワンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@',
  className = ''
}) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const dropsRef = useRef([]);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chars = characters.split('');

    // Set canvas size to match display size
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      ctx.scale(dpr, dpr);

      // Recalculate columns and drops
      const columns = Math.floor(rect.width / fontSize);
      dropsRef.current = Array(columns).fill(1).map(() => Math.random() * -100);
    };

    // Initial resize
    resizeCanvas();

    // Animation function using requestAnimationFrame
    const draw = (currentTime) => {
      // Throttle to target frame rate (based on speed prop)
      if (currentTime - lastTimeRef.current < speed) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      lastTimeRef.current = currentTime;

      const rect = canvas.getBoundingClientRect();

      // Create fade effect
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeOpacity})`;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Draw characters
      ctx.fillStyle = color;
      ctx.font = `${fontSize}px monospace`;

      const columns = dropsRef.current.length;

      for (let i = 0; i < columns; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = dropsRef.current[i] * fontSize;

        ctx.fillText(text, x, y);

        // Reset drop to top randomly or when it goes off screen
        if (y > rect.height && Math.random() > 0.975) {
          dropsRef.current[i] = 0;
        }

        dropsRef.current[i]++;
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    // Start animation
    animationFrameRef.current = requestAnimationFrame(draw);

    // Handle window resize
    const handleResize = () => {
      resizeCanvas();
    };

    window.addEventListener('resize', handleResize);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [color, fontSize, fadeOpacity, speed, characters]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none ${className}`}
      style={{
        width: '100%',
        height: '100%',
        zIndex: 0
      }}
      aria-hidden="true"
    />
  );
};

export default MatrixRain;

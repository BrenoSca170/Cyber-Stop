// Importamos o 'motion' para a animação
import { motion } from 'framer-motion';

function TimeUpOverlay() {
  return (
    <motion.div
      // Estado inicial da animação (acima da tela, invisível)
      initial={{ y: '-100vh', opacity: 0 }}
      // Estado final da animação (no centro da tela, visível)
      animate={{ y: 0, opacity: 1 }}
      // Configurações da animação (tipo mola, rigidez, amortecimento)
      transition={{ type: 'spring', stiffness: 50, damping: 15 }}
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/80"
    >
      <h1 className="text-9xl font-extrabold text-white drop-shadow-lg">
        STOP!
      </h1>
    </motion.div>
  );
}

export default TimeUpOverlay;
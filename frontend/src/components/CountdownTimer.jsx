import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

// Adicionamos a prop 'onTimeUp' para avisar o pai quando o tempo acabar
function CountdownTimer({ initialTime = 60, onTimeUp }) {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    // Se o tempo chegou a 0, não faz mais nada e avisa o pai
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    // Cria um intervalo que roda a cada 1 segundo
    const intervalId = setInterval(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    // Função de limpeza: O React roda isso quando o componente é "desmontado"
    // para evitar vazamentos de memória.
    return () => clearInterval(intervalId);
  }, [timeLeft, onTimeUp]); // O useEffect roda de novo sempre que 'timeLeft' mudar

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');

  return (
    <div className="flex items-center justify-center gap-2 rounded-lg bg-gray-700 px-4 py-2">
      <Clock className="h-6 w-6 text-yellow-400" />
      <span className="text-2xl font-bold tabular-nums text-yellow-400">
        {minutes}:{seconds}
      </span>
    </div>
  );
}

export default CountdownTimer;
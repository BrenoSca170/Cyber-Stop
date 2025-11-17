import { Clock } from 'lucide-react';

function CountdownTimer({ timeLeft = 0 }) {
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
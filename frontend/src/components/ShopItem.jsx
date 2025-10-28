import { Coins } from 'lucide-react'; // Usaremos o ícone de moedas

function ShopItem({ item, onPurchase, canAfford }) {
  return (
    <div className={`rounded-lg bg-gray-800 p-4 flex flex-col justify-between shadow-lg transition-all ${!canAfford && 'opacity-50'}`}>
      <div>
        <h3 className="text-xl font-bold text-purple-400">{item.name}</h3>
        <p className="text-gray-400 mt-1 text-sm">{item.description}</p>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-yellow-400">
          <Coins className="h-5 w-5" />
          <span className="text-lg font-bold">{item.price}</span>
        </div>
        <button
          onClick={() => onPurchase(item)}
          disabled={!canAfford}
          className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-gray-600"
        >
          Comprar
        </button>
      </div>
    </div>
  );
}

export default ShopItem;
// frontend/src/components/ShopItem.jsx
import { Coins, Loader2 } from 'lucide-react'; // Adicionado Loader2

function ShopItem({ item, onPurchase, canAfford, isPurchasing }) {
  return (
    // Card com augmented-ui, 3D hover e cores do tema
    <div 
      className={`rounded-lg bg-bg-secondary p-4 flex flex-col justify-between shadow-lg 
                  transition-all duration-300 [transform-style:preserve-3d] hover:[transform:translateZ(10px)] 
                  ${!canAfford && !isPurchasing && 'opacity-60 grayscale'}`}
      data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
    >
      <div className="[transform:translateZ(10px)]">
        <h3 className="text-xl font-bold text-primary">{item.name}</h3>
        <p className="text-text-base mt-1 text-sm">{item.description}</p>
      </div>
      <div className="mt-4 flex items-center justify-between [transform:translateZ(10px)]">
        <div className="flex items-center gap-2 text-warning font-mono">
          <Coins className="h-5 w-5" />
          <span className="text-lg font-bold">{item.price}</span>
        </div>
        <button
          onClick={() => onPurchase(item)}
          disabled={!canAfford || isPurchasing}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-black hover:bg-primary/80 
                     disabled:cursor-not-allowed disabled:bg-gray-600
                     [transform-style:preserve-3d] hover:[transform:translateZ(10px)] active:[transform:translateZ(2px)]
                     flex items-center justify-center min-w-[90px] cursor-target"
          data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
        >
          {isPurchasing ? <Loader2 size={18} className="animate-spin" /> : 'Comprar'}
        </button>
      </div>
    </div>
  );
}

export default ShopItem;
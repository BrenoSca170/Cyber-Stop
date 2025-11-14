import React from 'react';
import { Zap } from 'lucide-react';

export default function InventoryItem({ item }) {
  // O backend (shop.js) nos envia 'power_up_id', 'nome', 'descricao', 'quantidade', etc.
  // graças à correção que fizemos.
  const { nome, descricao, quantidade } = item;

  return (
    <div className="bg-gray-900 border border-gray-700 p-4 rounded-lg flex flex-col justify-between text-left h-full shadow-md">
      {/* Detalhes do Item */}
      <div>
        <h3 className="text-md font-bold text-blue-400 mb-2 flex items-center gap-2">
          <Zap size={16} />
          {nome}
        </h3>
        <p className="text-xs text-gray-400 mb-3">{descricao}</p>
      </div>
      
      {/* Quantidade */}
      <div className="mt-auto pt-2 border-t border-gray-600">
        <span className="text-sm font-mono text-white">
          Quantidade: {quantidade}
        </span>
      </div>
    </div>
  );
}
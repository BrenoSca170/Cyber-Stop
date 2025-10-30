// src/pages/HomeScreen.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Store, LogOut } from 'lucide-react'; // Ícones
import CyberLogo from '../components/CyberLogo'; // Importa o componente 3D

export default function HomeScreen() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('meuJogadorId');
    sessionStorage.removeItem('meuJogadorId'); 
    navigate('/login'); 
  };

  return (
    // Aplicando a fonte cyberpunk e perspectiva 3D
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] text-white p-4 font-cyber [perspective:1000px]">
      
      {/* Container para o Logo 3D */}
      <div className="w-full max-w-xs h-48 mb-6">
        <CyberLogo />
      </div>

      <h1 className="text-4xl md:text-5xl font-bold mb-12 text-center text-text-header [transform:translateZ(20px)]">
        Bem-vindo ao STOP:MATRIX
      </h1>

      <div className="space-y-6 w-full max-w-xs [transform-style:preserve-3d]">
        {/* Botão Jogar com augmented-ui e 3D hover */}
        <button
          onClick={() => navigate('/lobby')} 
          className="w-full bg-accent text-black font-bold py-4 px-6 text-xl flex items-center justify-center gap-3 
                     transition-transform duration-300 hover:scale-105 hover:[transform:translateZ(20px)] 
                     shadow-lg shadow-accent/20"
          data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        >
          <Play size={24} />
          Jogar
        </button>

        {/* Botão Loja com augmented-ui e 3D hover */}
        <button
          onClick={() => navigate('/shop')}
          className="w-full bg-primary text-black font-bold py-4 px-6 text-xl flex items-center justify-center gap-3 
                     transition-transform duration-300 hover:scale-105 hover:[transform:translateZ(20px)] 
                     shadow-lg shadow-primary/20"
          data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        >
          <Store size={24} />
          Loja
        </button>
      </div>

       {/* Botão Sair */}
       <button
          onClick={handleLogout}
          className="mt-12 text-text-muted hover:text-primary flex items-center gap-2 transition-colors"
        >
           <LogOut size={18} />
           Desconectar
       </button>
    </div>
  );
}
// src/components/GlitchButton.jsx

import React from 'react';
import './GlitchButton.css'; // Importa o CSS

const GlitchButton = ({ onClick, disabled, children }) => {
  // O 'children' é o texto dentro do botão (ex: "Sortear Avatar")
  const buttonText = children || 'Click Me';

  return (
    <button
      className="glitch-button"
      onClick={onClick}
      disabled={disabled}
      data-text={buttonText} // Passa o texto para os pseudo-elementos
    >
      {buttonText}
    </button>
  );
};

export default GlitchButton;
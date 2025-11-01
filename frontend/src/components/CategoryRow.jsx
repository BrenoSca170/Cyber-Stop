// src/components/CategoryRow.jsx

// Adicionamos a prop 'inputClassName' para podermos passar estilos customizados (como para "pulado")
function CategoryRow({ categoryName, value, onChange, isDisabled, inputClassName = '' }) {
  return (
    <div className="mb-4 flex w-full items-center gap-2 md:gap-4">
      {/* Label com fonte cyber e cor do tema */}
      <label className="w-1/4 text-right text-base md:text-xl font-semibold text-text-muted uppercase">
        {categoryName}:
      </label>
      {/* Input com cores e foco do tema */}
      <input
        type="text"
        value={value} 
        onChange={onChange} 
        disabled={isDisabled} 
        className={`w-3/4 rounded-lg border-2 border-border-color/30 bg-bg-input p-2 text-lg text-accent 
                    font-mono focus:border-primary focus:ring-2 focus:ring-primary/50 focus:outline-none 
                    disabled:cursor-not-allowed disabled:opacity-50
                    ${inputClassName}`} // Adiciona classes extras aqui
      />
    </div>
  );
}

export default CategoryRow;
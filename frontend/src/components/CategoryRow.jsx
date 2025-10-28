// Adicionamos as props: value, onChange e isDisabled
function CategoryRow({ categoryName, value, onChange, isDisabled }) {
  return (
    <div className="mb-4 flex w-full items-center gap-4">
      <label className="w-1/4 text-right text-xl font-semibold text-gray-300">
        {categoryName}:
      </label>
      <input
        type="text"
        value={value} // O valor do input agora é controlado pelo estado do componente pai
        onChange={onChange} // A função do pai é chamada quando o usuário digita
        disabled={isDisabled} // O campo será desabilitado se isDisabled for true
        className="w-3/4 rounded-lg border-2 border-gray-600 bg-gray-700 p-2 text-lg text-white focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

export default CategoryRow;
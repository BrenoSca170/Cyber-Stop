import { Outlet, Link } from 'react-router-dom'

export default function App() {
  return (
    <div className="bg-gray-900 min-h-screen text-white">
      <nav className="bg-gray-800 p-4 flex justify-between items-center">
        <div className="flex gap-4">
          <Link to="/" className="hover:text-blue-400">Lobby</Link>
        </div>
        <button
          onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('meuJogadorId'); location.href='/login' }}
          className="bg-red-600 px-3 py-1 rounded hover:bg-red-700"
        >
          Sair
        </button>
      </nav>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  )
}

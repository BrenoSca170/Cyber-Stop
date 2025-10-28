import { useState } from 'react'
import api from '../lib/api'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const nav = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      if (isLogin) {
        const { data } = await api.post('/auth/login', { email, password })
        localStorage.setItem('token', data.token)
        localStorage.setItem('meuJogadorId', String(data.jogador.jogador_id))
        nav('/')
      } else {
        const { data } = await api.post('/auth/register', { email, password, nome_de_usuario: username })
        localStorage.setItem('token', data.token)
        localStorage.setItem('meuJogadorId', String(data.jogador.jogador_id))
        nav('/')
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-gray-800 p-6 rounded">
        <h2 className="text-2xl font-bold mb-4">{isLogin ? 'Login' : 'Criar conta'}</h2>

        {!isLogin && (
          <input className="w-full p-3 mb-3 bg-gray-700 rounded"
                 placeholder="Nome de usuário"
                 value={username} onChange={(e)=>setUsername(e.target.value)} required />
        )}

        <input className="w-full p-3 mb-3 bg-gray-700 rounded"
               placeholder="Email" type="email"
               value={email} onChange={(e)=>setEmail(e.target.value)} required />

        <input className="w-full p-3 mb-3 bg-gray-700 rounded"
               placeholder="Senha" type="password"
               value={password} onChange={(e)=>setPassword(e.target.value)} required />

        {error && <div className="text-red-400 mb-3">{error}</div>}

        <button disabled={loading} className="w-full bg-blue-600 p-3 rounded mb-2">
          {loading ? 'Aguarde...' : (isLogin ? 'Entrar' : 'Registrar')}
        </button>

        <button type="button" onClick={()=>setIsLogin(!isLogin)} className="text-sm text-gray-300">
          {isLogin ? 'Criar uma conta' : 'Já tenho conta'}
        </button>
      </form>
    </div>
  )
}

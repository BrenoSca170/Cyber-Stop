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
      <div 
      className="min-h-screen flex items-center justify-center bg-bg-primary p-4 font-cyber [perspective:1000px]"
        >
      <form 
        onSubmit={submit} 
        className="w-full max-w-md bg-bg-secondary p-6 transition-transform duration-500 [transform-style:preserve-3d] hover:[transform:rotateY(5deg)]"
        data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
      >
        {/* Adicione [transform:translateZ(20px)] para "levantar" os elementos filhos */}
        <h2 className="text-2xl font-bold mb-4 text-text-header [transform:translateZ(20px)]">
          {isLogin ? 'Conectar ao Grid' : 'Criar Identidade'}
        </h2>
        {!isLogin && (
          <input 
            className="w-full p-3 mb-3 bg-bg-input border border-border-accent/30 focus:outline-none focus:ring-2 focus:ring-border-accent text-accent placeholder-text-muted/70"
            placeholder="Seu Identificador (Nome)"
            value={username} onChange={(e)=>setUsername(e.target.value)} required 
          />
        )}

        <input 
          className="w-full p-3 mb-3 bg-bg-input border border-border-accent/30 focus:outline-none focus:ring-2 focus:ring-border-accent text-accent placeholder-text-muted/70"
           placeholder="Credencial (Email)" type="email"
           value={email} onChange={(e)=>setEmail(e.target.value)} required 
        />

        <input 
          className="w-full p-3 mb-3 bg-bg-input border border-border-accent/30 focus:outline-none focus:ring-2 focus:ring-border-accent text-accent placeholder-text-muted/70"
           placeholder="Chave de Acesso (Senha)" type="password"
           value={password} onChange={(e)=>setPassword(e.target.value)} required 
        />

        {error && <div className="text-red-400 mb-3">{error}</div>}

        {/* Botão com augmented-ui */}
        <button 
          disabled={loading} 
          className="w-full bg-primary text-black font-bold tracking-wider p-3 mb-2 
                     transition-transform duration-150 [transform-style:preserve-3d] 
                     hover:[transform:translateZ(10px)] 
                     active:[transform:translateZ(2px)] 
                     disabled:bg-gray-600"
          data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
        >
          {loading ? 'Processando...' : (isLogin ? 'Acessar' : 'Registrar')}
        </button>

        <button type="button" onClick={()=>setIsLogin(!isLogin)} className="text-sm text-secondary hover:underline">
          {isLogin ? 'Não tem registro? Crie uma identidade' : 'Já está no Grid? Conecte-se'}
        </button>
      </form>
    </div>
  )
}

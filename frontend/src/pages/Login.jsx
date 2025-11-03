// src/pages/Login.jsx
import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useNavigate } from 'react-router-dom'
import FaultyTerminalR3F from '../components/FaultyTerminalR3F'

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const nav = useNavigate()

  // Verifica se o usuário já está logado e redireciona imediatamente
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      nav('/', { replace: true })
    }
  }, [nav])

  // Se já estiver logado, não renderiza o componente
  const token = localStorage.getItem('token')
  if (token) {
    return null // Retorna null para evitar renderização enquanto redireciona
  }

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
    // 1. Container com perspectiva
    <div className="min-h-screen flex items-center justify-center bg-bg-primary text-white p-4 font-cyber [perspective:1000px]">
      <FaultyTerminalR3F className="absolute inset-0 w-full h-full z-0" />
        <div className="absolute z-10 max-w-md mx-auto space-y-4 text-white p-4 font-cyber [perspective:1000px]">
          {/* 2. Formulário com 3D-style e augmented-ui */}
          <form 
            onSubmit={submit} 
            className="w-full max-w-md bg-bg-secondary p-6 transition-transform duration-500 [transform-style:preserve-3d] hover:[transform:rotateY(4deg)]"
            data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
          >
            {/* 3. Filhos com translateZ para "flutuar" */}
            <h2 className="text-2xl font-bold mb-4 text-text-header [transform:translateZ(20px)]">
              {isLogin ? 'Conectar ao Grid' : 'Criar Identidade'}
            </h2>

            {!isLogin && (
              <input 
                className="w-full p-3 mb-3 bg-bg-input rounded border border-border-accent/30 focus:outline-none focus:ring-2 focus:ring-border-accent text-accent placeholder-text-muted/70 [transform:translateZ(20px)]"
                placeholder="Seu Identificador (Nome)"
                value={username} onChange={(e)=>setUsername(e.target.value)} required 
              />
            )}

            <input 
              className="w-full p-3 mb-3 bg-bg-input rounded border border-border-accent/30 focus:outline-none focus:ring-2 focus:ring-border-accent text-accent placeholder-text-muted/70 [transform:translateZ(20px)]"
              placeholder="Credencial (Email)" type="email"
              value={email} onChange={(e)=>setEmail(e.target.value)} required 
            />

            <input 
              className="w-full p-3 mb-3 bg-bg-input rounded border border-border-accent/30 focus:outline-none focus:ring-2 focus:ring-border-accent text-accent placeholder-text-muted/70 [transform:translateZ(20px)]"
              placeholder="Chave de Acesso (Senha)" type="password"
              value={password} onChange={(e)=>setPassword(e.target.value)} required 
            />

            {error && <div className="text-red-400 mb-3 [transform:translateZ(20px)]">{error}</div>}

            {/* 4. Botão com efeito 3D de "pressão" */}
            <button 
              disabled={loading} 
              className="w-full bg-primary text-black font-bold tracking-wider p-3 mb-2 
                        transition-transform duration-150 [transform-style:preserve-3d] 
                        hover:[transform:translateZ(15px)] 
                        active:[transform:translateZ(5px)] 
                        disabled:bg-gray-600 [transform:translateZ(20px)]"
              data-augmented-ui="tl-scoop tr-scoop br-scoop bl-scoop"
            >
              {loading ? 'Processando...' : (isLogin ? 'Acessar' : 'Registrar')}
            </button>

            <button 
              type="button" 
              onClick={()=>setIsLogin(!isLogin)} 
              className="text-sm text-secondary hover:underline [transform:translateZ(20px)]"
            >
              {isLogin ? 'Não tem registro? Crie uma identidade' : 'Já está no Grid? Conecte-se'}
            </button>
          </form>
        </div>
    </div>
  )
}
// src/pages/Login.jsx
import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'
import { useNavigate } from 'react-router-dom'
import FaultyTerminalR3F from '../components/FaultyTerminalR3F'
import { refreshSocketAuth } from '../lib/socket'
import GlitchText from '../components/GlitchText'
import CyberLogo from '../components/CyberLogo'

export default function Login() {
  const [isLogin, setIsLogin] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const nav = useNavigate()

  // redirect se já logado
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      refreshSocketAuth()
      nav('/', { replace: true })
    }
  }, [nav])

  // evita renderizar se já tem token (redirecionando)
  const token = localStorage.getItem('token')
  if (token) return null

  // ---------------------------
  // LOGIN / REGISTER
  // ---------------------------
  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      if (isLogin) {
        const { data } = await api.post('/auth/login', { email, password })
        localStorage.setItem('token', data.token)
        localStorage.setItem('meuJogadorId', String(data.jogador.jogador_id))
        refreshSocketAuth()
        nav('/')
      } else {
        const { data } = await api.post('/auth/register', { email, password, nome_de_usuario: username })
        localStorage.setItem('token', data.token)
        localStorage.setItem('meuJogadorId', String(data.jogador.jogador_id))
        refreshSocketAuth()
        nav('/')
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    } finally {
      setLoading(false)
    }
  }

  // ---------------------------
  // RESET IMEDIATO (sem email/token)
  // ---------------------------
  const resetInputRef = useRef(null)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState('')
  const [resetError, setResetError] = useState('')

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).toLowerCase())

  useEffect(() => {
    if (showResetModal) setTimeout(() => resetInputRef.current?.focus(), 80)
  }, [showResetModal])

  const handleInstantReset = async () => {
    setResetMsg(''); setResetError('')
    if (!resetEmail || !isValidEmail(resetEmail)) {
      setResetError('Informe um email válido.')
      return
    }
    if (!resetPassword || resetPassword.length < 6) {
      setResetError('Senha mínima de 6 caracteres.')
      return
    }
    if (resetLoading) return
    setResetLoading(true)
    try {
      const { data } = await api.post('/auth/instant-reset', {
        email: resetEmail.trim().toLowerCase(),
        newPassword: resetPassword
      })
      setResetMsg(data?.message || 'Se existir uma conta com esse email, a senha foi atualizada.')
      setResetError('')
      setResetEmail('')
      setResetPassword('')
      setTimeout(() => {
        setShowResetModal(false)
        setResetMsg('')
      }, 2000)
    } catch (err) {
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message
      setResetError(serverMsg || err.message || 'Erro ao atualizar senha.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary text-white p-4 font-cyber [perspective:1000px]">
      <FaultyTerminalR3F className="absolute inset-0 w-full h-full z-0" />

      <div className="absolute z-10 flex flex-col items-center justify-center max-w-md mx-auto space-y-4 text-white p-4 font-cyber [perspective:1000px]">
        <form
          onSubmit={submit}
          className="w-full max-w-md bg-bg-secondary p-6 transition-transform duration-500 [transform-style:preserve-3d] hover:[transform:rotateY(4deg)]"
          data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
        >
          <GlitchText text="C://STOP_" fontSize={3} color="rgb(57, 255, 20)" fontWeight="bold" textAlign="center" font="https://fonts.gstatic.com/s/orbitron/v35/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1ny_Cmxpg.ttf" />

          <h2 className="text-2xl font-bold mb-4 text-text-header [transform:translateZ(20px)]">
            {isLogin ? 'Conectar ao Grid' : 'Criar Identidade'}
          </h2>

          {!isLogin && (
            <input
              className="w-full p-3 mb-3 bg-bg-input rounded border border-border-accent/30 focus:outline-none focus:ring-2 focus:ring-border-accent text-accent placeholder-text-muted/70 [transform:translateZ(20px)]"
              placeholder="Seu Identificador (Nome)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          )}

          <input
            className="w-full p-3 mb-3 bg-bg-input rounded border border-border-accent/30 focus:outline-none focus:ring-2 focus:ring-border-accent text-accent placeholder-text-muted/70 [transform:translateZ(20px)]"
            placeholder="Credencial (Email)" type="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required
          />

          <input
            className="w-full p-3 mb-1 bg-bg-input rounded border border-border-accent/30 focus:outline-none focus:ring-2 focus:ring-border-accent text-accent placeholder-text-muted/70 [transform:translateZ(20px)]"
            placeholder="Chave de Acesso (Senha)" type="password"
            value={password} onChange={(e) => setPassword(e.target.value)} required
          />

          {isLogin && (
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="text-xs text-accent hover:underline mb-3 [transform:translateZ(20px)]"
            >
              Esqueceu a senha?
            </button>
          )}

          {error && <div className="text-red-400 mb-3 [transform:translateZ(20px)]">{error}</div>}

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
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-secondary hover:underline [transform:translateZ(20px)]"
          >
            {isLogin ? 'Não tem registro? Crie uma identidade' : 'Já está no Grid? Conecte-se'}
          </button>
        </form>
      </div>

      {/* Modal de Reset Imediato (frontend) */}
      {showResetModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-bg-secondary p-6 rounded-xl w-80 border border-border-accent/40">
            <h3 className="text-xl mb-3 font-bold">Redefinir senha (imediato)</h3>

            <input
              ref={resetInputRef}
              className="w-full p-3 mb-2 bg-bg-input rounded border border-border-accent/30 text-accent"
              placeholder="Seu email"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              disabled={resetLoading}
            />

            <input
              className="w-full p-3 mb-2 bg-bg-input rounded border border-border-accent/30 text-accent"
              placeholder="Nova senha"
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              disabled={resetLoading}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInstantReset() }}
            />

            {resetError && <p className="text-sm text-red-400 mb-2">{resetError}</p>}
            {resetMsg && <p className="text-sm text-accent mb-2">{resetMsg}</p>}

            <button
              onClick={handleInstantReset}
              className="w-full bg-primary text-black font-bold p-2 rounded mb-2 disabled:opacity-60"
              disabled={resetLoading}
            >
              {resetLoading ? 'Processando...' : 'Atualizar senha'}
            </button>

            <button
              onClick={() => {
                setShowResetModal(false)
                setResetError('')
                setResetMsg('')
                setResetEmail('')
                setResetPassword('')
              }}
              className="w-full text-sm text-gray-300 hover:underline"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// routes/auth.js
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { supa } from '../services/supabase.js'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'developer_secret_key'
const JWT_EXPIRES_IN = '6h' // ajustar conforme necessário

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, nome_de_usuario } = req.body
    if (!email || !password || !nome_de_usuario) {
      return res.status(400).json({ error: 'email, password and nome_de_usuario required' })
    }

    // check existing
    const { data: existing, error: e1 } = await supa
      .from('jogador')
      .select('jogador_id')
      .or(`email.eq.${email},nome_de_usuario.eq.${nome_de_usuario}`)
      .maybeSingle()
    if (e1) throw e1
    if (existing) {
      return res.status(409).json({ error: 'User with email or username already exists' })
    }

    const senha_hash = await bcrypt.hash(password, 8)
    const ins = await supa.from('jogador').insert({
      nome_de_usuario,
      email,
      senha_hash
    }).select('jogador_id, nome_de_usuario, email').single()
    if (ins.error) throw ins.error

    const jogador = ins.data
    const token = jwt.sign({ sub: jogador.jogador_id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

    res.json({ token, jogador })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })

    const { data: user, error } = await supa.from('jogador').select('jogador_id, nome_de_usuario, email, senha_hash').eq('email', email).maybeSingle()
    if (error) throw error
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const ok = await bcrypt.compare(password, user.senha_hash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign({ sub: user.jogador_id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    // return user without senha_hash
    const jogador = { jogador_id: user.jogador_id, nome_de_usuario: user.nome_de_usuario, email: user.email }
    res.json({ token, jogador })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /auth/me
router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization header' })
    }
    const token = auth.split(' ')[1]
    const payload = jwt.verify(token, JWT_SECRET)
    const jogador_id = payload.sub
    const { data: jogador, error } = await supa.from('jogador').select('jogador_id, nome_de_usuario, email').eq('jogador_id', jogador_id).maybeSingle()
    if (error) throw error
    if (!jogador) return res.status(404).json({ error: 'User not found' })
    res.json({ jogador })
  } catch (e) {
    res.status(401).json({ error: 'Invalid token', message: e.message })
  }
})

export default router

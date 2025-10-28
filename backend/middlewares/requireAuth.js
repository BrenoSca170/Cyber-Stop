// src/middlewares/requireAuth.js
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRET || 'developer_secret_key'

export function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization header' })
    }
    const token = auth.split(' ')[1]
    const payload = jwt.verify(token, JWT_SECRET)
    // payload.sub será o jogador_id
    req.user = { jogador_id: payload.sub }
    next()
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token', message: e.message })
  }
}

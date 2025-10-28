import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'

import App from './App'
import LobbyScreen from './pages/LobbyScreen'
import GameScreen from './pages/GameScreen'
import Login from './pages/Login'
import './index.css'

function RequireAuth({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <RequireAuth><App /></RequireAuth>,
    children: [
      { path: '/', element: <LobbyScreen /> },
      { path: '/game/:salaId', element: <GameScreen /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)

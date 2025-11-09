// src/pages/RankingScreen.jsx
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Globe, Users } from 'lucide-react'
import Ranking from '../components/Ranking'

export default function RankingScreen() {
  const navigate = useNavigate()
  const { salaId } = useParams()
  const [showGlobal, setShowGlobal] = useState(!salaId)
  const [autoRefresh, setAutoRefresh] = useState(false)

  return (
    <div className="min-h-screen bg-bg-primary text-white p-6 font-cyber">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-bg-secondary hover:bg-bg-input/50 
                       transition-colors rounded cursor-target"
            data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
          >
            <ArrowLeft size={20} />
            Voltar
          </button>

          <div className="flex items-center gap-4">
            {/* Toggle Global/Sala */}
            {salaId && (
              <div className="flex items-center gap-2 bg-bg-secondary p-1 rounded"
                   data-augmented-ui="tl-clip tr-clip br-clip bl-clip border">
                <button
                  onClick={() => setShowGlobal(true)}
                  className={`px-4 py-2 rounded transition-colors ${
                    showGlobal 
                      ? 'bg-accent text-black font-bold' 
                      : 'text-text-muted hover:text-white'
                  }`}
                >
                  <Globe size={18} className="inline mr-2" />
                  Global
                </button>
                <button
                  onClick={() => setShowGlobal(false)}
                  className={`px-4 py-2 rounded transition-colors ${
                    !showGlobal 
                      ? 'bg-accent text-black font-bold' 
                      : 'text-text-muted hover:text-white'
                  }`}
                >
                  <Users size={18} className="inline mr-2" />
                  Sala
                </button>
              </div>
            )}

            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded transition-colors cursor-target ${
                autoRefresh
                  ? 'bg-warning text-black font-bold'
                  : 'bg-bg-secondary text-text-muted hover:text-white'
              }`}
              data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
            >
              <RefreshCw 
                size={18} 
                className={`inline mr-2 ${autoRefresh ? 'animate-spin' : ''}`} 
              />
              Auto-refresh
            </button>
          </div>
        </div>

        {/* Ranking Component */}
        <Ranking 
          salaId={showGlobal ? null : salaId} 
          limit={10}
          autoRefresh={autoRefresh}
        />
      </div>
    </div>
  )
}


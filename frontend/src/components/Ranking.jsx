// src/components/Ranking.jsx
import { useState, useEffect } from 'react'
import { Trophy, Medal, Award, Users } from 'lucide-react'
import api from '../lib/api.js'

export default function Ranking({ salaId = null, limit = 10, autoRefresh = false }) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isGlobal, setIsGlobal] = useState(!salaId)

  useEffect(() => {
    fetchRanking()
    
    // Auto-refresh se habilitado
    if (autoRefresh) {
      const interval = setInterval(fetchRanking, 5000) // Atualiza a cada 5 segundos
      return () => clearInterval(interval)
    }
  }, [salaId, autoRefresh])

  const fetchRanking = async () => {
    try {
      setLoading(true)
      setError(null)

      const endpoint = salaId 
        ? `/ranking/sala/${salaId}?limit=${limit}`
        : `/ranking/global?limit=${limit}`
      
      const response = await api.get(endpoint)
      setRanking(response.data.ranking || [])
      setIsGlobal(!salaId)
    } catch (err) {
      console.error('[Ranking] Erro ao buscar ranking:', err)
      setError(err.response?.data?.error || 'Erro ao carregar ranking')
    } finally {
      setLoading(false)
    }
  }

  const getMedalIcon = (position) => {
    if (position === 1) return <Trophy className="w-6 h-6 text-yellow-400" />
    if (position === 2) return <Medal className="w-6 h-6 text-gray-300" />
    if (position === 3) return <Award className="w-6 h-6 text-amber-600" />
    return <Users className="w-6 h-6 text-text-muted" />
  }

  const getMedalColor = (position) => {
    if (position === 1) return 'text-yellow-400'
    if (position === 2) return 'text-gray-300'
    if (position === 3) return 'text-amber-600'
    return 'text-text-muted'
  }

  if (loading) {
    return (
      <div className="text-white text-center p-6 font-cyber">
        <div className="animate-pulse">Carregando ranking...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-400 text-center p-6 font-cyber">
        <p>Erro: {error}</p>
        <button
          onClick={fetchRanking}
          className="mt-4 px-4 py-2 bg-accent text-black rounded hover:bg-accent/80 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!ranking.length) {
    return (
      <div className="text-white text-center p-6 font-cyber">
        <p className="text-text-muted">Nenhum ranking disponível ainda.</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto text-white font-cyber">
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-bold text-text-header mb-2 z-10">
          {isGlobal ? '🏆 Ranking Global' : '📊 Ranking da Sala'}
        </h2>
        {!isGlobal && salaId && (
          <p className="text-sm text-text-muted">Sala #{salaId}</p>
        )}
      </div>

      <div 
        className="bg-bg-secondary p-6 shadow-xl"
        data-augmented-ui="tl-clip tr-clip br-clip bl-clip border inlay"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-bg-input/70 border-b border-secondary/30">
                <th className="p-3 text-left text-text-muted uppercase text-sm">Posição</th>
                <th className="p-3 text-left text-text-muted uppercase text-sm">Jogador</th>
                <th className="p-3 text-right text-text-muted uppercase text-sm">Pontuação</th>
                {isGlobal && (
                  <>
                    <th className="p-3 text-center text-text-muted uppercase text-sm">Partidas</th>
                    <th className="p-3 text-center text-text-muted uppercase text-sm">Vitórias</th>
                  </>
                )}
                {!isGlobal && (
                  <th className="p-3 text-center text-text-muted uppercase text-sm">Status</th>
                )}
              </tr>
            </thead>
            <tbody>
              {ranking.map((item, index) => (
                <tr
                  key={item.jogador_id}
                  className={`border-b border-secondary/20 hover:bg-bg-input/30 transition-colors ${
                    index < 3 ? 'bg-bg-input/20' : ''
                  }`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {getMedalIcon(item.posicao)}
                      <span className={`font-bold ${getMedalColor(item.posicao)}`}>
                        #{item.posicao}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="font-medium text-secondary">
                      {item.nome_de_usuario || `Jogador ${item.jogador_id}`}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <span className="font-bold text-lg text-accent">
                      {item.pontuacao_total}
                    </span>
                  </td>
                  {isGlobal && (
                    <>
                      <td className="p-3 text-center text-text-muted">
                        {item.partidas_jogadas || 0}
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-warning font-semibold">
                          {item.vitorias || 0}
                        </span>
                      </td>
                    </>
                  )}
                  {!isGlobal && (
                    <td className="p-3 text-center">
                      {item.vencedor ? (
                        <span className="text-warning font-semibold flex items-center justify-center gap-1">
                          <Trophy className="w-4 h-4" />
                          Vencedor
                        </span>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {autoRefresh && (
          <div className="mt-4 text-center text-xs text-text-muted">
            Atualização automática ativa
          </div>
        )}
      </div>
    </div>
  )
}


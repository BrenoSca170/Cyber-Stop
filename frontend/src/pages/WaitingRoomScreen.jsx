// src/pages/WaitingRoomScreen.jsx - ATUALIZADO PARA MOSTRAR ITENS EXCLUÍDOS

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../apiClient';
import { Tag, XCircle, CheckCircle } from 'lucide-react'; // Ícones para a UI

function WaitingRoomScreen() {
    const { salaId } = useParams();
    const navigate = useNavigate();
    const [sala, setSala] = useState(null);
    const [jogadores, setJogadores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreator, setIsCreator] = useState(false);
    
    const [allLetras, setAllLetras] = useState([]);
    const [allTemas, setAllTemas] = useState([]);

    const handleStartGame = async () => {
        setLoading(true);
        try {
            await apiClient.post(`/game/rooms/${salaId}/start`);
        } catch (error) {
            alert(`Erro ao iniciar partida: ${error.response?.data?.error || error.message}`);
            setLoading(false);
        }
    };
    
    const handleLeaveRoom = async () => {
        setLoading(true);
        try {
            await apiClient.post(`/game/rooms/${salaId}/leave`);
            navigate('/');
        } catch (error) {
            alert(`Erro ao sair da sala: ${error.response?.data?.error || error.message}`);
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchConfigData = async () => {
            try {
                const [letrasRes, temasRes] = await Promise.all([
                    apiClient.get('/game/config/letras'),
                    apiClient.get('/game/config/temas')
                ]);
                setAllLetras(letrasRes.data);
                setAllTemas(temasRes.data);
            } catch (error) {
                 console.error('Erro ao buscar configurações do jogo:', error);
            }
        };

        const fetchSalaState = async () => {
            try {
                const response = await apiClient.get(`/game/rooms/${salaId}`);
                const salaData = response.data;
                
                setSala(salaData);
                setJogadores(salaData.jogadores);
                setIsCreator(salaData.is_creator); 

                if (salaData.status === 'em_jogo') {
                    navigate(`/game/${salaId}`);
                }

            } catch (error) {
                console.error('Erro ao buscar estado da sala:', error);
                alert('Não foi possível encontrar a sala. A redirecionar para o lobby.');
                navigate('/');
            }
        };
        
        Promise.all([fetchConfigData(), fetchSalaState()]).then(() => {
            setLoading(false)
        });

        const intervalId = setInterval(fetchSalaState, 3000);
        return () => clearInterval(intervalId);
    }, [salaId, navigate]);

    // Lógica para determinar temas/letras incluídos e excluídos
    const temasIncluidos = allTemas.filter(tema => !sala?.temas_excluidos?.includes(tema));
    const temasExcluidos = sala?.temas_excluidos || [];
    
    const letrasIncluidas = allLetras.filter(letra => !sala?.letras_excluidas?.includes(letra));
    const letrasExcluidas = sala?.letras_excluidas || [];


    if (loading || !sala) {
        return <p className="text-white text-center p-10">A entrar na sala...</p>;
    }

    return (
        <div className="p-8 text-white max-w-4xl mx-auto">
            <button onClick={handleLeaveRoom} className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors">
                &larr; Sair da Sala
            </button>

            <div className="text-center mb-8">
                <h1 className="text-4xl font-bold">Sala: {sala.nome_sala}</h1>
                <p className="text-gray-400">Criada por: {sala.jogador.nome_de_usuario}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Coluna de Jogadores */}
                <div className="bg-gray-800 p-6 rounded-lg">
                    <h2 className="text-2xl font-semibold mb-4">Jogadores na Sala ({jogadores.length})</h2>
                    <ul className="space-y-2">
                        {jogadores.map((nome, index) => <li key={index} className="text-lg bg-gray-700/50 px-3 py-1 rounded">{nome}</li>)}
                    </ul>
                </div>

                {/* ===== SEÇÃO DE CONFIGURAÇÕES ATUALIZADA ===== */}
                <div className="bg-gray-800 p-6 rounded-lg space-y-6">
                    <h2 className="text-2xl font-semibold mb-2">Configurações da Partida</h2>
                    
                    {/* Seção de Temas */}
                    <div>
                        <h3 className="font-bold text-lg mb-2 text-blue-300 flex items-center gap-2">
                            <CheckCircle size={20} /> Temas Ativos ({temasIncluidos.length})
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {temasIncluidos.map(tema => (
                                <span key={tema} className="bg-blue-600/50 px-2 py-1 text-sm rounded-full">{tema}</span>
                            ))}
                        </div>
                        {/* Mostra os temas excluídos, se houver */}
                        {temasExcluidos.length > 0 && (
                            <>
                                <h3 className="font-bold text-lg mt-4 mb-2 text-red-400 flex items-center gap-2">
                                    <XCircle size={20} /> Temas Excluídos ({temasExcluidos.length})
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {temasExcluidos.map(tema => (
                                        <span key={tema} className="bg-red-800/60 px-2 py-1 text-sm rounded-full line-through text-gray-400">{tema}</span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                    
                    {/* Seção de Letras */}
                    <div>
                        <h3 className="font-bold text-lg mb-2 text-green-300 flex items-center gap-2">
                            <CheckCircle size={20} /> Letras Ativas ({letrasIncluidas.length})
                        </h3>
                        <div className="flex flex-wrap gap-1">
                            {letrasIncluidas.map(letra => (
                                <span key={letra} className="bg-green-600/50 w-7 h-7 flex items-center justify-center text-xs font-mono rounded-md">{letra}</span>
                            ))}
                        </div>
                        {/* Mostra as letras excluídas, se houver */}
                        {letrasExcluidas.length > 0 && (
                            <>
                                <h3 className="font-bold text-lg mt-4 mb-2 text-red-400 flex items-center gap-2">
                                    <XCircle size={20} /> Letras Excluídas ({letrasExcluidas.length})
                                </h3>
                                <div className="flex flex-wrap gap-1">
                                    {letrasExcluidas.map(letra => (
                                        <span key={letra} className="bg-red-800/60 w-7 h-7 flex items-center justify-center text-xs font-mono rounded-md line-through text-gray-400">{letra}</span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-10 text-center">
                {isCreator && sala.status === 'aguardando' && (
                    <button 
                        onClick={handleStartGame}
                        disabled={loading}
                        className="px-10 py-4 bg-green-600 rounded-lg font-bold text-xl hover:bg-green-700 disabled:bg-gray-500 transition-transform hover:scale-105"
                    >
                        Iniciar Partida
                    </button>
                )}
                {!isCreator && sala.status === 'aguardando' && (
                    <p className="text-lg text-gray-400">A aguardar que o líder da sala inicie a partida...</p>
                )}
            </div>
        </div>
    );
}

export default WaitingRoomScreen;
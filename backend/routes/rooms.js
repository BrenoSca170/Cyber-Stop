// backend/routes/rooms.js
import { Router } from 'express';
import { supa } from '../services/supabase.js';
import requireAuth from '../middlewares/requireAuth.js';
import { getIO } from '../src/sockets.js';

const router = Router();

// --- FUNÇÃO AUXILIAR PARA LIMPEZA E VERIFICAÇÃO DE HOST ---
async function checkHostAndClean(jogador_id) {
  // 1. Limpa salas "fechadas" da tabela 'jogador_sala' para este jogador
  const { data: playerEntries, error: getEntriesError } = await supa
    .from('jogador_sala')
    .select('sala_id, sala:sala_id ( status )')
    .eq('jogador_id', jogador_id);
  
  if (getEntriesError) throw getEntriesError;

  const entriesToDelete = (playerEntries || [])
    .filter(js => js.sala && js.sala.status === 'closed') // Usa 'closed'
    .map(js => js.sala_id);

  if (entriesToDelete.length > 0) {
    console.log(`---> [Host Check] Limpando ${entriesToDelete.length} sala(s) 'closed' para jogador ${jogador_id}`);
    await supa
      .from('jogador_sala')
      .delete()
      .eq('jogador_id', jogador_id)
      .in('sala_id', entriesToDelete);
  }

  // 2. NOVA REGRA: Verifica se o jogador é HOST de alguma sala 'open' ou 'playing'
  const { data: hostSalas, error: hostCheckError } = await supa
    .from('sala')
    .select('sala_id, status')
    .eq('jogador_criador_id', jogador_id) // Verifica salas onde ele é o CRIADOR
    .in('status', ['open', 'playing']); // Verifica os novos status ativos
  
  if (hostCheckError) throw hostCheckError;

  if (hostSalas && hostSalas.length > 0) {
    console.warn(`---> [Host Check] Bloqueado: Jogador ${jogador_id} ainda é host de uma sala ativa (Sala ${hostSalas[0].sala_id}, Status: ${hostSalas[0].status}).`);
    return { 
      locked: true, 
      error: `Você já é o host de uma sala que está '${hostSalas[0].status}'. Você deve fechá-la antes de criar ou entrar em outra.` 
    };
  }

  // 3. REGRA ANTIGA (adaptada): Verifica se ele é JOGADOR em outra sala
  const otherActiveSalas = (playerEntries || []).filter(js => 
    js.sala && 
    (js.sala.status === 'open' || js.sala.status === 'playing') &&
    !entriesToDelete.includes(js.sala_id) // Ignora as que acabaram de ser limpas
  );

  if (otherActiveSalas.length > 0) {
     console.warn(`---> [Host Check] Bloqueado: Jogador ${jogador_id} já está em outra sala ativa (Sala ${otherActiveSalas[0].sala_id}).`);
      return { 
        locked: true, 
        error: 'Você já está em outra sala. Saia da sala anterior para criar ou entrar em uma nova.' 
      };
  }

  return { locked: false, error: null };
}
// --- FIM DA FUNÇÃO AUXILIAR ---


// --- ROTA EXISTENTE: Criar sala ---
router.post('/', requireAuth, async (req, res) => {
  try {
    const jogador_id = req.user.jogador_id;
    const { nome_sala = 'Sala' } = req.body;

    // --- NOVA VERIFICAÇÃO DE HOST/JOGADOR ---
    const { locked, error: lockError } = await checkHostAndClean(jogador_id);
    if (locked) {
      return res.status(409).json({ error: lockError });
    }
    // --- FIM DA VERIFICAÇÃO ---

    const { data: sala, error } = await supa.from('sala')
      .insert({ 
        jogador_criador_id: jogador_id, 
        nome_sala, 
        status: 'open' // USA 'open'
      })
      .select('*').single();
    if (error) throw error;

    await supa.from('jogador_sala').insert({ jogador_id, sala_id: sala.sala_id });

    console.log(`---> [POST /rooms] Sala ${sala.sala_id} criada com sucesso (status: open).`);
    res.json({ sala_id: sala.sala_id, host_user: jogador_id });

  } catch (e) {
    console.error('[POST /rooms] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// --- ROTA EXISTENTE: Entrar sala ---
router.post('/join', requireAuth, async (req, res) => {
  const sala_id = Number(req.body.sala_id);
  const jogador_id = req.user.jogador_id;
  
  console.log(`---> [POST /rooms/join] REQUISIÇÃO RECEBIDA por jogador ${jogador_id} para sala ${sala_id}`);

  try {
    if (!sala_id) {
        return res.status(400).json({ error: 'sala_id required' });
    }

    // --- VERIFICAÇÃO DE HOST/JOGADOR ---
    const { data: existingSalas, error: checkError } = await supa
      .from('jogador_sala')
      .select('sala_id, sala:sala_id ( status )')
      .eq('jogador_id', jogador_id);
    
    if (checkError) throw checkError;

    const otherActiveSalas = (existingSalas || []).filter(js => 
      js.sala_id !== sala_id && // Ignora a sala que está tentando entrar
      js.sala && (js.sala.status === 'open' || js.sala.status === 'playing')
    );
    
    if (otherActiveSalas.length > 0) {
      console.warn(`---> [POST /rooms/join] Bloqueado: Jogador ${jogador_id} já está em outra sala ativa (sala ${otherActiveSalas[0].sala_id}).`);
      return res.status(409).json({ error: 'Você já está em outra sala. Saia da sala anterior para entrar nesta.' });
    }
    // --- FIM DA VERIFICAÇÃO ---

    const { data: salaData, error: salaError } = await supa
        .from('sala')
        .select('status, jogador_criador_id')
        .eq('sala_id', sala_id)
        .single();
    
    if (salaError) throw salaError;
    if (!salaData) {
        return res.status(404).json({ error: 'Sala não encontrada' });
    }

    // Verifica se a sala está aberta
    if (salaData.status !== 'open') { // USA 'open'
        console.log(`---> [POST /rooms/join] Erro: Sala ${sala_id} não está 'open' (status: ${salaData.status}).`);
        return res.status(400).json({ error: 'Sala não está aguardando jogadores (status: ' + salaData.status + ')' });
    }
    
    // ... (lógica de contagem de jogadores permanece a mesma) ...
    const { data: jogadoresExistentes, error: countError } = await supa
        .from('jogador_sala')
        .select('jogador_id', { count: 'exact' })
        .eq('sala_id', sala_id);
    
    if (countError) throw countError;
    
    const quantidadeJogadores = jogadoresExistentes?.length || 0;
    const jogadorJaEstaNaSala = jogadoresExistentes?.some(js => js.jogador_id === jogador_id) || false;
    
    if (jogadorJaEstaNaSala) {
        console.log(`---> [POST /rooms/join] Jogador ${jogador_id} já está na sala ${sala_id}. Permitindo re-entrada.`);
    } else {
        if (quantidadeJogadores >= 2) {
            return res.status(400).json({ error: 'A sala está cheia. Máximo de 2 jogadores permitidos.' });
        }
    }
    
    // ... (lógica de upsert e emissão de socket permanece a mesma) ...
    await supa
        .from('jogador_sala')
        .upsert({ jogador_id, sala_id }, { onConflict: 'jogador_id, sala_id' });

    const io = getIO();
    if (io) {
       const { data: jogadoresAtualizadosData, error: jogadoresError } = await supa
           .from('jogador_sala')
           .select('jogador:jogador_id ( jogador_id, nome_de_usuario )')
           .eq('sala_id', sala_id);
       if (!jogadoresError) {
           const jogadoresNomes = (jogadoresAtualizadosData || []).map(js => js.jogador?.nome_de_usuario || `Jogador ${js.jogador?.jogador_id}`);
           io.to(String(sala_id)).emit('room:players_updated', { jogadores: jogadoresNomes });
       }
    }
    res.json({ sala_id, guest_user: jogador_id });

  } catch (e) {
    console.error(`---> [POST /rooms/join] ERRO GERAL NO CATCH para sala ${sala_id} por jogador ${jogador_id}:`, e);
    // ... (tratamento de erro permanece o mesmo) ...
    if (e.code === '23505' || (e.message && e.message.includes('jogador_sala_pkey'))) {
         return res.json({ sala_id: req.body.sala_id, guest_user: req.user.jogador_id });
    } else if (e.code === 'PGRST116') {
        return res.status(404).json({ error: 'Sala não encontrada.' });
    }
    res.status(500).json({ error: e.message });
  }
});

// --- ROTA: Sair da sala ---
router.post('/:salaId/leave', requireAuth, async (req, res) => {
   try {
       const salaId = Number(req.params.salaId);
       const jogador_id = req.user.jogador_id;

       console.log(`---> [LEAVE /rooms/${salaId}/leave] REQUISIÇÃO RECEBIDA por jogador ${jogador_id}`);

       const { data: salaData, error: salaError } = await supa
           .from('sala')
           .select('status, jogador_criador_id')
           .eq('sala_id', salaId)
           .maybeSingle();
       if (salaError) throw salaError;
       
       let salaFoiFechada = false; // Variável para controlar o evento socket

       // --- INÍCIO DA LÓGICA DE HOST ---
       // Se o jogador que está saindo é o criador E a sala está 'open'
       if (salaData && salaData.jogador_criador_id === jogador_id && salaData.status === 'open') {
           console.log(`---> [LEAVE /rooms/${salaId}/leave] Host (jogador ${jogador_id}) está saindo. ATUALIZANDO sala para 'closed'.`);
           
           const { error: updateError } = await supa
               .from('sala')
               .update({ status: 'closed' }) // Define o status como 'closed'
               .eq('sala_id', salaId);
               
           if (updateError) {
               console.error(`---> [LEAVE /rooms/${salaId}/leave] Erro ao atualizar status para 'closed':`, updateError);
           } else {
               salaFoiFechada = true; // Marca que a sala foi fechada
           }
       } else {
           console.log(`---> [LEAVE /rooms/${salaId}/leave] Saindo como jogador normal. Status da sala não alterado.`);
       }
       // --- FIM DA LÓGICA DE HOST ---

       // Remove o jogador da sala (seja host ou não)
       const { error: deleteError } = await supa
           .from('jogador_sala')
           .delete()
           .eq('sala_id', salaId)
           .eq('jogador_id', jogador_id);
       console.log(`---> [LEAVE /rooms/${salaId}/leave] Jogador ${jogador_id} removido de jogador_sala (Erro: ${deleteError ? deleteError.message : 'Nenhum'})`);
       
       const io = getIO();
       if (io) {
           if (salaFoiFechada) {
               // Avisa a todos na sala (incluindo o host que está saindo) que a sala fechou
               console.log(`---> [LEAVE /rooms/${salaId}/leave] Emitindo room:closed para sala ${salaId}`);
               io.to(String(salaId)).emit('room:closed', { message: 'O host fechou a sala.' });
           
           } else if (salaData && salaData.status === 'open') { 
               // Se a sala NÃO foi fechada (ou seja, um jogador normal saiu)
               // Apenas atualiza a lista de players para quem ficou
               const { data: jogadoresAtualizadosData, error: jogadoresError } = await supa
                   .from('jogador_sala')
                   .select('jogador:jogador_id ( jogador_id, nome_de_usuario )')
                   .eq('sala_id', salaId);
               if (!jogadoresError) {
                   const jogadoresNomes = (jogadoresAtualizadosData || []).map(js => js.jogador?.nome_de_usuario || `Jogador ${js.jogador?.jogador_id}`);
                   console.log(`---> [LEAVE /rooms/${salaId}/leave] Emitindo room:players_updated para sala ${salaId} com jogadores:`, jogadoresNomes);
                   io.to(String(salaId)).emit('room:players_updated', { jogadores: jogadoresNomes });
               } else {
                   console.error(`---> [LEAVE /rooms/${salaId}/leave] Erro ao buscar jogadores atualizados pós-saída:`, jogadoresError);
               }
           }
       }
       // Responde sucesso em ambos os casos (host saindo ou jogador saindo)
       res.json({ success: true, message: 'Você saiu da sala.' });

   } catch (e) {
       console.error(`---> [LEAVE /rooms/${req.params.salaId}/leave] ERRO GERAL NO CATCH:`, e);
       res.status(500).json({ error: e.message || 'Erro ao sair da sala.' });
   }
});


// --- ROTA EXISTENTE: Obter detalhes da sala ---
router.get('/:salaId', requireAuth, async (req, res) => {
    try {
        const salaId = Number(req.params.salaId);
        const current_jogador_id = req.user.jogador_id;

        if (!salaId) return res.status(400).json({ error: 'ID da sala é obrigatório.' });

        const { data: salaData, error: salaError } = await supa
            .from('sala')
            .select(`
                sala_id, nome_sala, status, jogador_criador_id,
                jogador:jogador_criador_id ( nome_de_usuario ),
                temas_excluidos, letras_excluidas
            `)
            .eq('sala_id', salaId)
            .single();

        if (salaError) throw salaError;
        if (!salaData) {
            return res.status(404).json({ error: 'Sala não encontrada.' });
        }

        // Altera 'abandonada' para 'closed'
        if (salaData.status === 'closed') { // USA 'closed'
            console.log(`---> [GET /rooms/${salaId}] Status é 'closed'. Retornando 410 Gone.`);
            return res.status(410).json({ error: 'Esta sala foi fechada.' }); // Mensagem mais genérica
        }
        
        // ... (lógica para buscar jogadores permanece a mesma) ...
        const { data: jogadoresData, error: jogadoresError } = await supa
            .from('jogador_sala')
            .select(`jogador:jogador_id ( jogador_id, nome_de_usuario )`)
            .eq('sala_id', salaId);
        if (jogadoresError) throw jogadoresError;
        
        const jogadoresNaSala = (jogadoresData || []).map(js => js.jogador?.nome_de_usuario || `Jogador ${js.jogador?.jogador_id}`);
        const is_creator = salaData.jogador_criador_id === current_jogador_id;
        
        const responseData = {
            sala_id: salaData.sala_id,
            nome_sala: salaData.nome_sala,
            status: salaData.status, // enviará 'open' ou 'playing'
            jogador: {
                jogador_id: salaData.jogador_criador_id,
                nome_de_usuario: salaData.jogador?.nome_de_usuario || 'Desconhecido'
            },
            jogadores: jogadoresNaSala,
            temas_excluidos: salaData.temas_excluidos || [],
            letras_excluidas: salaData.letras_excluidas || [],
            is_creator: is_creator
        };
        res.json(responseData);

    } catch (e) {
        console.error(`---> [GET /rooms/${req.params.salaId}] ERRO GERAL NO CATCH:`, e);
        if (e.code === 'PGRST116') {
             return res.status(404).json({ error: 'Sala não encontrada.' });
        }
        res.status(500).json({ error: e.message || 'Erro ao buscar detalhes da sala.' });
    }
});

// --- ROTA: Listar salas disponíveis ---
router.get('/available', requireAuth, async (req, res) => {
  try {
    console.log(`---> [GET /rooms/available] REQUISIÇÃO RECEBIDA`);
    
    // Altera 'waiting' para 'open'
    const { data: salas, error: salasError } = await supa
      .from('sala')
      .select('sala_id, nome_sala')
      .eq('status', 'open'); // USA 'open'
      
    if (salasError) throw salasError;

    if (!salas || salas.length === 0) {
      console.log(`---> [GET /rooms/available] Nenhuma sala 'open' encontrada.`);
      return res.json([]);
    }

    // ... (lógica de contagem e filtro permanece a mesma) ...
    const salaIds = salas.map(s => s.sala_id);
    const { data: counts, error: countError } = await supa
      .from('jogador_sala')
      .select('sala_id, count', { count: 'exact' })
      .in('sala_id', salaIds)
      .group('sala_id');
    
    if (countError) throw countError;

    const countMap = (counts || []).reduce((acc, c) => {
      acc[c.sala_id] = c.count;
      return acc;
    }, {});

    const availableRooms = salas.map(s => ({
      sala_id: s.sala_id,
      nome_sala: s.nome_sala,
      player_count: countMap[s.sala_id] || 0
    })).filter(s => (s.player_count || 0) < 2);

    console.log(`---> [GET /rooms/available] Retornando ${availableRooms.length} salas 'open'.`);
    res.json(availableRooms);

  } catch (e) {
    console.error(`---> [GET /rooms/available] ERRO GERAL NO CATCH:`, e);
    res.status(500).json({ error: e.message || 'Erro ao buscar salas disponíveis.' });
  }
});

export default router;
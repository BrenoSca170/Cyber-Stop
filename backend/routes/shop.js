// backend/routes/shop.js
import express from 'express'
import { supa } from '../services/supabase.js'
import requireAuth from '../middlewares/requireAuth.js'

const router = express.Router()

// ROTA 1: Buscar o inventário do jogador (Moedas E Power-ups)
router.get('/inventory', requireAuth, async (req, res) => {
    console.log('[shop.js /inventory] req.jogadorId recebido:', req.jogadorId);
    console.log('[shop.js /inventory] req.user.jogador_id recebido:', req.user?.jogador_id);
    // requireAuth (middleware) já validou o token e colocou 'jogadorId' em req
    const jogadorId = req.jogadorId;

    try {
        // Junta 'inventario' com 'item' para pegar os detalhes
        const { data, error } = await supa
            .from('inventario')
            .select(`
                qtde,
                item (
                    item_id,
                    nome,
                    descricao,
                    tipo,
                    codigo_identificador,
                    preco
                )
            `)
            .eq('jogador_id', jogadorId);

        if (error) throw error;

        // Separa moedas de power-ups para o frontend
        const moedasData = data.find(it => it.item.tipo === 'MOEDA');
        const moedas = moedasData ? moedasData.qtde : 0;
        
        // Filtra só power-ups e formata para o frontend
        // O frontend receberá um array de Itens que ele possui
        const powerUps = data
            .filter(it => it.item.tipo === 'POWERUP')
            .map(it => ({
                ...it.item, // Espalha os detalhes do item (id, nome, etc.)
                qtde: it.qtde // Adiciona a quantidade que o jogador possui
            }));

        res.status(200).json({ inventario: powerUps, moedas: moedas });

    } catch (error) {
        console.error('Erro ao buscar inventário:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ROTA 2: Listar todos os Power-ups à venda na loja
router.get('/store-items', requireAuth, async (req, res) => {
    try {
        // Busca todos os itens do tipo 'POWERUP' que estão 'ATIVO'
        const { data, error } = await supa
            .from('item')
            .select('item_id, nome, descricao, preco, codigo_identificador')
            .eq('tipo', 'POWERUP')
            .eq('status', 'ATIVO')
            .order('preco', { ascending: true });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao listar itens da loja:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ROTA 3: Listar Pacotes de Moedas à venda
router.get('/store-packages', requireAuth, async (req, res) => {
    try {
        // Busca todos os pacotes que estão 'ATIVO'
        const { data, error } = await supa
            .from('pacote')
            .select('pacote_id, nome, descricao, qtde_moedas, preco')
            .eq('status', 'ATIVO')
            .order('preco', { ascending: true });

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        console.error('Erro ao listar pacotes da loja:', error.message);
        res.status(500).json({ error: error.message });
    }
});


// ROTA 4: Comprar um Item (Power-up)
router.post('/buy-item', requireAuth, async (req, res) => {
    const { item_id } = req.body;
    const jogadorId = req.jogadorId;

    if (!item_id) {
        return res.status(400).json({ error: 'item_id é obrigatório' });
    }

    try {
        // 1. Busca o preço do item em moedas
        const { data: itemData, error: itemError } = await supa
            .from('item')
            .select('preco') // 'preco' é a coluna de quanto custa em moedas
            .eq('item_id', item_id)
            .single();

        if (itemError || !itemData) throw new Error('Item não encontrado ou inválido.');
        const precoDoItem = itemData.preco;

        // 2. Chama a procedure que faz a transação atômica
        // (prc_realizar_compra_item que você criou no Passo 2.1)
        const { error: rpcError } = await supa.rpc('prc_realizar_compra_item', {
            p_jogador_id: jogadorId,
            p_item_id_a_comprar: item_id,
            p_preco_em_moedas: precoDoItem
        });

        if (rpcError) throw rpcError;

        res.status(200).json({ message: 'Compra realizada com sucesso!' });

    } catch (error) {
        console.error('Erro ao comprar item:', error.message);
        // Captura o erro de "Saldo insuficiente" vindo do SQL
        if (error.message.includes('Saldo de moedas insuficiente')) {
             return res.status(400).json({ error: 'Saldo de moedas insuficiente.' });
        }
        res.status(500).json({ error: error.message || 'Falha na transação.' });
    }
});

// ROTA 5: Comprar um Pacote de Moedas (Inicia a transação)
// (Aqui é onde você integraria um PagSeguro, Stripe, etc.)
router.post('/buy-package', requireAuth, async (req, res) => {
    const { pacote_id } = req.body;
    const jogadorId = req.jogadorId;

    try {
         // 1. Busca os dados do pacote
        const { data: pacote, error: pkgError } = await supa
            .from('pacote')
            .select('qtde_moedas, preco')
            .eq('pacote_id', pacote_id)
            .single();

        if (pkgError || !pacote) throw new Error('Pacote não encontrado.');

        // 2. Registra a compra com status 'PENDENTE'
        // (Em um cenário real, você geraria um ID de pagamento aqui)
        const { data: compra, error: compraError } = await supa
            .from('compra_pacote')
            .insert({
                jogador_id: jogadorId,
                pacote_id: pacote_id,
                qtde_moedas: pacote.qtde_moedas,
                preco: pacote.preco,
                status: 'PENDENTE' // Status inicial
            })
            .select('compra_pacote_id')
            .single();

        if (compraError) throw compraError;

        // 3. Retorna os dados para o frontend iniciar o pagamento
        res.status(201).json({ 
            message: 'Pedido de compra criado. Aguardando pagamento.',
            compra_pacote_id: compra.compra_pacote_id,
            // Aqui você retornaria o link de pagamento do gateway
        });
        
    } catch (error) {
         console.error('Erro ao iniciar compra de pacote:', error.message);
         res.status(500).json({ error: error.message });
    }
});


export default router;
CREATE OR REPLACE FUNCTION public.prc_realizar_compra_item(p_jogador_id bigint, p_item_id_a_comprar bigint, p_preco_em_moedas bigint, p_qtde bigint DEFAULT 1)
RETURNS jsonb AS $$
DECLARE
  v_preco_item bigint;
  v_total bigint;
  v_moedas_jogador bigint;
  v_novo_saldo bigint;
  v_item_tipo text;
BEGIN
  -- 1️ Recupera o PREÇO DO ITEM e seu TIPO
  SELECT preco, tipo INTO v_preco_item, v_item_tipo
  FROM public.item
  WHERE item_id = p_item_id_a_comprar;

  -- 1.1 Se nenhuma linha for retornada ou preco for nulo
  IF NOT FOUND OR v_preco_item IS NULL THEN
    RAISE EXCEPTION 'Item (%) não encontrado.', p_item_id_a_comprar;
  END IF;

  -- 2 Recupera o SALDO DE MOEDAS DO JOGADOR da tabela inventario (item_id: 11 = MOEDA)
  SELECT COALESCE(qtde, 0) INTO v_moedas_jogador
  FROM public.inventario
  WHERE jogador_id = p_jogador_id AND item_id = 11 FOR UPDATE;

  -- Se não existe registro, o saldo é 0 (já capturado pelo COALESCE)

  -- 3 Calcula valor total e verifica saldo
  v_total := v_preco_item * p_qtde;
  IF v_moedas_jogador < v_total THEN
    RAISE EXCEPTION 'Saldo de moedas insuficiente.';
  END IF;

  -- 4 Atualiza saldo de moedas do jogador (diminui moedas na inventario)
  v_novo_saldo := v_moedas_jogador - v_total;
  INSERT INTO public.inventario (jogador_id, item_id, qtde)
  VALUES (p_jogador_id, 11, v_novo_saldo)
  ON CONFLICT (jogador_id, item_id)
  DO UPDATE SET
    qtde = v_novo_saldo,
    data_hora_ultima_atualizacao = now();

  -- 5 Registra a compra
  INSERT INTO public.compra_item (jogador_id, item_id, preco, qtde)
  VALUES (p_jogador_id, p_item_id_a_comprar, v_preco_item, p_qtde);

  -- 6 Atualiza inventário do item comprado
  INSERT INTO public.inventario (jogador_id, item_id, qtde)
  VALUES (p_jogador_id, p_item_id_a_comprar, p_qtde)
  ON CONFLICT (jogador_id, item_id)
  DO UPDATE SET
    qtde = public.inventario.qtde + EXCLUDED.qtde,
    data_hora_ultima_atualizacao = now();

  -- 7 Retorna sucesso
  RETURN jsonb_build_object(
    'sucesso', true,
    'mensagem', format('Compra realizada com sucesso! %s unidade(s) do item %s adquiridas.', p_qtde, p_item_id_a_comprar),
    'moedas_restantes', v_novo_saldo
  );

EXCEPTION
  WHEN others THEN
    RETURN jsonb_build_object(
      'sucesso', false,
      'mensagem', format('Erro ao processar compra: %s', SQLERRM)
    );
END;
$$ LANGUAGE plpgsql;
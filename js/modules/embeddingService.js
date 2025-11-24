/*
 * Módulo embeddingService
 *
 * Interfaces de alto nível para geração de embeddings e busca
 * semântica. As funções RPC chamadas aqui devem estar definidas no
 * Supabase (por exemplo, `gerar_embedding_seguro` e `match_embeddings`).
 */

import supabase from './supabaseClient.js';

export async function gerarEmbedding(registroId) {
  const { data, error } = await supabase.rpc('gerar_embedding_seguro', { record_id: registroId });
  if (error) throw error;
  return data;
}

export async function buscarSemantica(query, limite = 10) {
  const { data, error } = await supabase.rpc('match_embeddings', { query_text: query, match_limit: limite });
  if (error) throw error;
  return data;
}
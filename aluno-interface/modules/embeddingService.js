/*
 * embeddingService module
 *
 * For bibliotecas (alunos e professores) é necessário extrair texto de
 * documentos e gerar vetores de embeddings para permitir busca
 * semântica. Este módulo fornece wrappers de alto nível para chamar
 * funções armazenadas no banco via Supabase RPC. A lógica de fato
 * reside no back‑end (funções `embed` e stored procedures como
 * `gerar_embedding_seguro` e `match_embeddings`).
 */

import supabase from './supabaseClient.js';

/**
 * Aciona a geração de embeddings para um documento. Esta função deve
 * ser chamada após o upload de um arquivo e gravação de metadados na
 * tabela correspondente (e.g. `aluno_documentos` ou `arquivos_professor`).
 * Recebe o ID do registro e retorna o resultado da chamada RPC.
 */
export async function generateEmbeddingForDocument(recordId) {
  try {
    // chamar stored procedure 'gerar_embedding_seguro' definida no banco
    const { data, error } = await supabase.rpc('gerar_embedding_seguro', { record_id: recordId });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao gerar embedding:', err);
    throw err;
  }
}

/**
 * Realiza busca semântica nos embeddings de documentos. Envia a string
 * `query` e retorna uma lista de documentos ordenados por similaridade.
 *
 * @param {string} query Texto da pesquisa.
 * @param {number} limit Número máximo de resultados (opcional).
 */
export async function semanticSearch(query, limit = 10) {
  try {
    const { data, error } = await supabase.rpc('match_embeddings', { query_text: query, match_limit: limit });
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro na busca semântica:', err);
    throw err;
  }
}
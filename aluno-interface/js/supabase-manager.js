// ============================================
// GERENCIADOR SUPABASE - BIBLIOTECA DO ALUNO
// ============================================
// Versão simplificada para uso no frontend

// ============================================
// GERENCIADOR SUPABASE - BIBLIOTECA DO ALUNO
// ============================================
// Versão simplificada para uso no frontend

console.log("🔧 [1/5] supabase-manager.js INICIANDO...");

let supabaseClient = null;
let isManagerInitialized = false;

function initializeSupabaseManager() {
  if (isManagerInitialized) return;

  const { createClient } = window.supabase;
  console.log("🔧 [2/5] createClient:", typeof createClient);

  const supabaseUrl = CONFIG.SUPABASE_URL;
  const supabaseKey = CONFIG.SUPABASE_ANON_KEY;
  console.log("🔧 [3/5] CONFIG carregado");

  supabaseClient = createClient(supabaseUrl, supabaseKey);
  console.log("🔧 [4/5] supabaseClient criado");

  // Exporta as funções para o escopo global
  window.supabaseManager = {
    supabaseClient,
    uploadDocumento,
    processarDocumento,
    buscarDocumentos,
    gerarEmbedding,
    buscarBibliotecaSemantica,
    formatarResultados,
  };

  isManagerInitialized = true;
  console.log(
    "✅ supabase-manager.js CARREGADO!",
    Object.keys(window.supabaseManager)
  );
}

document.addEventListener("configReady", initializeSupabaseManager);

// ============================================
// FUNÇÕES DE UPLOAD E PROCESSAMENTO
// ============================================

/**
 * Faz upload de um documento para o storage do Supabase
 */
async function uploadDocumento(file, alunoId) {
  try {
    console.log("📤 Iniciando upload:", file.name);

    // Gerar caminho único
    const timestamp = Date.now();
    const fileName = `${alunoId}/${timestamp}_${file.name}`;

    // Upload para o storage
    const { data, error } = await supabaseClient.storage
      .from("alunos-biblioteca")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("❌ Erro no upload:", error);
      throw error;
    }

    console.log("✅ Upload concluído:", data.path);
    return data;
  } catch (error) {
    console.error("❌ Erro no upload:", error);
    throw error;
  }
}

/**
 * Processa um documento após o upload
 */
async function processarDocumento(file, alunoId, caminhoArquivo) {
  try {
    console.log("⚙️ Processando documento:", file.name);

    // Salvar metadados no banco
    const { data, error } = await supabaseClient
      .from("aluno_documentos")
      .insert({
        aluno_id: alunoId,
        titulo: file.name,
        tipo_arquivo: file.type,
        caminho_arquivo: caminhoArquivo,
        metadata: {
          size: file.size,
          lastModified: file.lastModified,
        },
      })
      .select()
      .single();

    if (error) {
      console.error("❌ Erro ao salvar documento:", error);
      throw error;
    }

    console.log("✅ Documento processado:", data.id);
    return data;
  } catch (error) {
    console.error("❌ Erro ao processar documento:", error);
    throw error;
  }
}

/**
 * Busca documentos do aluno
 */
async function buscarDocumentos(alunoId, filtros = {}) {
  try {
    let query = supabaseClient
      .from("aluno_documentos")
      .select("*")
      .eq("aluno_id", alunoId);

    // Aplicar filtros se existirem
    if (filtros.tipo) {
      query = query.eq("tipo_arquivo", filtros.tipo);
    }

    if (filtros.busca) {
      query = query.ilike("titulo", `%${filtros.busca}%`);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("❌ Erro ao buscar documentos:", error);
    throw error;
  }
}

// ============================================
// BUSCA SEMÂNTICA NA BIBLIOTECA
// ============================================

/**
 * Gera embedding usando OpenAI (usa CONFIG.OPENAI_API_KEY)
 */
async function gerarEmbedding(texto) {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: texto,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `OpenAI Error: ${response.status} - ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("❌ Erro ao gerar embedding:", error);
    throw error;
  }
}

/**
 * Busca semântica na biblioteca do aluno
 */
async function buscarBibliotecaSemantica(query, alunoId, opcoes = {}) {
  const { matchThreshold = 0.3, matchCount = 10 } = opcoes;

  try {
    console.log("🔍 Gerando embedding da query...");
    const embedding = await gerarEmbedding(query);

    console.log("📊 Embedding gerado:");
    console.log("   Tipo:", typeof embedding);
    console.log("   Array?:", Array.isArray(embedding));
    console.log("   Length:", embedding ? embedding.length : 0);
    console.log("   Primeiros 5:", embedding ? embedding.slice(0, 5) : []);

    const queryEmbeddingString = JSON.stringify(embedding);
    console.log(
      "   String enviada (primeiros 100 chars):",
      queryEmbeddingString.substring(0, 100)
    );

    console.log("📚 Buscando documentos similares...");
    console.log("🔧 Parâmetros RPC:");
    console.log("   query_embedding length:", queryEmbeddingString.length);
    console.log("   p_aluno_id:", alunoId);
    console.log("   match_threshold:", matchThreshold);
    console.log("   match_count:", matchCount);

    const { data, error } = await supabaseClient.rpc(
      "buscar_biblioteca_aluno",
      {
        query_embedding: queryEmbeddingString,
        p_aluno_id: alunoId,
        match_threshold: matchThreshold,
        match_count: matchCount,
      }
    );

    if (error) {
      console.error("❌ Erro na busca RPC:", JSON.stringify(error, null, 2));
      throw error;
    }

    console.log(`✅ Encontrados ${data.length} resultados`);
    return data;
  } catch (error) {
    console.error("❌ Erro na busca semântica:", error);
    throw error;
  }
}

/**
 * Formata resultados para exibição
 */
function formatarResultados(resultados) {
  return resultados.map((r) => ({
    id: r.id,
    documentoId: r.documento_id,
    texto: r.content
      ? r.content.substring(0, 300) + (r.content.length > 300 ? "..." : "")
      : "",
    textoCompleto: r.content || "",
    similarity: r.similarity ? `${(r.similarity * 100).toFixed(1)}%` : "N/A",
    titulo: r.metadata?.titulo || "Sem título",
    dataUpload: r.metadata?.data_upload,
    tipoArquivo: r.metadata?.tipo_arquivo,
  }));
}

console.log("🔧 [5/5] Funções definidas");

// ============================================
// EXPORTAÇÕES
// ============================================

window.supabaseManager = {
  supabaseClient,
  uploadDocumento,
  processarDocumento,
  buscarDocumentos,
  gerarEmbedding,
  buscarBibliotecaSemantica,
  formatarResultados,
};

console.log(
  "✅ supabase-manager.js CARREGADO!",
  Object.keys(window.supabaseManager)
);

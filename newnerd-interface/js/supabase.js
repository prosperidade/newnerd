// ============================================================================
// SUPABASE CLIENT – NEW NERD (PROFESSOR) - CORRIGIDO
// ✅ Busca semântica funcional com logs detalhados
// ============================================================================

const SupabaseClient = {
  client: null,
  initialized: false,

  _hasCreds() {
    return Boolean(CONFIG?.SUPABASE_URL && CONFIG?.SUPABASE_ANON_KEY);
  },

  _libLoaded() {
    return (
      typeof supabase !== "undefined" &&
      typeof supabase.createClient === "function"
    );
  },

  init() {
    if (this.initialized) return true;

    if (!this._libLoaded()) {
      console.warn("⚠️ Supabase SDK não encontrado.");
      return false;
    }
    if (!this._hasCreds()) {
      console.error("❌ CONFIG SUPABASE_URL/SUPABASE_ANON_KEY ausentes!");
      return false;
    }

    try {
      this.client = supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
          global: {
            headers: { "x-newnerd-client": "web-professor" },
          },
        }
      );

      this.initialized = true;
      console.log("✅ Supabase inicializado:", CONFIG.SUPABASE_URL);
      return true;
    } catch (e) {
      console.error("❌ Erro ao inicializar Supabase:", e);
      return false;
    }
  },

  async getProfessorId() {
    if (!this.init()) return null;

    try {
      const { data } = await this.client.auth.getUser();
      const user = data?.user;

      if (user) return user.id;

      // MODO DEV – login fake
      if (CONFIG.ENV === "dev" && CONFIG.TESTE_EMAIL && CONFIG.TESTE_SENHA) {
        console.warn("⚠️ DEV: autenticando professor fake...");
        const { error } = await this.client.auth.signInWithPassword({
          email: CONFIG.TESTE_EMAIL,
          password: CONFIG.TESTE_SENHA,
        });

        if (error) {
          console.error("❌ Login fake falhou:", error);
          return null;
        }

        const { data: again } = await this.client.auth.getUser();
        return again?.user?.id ?? null;
      }

      return null;
    } catch (e) {
      console.error("❌ Erro no getProfessorId:", e);
      return null;
    }
  },

  // ============================================================================
  // BIBLIOTECA – BUSCA SEMÂNTICA PROFESSOR (CORRIGIDA)
  // ============================================================================
  async buscarSemanticaProfessor(query, professorIdOverride, opts) {
    if (!this.init()) {
      console.error("❌ Supabase não inicializado");
      return [];
    }

    // --- Normalização de parâmetros ---
    let professorId = professorIdOverride;
    let options = opts || {};

    if (
      typeof professorIdOverride === "object" &&
      professorIdOverride !== null
    ) {
      options = professorIdOverride;
      professorId = null;
    }

    if (!professorId) {
      professorId = await this.getProfessorId();
    }

    if (!professorId) {
      console.error("❌ Professor ID não encontrado");
      return [];
    }

    const matchCount = options.matchCount ?? 5;
    const matchThreshold = options.matchThreshold ?? 0.3;

    console.group("🔍 BUSCA SEMÂNTICA");
    console.log("📝 Query:", query);
    console.log("👤 Professor ID:", professorId);
    console.log("📊 Parâmetros:", { matchCount, matchThreshold });

    try {
      // --- Gerar embedding via OpenAI ---
      console.log("🧠 Gerando embedding...");
      const embedding = await this.gerarEmbeddingTexto(query);

      if (!embedding || embedding.length === 0) {
        console.error("❌ Embedding vazio.");
        console.groupEnd();
        return [];
      }

      console.log("✅ Embedding gerado:", {
        tamanho: embedding.length,
        primeiros5: embedding.slice(0, 5),
      });

      // --- Contagem de documentos ---
      const { count: totalDocs } = await this.client
        .from("arquivos_professor")
        .select("*", { count: "exact", head: true })
        .eq("professor_id", professorId);

      console.log("📦 Total de documentos:", totalDocs);

      if (totalDocs === 0) {
        console.warn("⚠️ Nenhum documento encontrado.");
        console.groupEnd();
        return [];
      }

      // --- Contagem de embeddings ---
      const { count: totalEmbeddings } = await this.client
        .from("professor_embeddings")
        .select("*", { count: "exact", head: true })
        .eq("professor_id", professorId);

      console.log("🧩 Total de embeddings:", totalEmbeddings);

      if (totalEmbeddings === 0) {
        console.warn(
          "⚠️ Nenhum embedding encontrado. Documento não processado."
        );
        console.groupEnd();
        return [];
      }

      // --- Chamada RPC ---
      console.log(
        "🚀 Chamando função SQL buscar_biblioteca_professor_hibrida..."
      );

      const { data, error } = await this.client.rpc(
        "buscar_biblioteca_professor_hibrida",
        {
          p_query_text: query,
          p_query_embedding: embedding, // AGORA ENVIA VETOR REAL, NÃO JSON STRING
          p_professor_id: professorId,
          p_match_threshold: matchThreshold,
          p_match_count: matchCount,
        }
      );

      if (error) {
        console.error("❌ Erro na RPC:", error);

        console.warn("⚠️ Ativando fallback textual...");
        const fallback = await this._fallbackBuscaTexto(
          query,
          professorId,
          matchCount
        );

        console.groupEnd();
        return fallback;
      }

      console.log("✅ Resultados:", {
        quantidade: data?.length ?? 0,
        dados: data,
      });

      console.groupEnd();
      return data || [];
    } catch (e) {
      console.error("❌ Erro geral na busca semântica:", e);

      console.warn("⚠️ Ativando fallback textual...");
      const fallback = await this._fallbackBuscaTexto(
        query,
        professorId,
        matchCount
      );

      console.groupEnd();
      return fallback;
    }
  },

  // ============================================================================
  // 🆕 FALLBACK FULL-TEXT (caso a função SQL quebre)
  // ============================================================================
  async _fallbackBuscaTexto(query, professorId, limit = 5) {
    try {
      const { data, error } = await this.client
        .from("arquivos_professor")
        .select(
          "id, professor_id, conteudo, caminho, titulo, tipo_arquivo, metadata"
        )
        .eq("professor_id", professorId)
        .textSearch("conteudo", query, {
          type: "websearch",
          config: "portuguese",
        })
        .limit(limit);

      if (error) {
        console.error("❌ Fallback full-text falhou:", error);
        return [];
      }

      return (data || []).map((doc) => ({
        id: doc.id,
        professor_id: doc.professor_id,
        documento_path: doc.caminho,
        chunk_texto: (doc.conteudo || "").slice(0, 400),
        metadata: doc.metadata || {
          titulo: doc.titulo,
          tipo_arquivo: doc.tipo_arquivo,
        },
        similarity: 0.5,
        rank_text: 1.0,
        score_final: 0.5,
      }));
    } catch (e) {
      console.error("❌ Fallback general error:", e);
      return [];
    }
  },

  // ============================================================================
  // GERAR EMBEDDING (SEM ALTERAÇÕES)
  // ============================================================================
  async gerarEmbeddingTexto(texto) {
    if (!CONFIG.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não definida em CONFIG.");
    }

    const resp = await fetch("https://api.openai.com/v1/embeddings", {
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

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Embedding erro: ${txt}`);
    }

    const json = await resp.json();
    return json?.data?.[0]?.embedding ?? [];
  },

  // ============================================================================
  // 🆕 NOVA FUNÇÃO: Cria URL assinada para professor
  // ============================================================================
  async criarUrlAssinadaProfessor(path, expiresIn = 60) {
    if (!this.init()) return null;

    try {
      const bucket = CONFIG.BUCKET_PROFESSOR || "newnerd_professores";
      const { data, error } = await this.client.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

      if (error) throw error;
      return data?.signedUrl ?? null;
    } catch (e) {
      console.error("❌ Erro ao criar URL assinada:", e);
      return null;
    }
  },

  // ============================================================================
  // CRUD QUESTÕES (SEM ALTERAÇÕES)
  // ============================================================================
  async salvarQuestao(questao) {
    if (!this.init()) return Storage.salvarQuestao(questao);

    try {
      const professorId = await this.getProfessorId();
      if (!professorId) throw new Error("Professor não autenticado.");

      const registro = {
        professor_id: professorId,
        enunciado: questao.enunciado ?? null,
        tipo_questao: questao.tipo_questao ?? null,
        disciplina: questao.disciplina ?? null,
        serie: questao.serie ?? null,
        dificuldade: questao.dificuldade ?? null,
        alternativas: questao.alternativas ?? null,
        resposta_esperada: questao.resposta_esperada ?? null,
        criterios_avaliacao: questao.criterios_avaliacao ?? null,
        api_usada: questao.api_usada ?? "desconhecido",
        tokens_usados: questao.tokens_usados ?? 0,
        custo_estimado: questao.custo_estimado ?? 0,
        gabarito: questao.gabarito ?? null,
        afirmacoes: questao.afirmacoes ?? null,
        coluna_a: questao.coluna_a ?? null,
        coluna_b: questao.coluna_b ?? null,
        resposta_editada: questao.resposta_editada ?? null,
        criterios_professor: questao.criterios_professor ?? null,
        justificativa_gabarito: questao.justificativa_gabarito ?? null,
      };

      const { data, error } = await this.client
        .from("questoes_geradas")
        .insert(registro)
        .select()
        .single();

      if (error) throw error;

      const q = {
        ...questao,
        id: data.id,
        supabase_id: data.id,
        created_at: data.created_at,
      };
      Storage.salvarQuestao(q);

      console.log("📌 Questão salva no Supabase:", data.id);
      return q;
    } catch (e) {
      console.error("⚠️ Falha ao salvar no Supabase, usando Storage local:", e);
      return Storage.salvarQuestao(questao);
    }
  },

  async carregarQuestoes(filtros = {}) {
    if (!this.init()) return Storage.getHistorico();

    try {
      const professorId = await this.getProfessorId();
      if (!professorId) return [];

      let query = this.client
        .from("questoes_geradas")
        .select("*")
        .eq("professor_id", professorId)
        .order("created_at", { ascending: false });

      if (filtros.tipo_questao)
        query = query.eq("tipo_questao", filtros.tipo_questao);
      if (filtros.disciplina)
        query = query.eq("disciplina", filtros.disciplina);
      if (filtros.serie) query = query.eq("serie", filtros.serie);
      if (filtros.dificuldade)
        query = query.eq("dificuldade", filtros.dificuldade);

      const { data, error } = await query;
      if (error) throw error;

      (data || []).forEach((q) => {
        const local = Storage.getQuestaoById(q.id);
        if (!local) Storage.salvarQuestao(q);
      });

      return data;
    } catch (e) {
      console.error(
        "⚠️ Erro ao carregar questões, caindo para Storage local:",
        e
      );
      return Storage.getHistorico();
    }
  },
};

// Exporta no escopo global
window.SupabaseClient = SupabaseClient;

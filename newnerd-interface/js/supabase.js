// ============================================================================
// SUPABASE CLIENT – NEW NERD (PROFESSOR) – Consolidado
// - Mantém suas rotinas de questões
// - Adiciona helpers para Biblioteca (URL assinada + busca semântica)
// ============================================================================

const SupabaseClient = {
  // Cliente global inicializado pelo config.js
  get client() {
    return window.supabaseClient;
  },

  get initialized() {
    return !!window.supabaseClient;
  },

  init() {
    if (!this.initialized) {
      console.error(
        "❌ Supabase client não disponível. `config.js` falhou ou ainda não executou."
      );
      return false;
    }
    return true;
  },

  async getProfessorId() {
    if (!this.init()) return null;
    try {
      if (globalThis.currentProfessor?.id) return globalThis.currentProfessor.id;

      if (typeof fetchProfessorProfile === "function") {
        const prof = await fetchProfessorProfile();
        if (prof?.id) {
          globalThis.currentProfessor = prof;
          return prof.id;
        }
      }

      const { data } = await this.client.auth.getUser();
      const user = data?.user;

      if (user) {
        const { data: prof, error } = await this.client
          .from("professores")
          .select("id, email, auth_user_id")
          .or(`auth_user_id.eq.${user.id},email.eq.${user.email}`)
          .maybeSingle();

        if (error) throw error;
        if (prof?.id) {
          globalThis.currentProfessor = prof;
          return prof.id;
        }
      }

      if (
        typeof CONFIG !== "undefined" &&
        CONFIG.ENV === "dev" &&
        CONFIG.PROFESSOR_ID
      ) {
        console.warn("⚠️ DEV: Retornando professor id de CONFIG.PROFESSOR_ID");
        return CONFIG.PROFESSOR_ID;
      }
      return null;
    } catch (e) {
      console.error("❌ Erro no getProfessorId:", e);
      return null;
    }
  },

  // =========================
  // Helpers de STORAGE
  // =========================
  async criarUrlAssinadaProfessor(path, expires = 3600) {
    if (!this.init()) return null;
    const bucket =
      (window.CONFIG && CONFIG.BUCKET_PROFESSOR) || "newnerd_professores";
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expires);
    if (error) {
      console.error("URL assinada (prof):", error);
      return null;
    }
    return data.signedUrl;
  },

  // =========================
  // BUSCA SEMÂNTICA – Professor
  // =========================
  async buscarSemanticaProfessor(query, professorId, opts = {}) {
    if (!this.init()) return [];
    const matchCount = opts.matchCount ?? 5;
    const matchThreshold = opts.matchThreshold ?? 0.0;

    // 1) tenta Edge Function semantic-search
    try {
      const { data, error } = await this.client.functions.invoke(
        "semantic-search",
        {
          body: {
            query,
            professor_id: professorId,
            match_count: matchCount,
            match_threshold: matchThreshold,
          },
        }
      );
      if (error) throw error;
      return data?.results || data || [];
    } catch (e1) {
      console.warn("semantic-search indisponível:", e1?.message || e1);
    }

    // 2) tenta RPC existente (ajuste de nomes de parâmetros se necessário)
    try {
      const { data, error } = await this.client.rpc(
        "buscar_biblioteca_professor_hibrida",
        {
          p_query: query,
          p_professor_id: professorId,
          p_match_count: matchCount,
          p_match_threshold: matchThreshold,
        }
      );
      if (error) throw error;
      return data || [];
    } catch (e2) {
      console.warn("RPC indisponível:", e2?.message || e2);
    }

    // 3) fallback simples por texto
    try {
      const { data, error } = await this.client
        .from("arquivos_professor")
        .select("caminho, titulo, nome_original, texto_extraido")
        .eq("professor_id", professorId)
        .ilike("texto_extraido", `%${query}%`)
        .limit(matchCount);
      if (error) throw error;
      return (data || []).map((x) => ({
        documento_path: x.caminho,
        metadata: { titulo: x.titulo || x.nome_original },
        chunk_texto: x.texto_extraido?.slice(0, 500) || "",
        score_final: null,
      }));
    } catch (e3) {
      console.error("Fallback texto também falhou:", e3?.message || e3);
      return [];
    }
  },

  // ============================================================================
  // CRUD QUESTÕES (mantém seu código)
  // ============================================================================
  async salvarQuestao(questao, professorIdOverride = null) {
    if (!this.init()) return null;
    try {
      const professorId = professorIdOverride || (await this.getProfessorId());
      if (!professorId) throw new Error("Professor não autenticado.");

      const registro = {
        professor_id: professorId,
        enunciado: questao.enunciado ?? null,
        tipo_questao: questao.tipo_questao || questao.tipo,
        disciplina: questao.disciplina,
        serie: questao.serie || "Geral",
        dificuldade: questao.dificuldade,
        alternativas: questao.alternativas
          ? typeof questao.alternativas === "string"
            ? JSON.parse(questao.alternativas)
            : questao.alternativas
          : null,
        afirmacoes: questao.afirmacoes
          ? typeof questao.afirmacoes === "string"
            ? JSON.parse(questao.afirmacoes)
            : questao.afirmacoes
          : null,
        coluna_a: questao.coluna_a
          ? typeof questao.coluna_a === "string"
            ? JSON.parse(questao.coluna_a)
            : questao.coluna_a
          : null,
        coluna_b: questao.coluna_b
          ? typeof questao.coluna_b === "string"
            ? JSON.parse(questao.coluna_b)
            : questao.coluna_b
          : null,
        gabarito: questao.gabarito || questao.resposta_esperada,
        justificativa_gabarito:
          questao.justificativa_gabarito || questao.justificativa,
        tokens_usados: questao.tokens_usados || 0,
        custo_estimado: questao.custo_estimado || 0,
        api_usada: questao.api_usada || "desconhecido",
      };

      if (registro.tipo_questao === "verdadeiro_falso" && registro.afirmacoes) {
        registro.alternativas = registro.afirmacoes;
      } else if (registro.tipo_questao === "associacao" && registro.coluna_a) {
        registro.alternativas = {
          coluna_a: registro.coluna_a,
          coluna_b: registro.coluna_b,
        };
      }

      const { data, error } = await this.client
        .from("questoes_geradas")
        .insert(registro)
        .select()
        .single();

      if (error) throw error;
      console.log("📌 Questão salva no Supabase:", data.id);
      return data;
    } catch (e) {
      console.error("⚠️ Falha ao salvar no Supabase:", e);
      throw e;
    }
  },

  async salvarQuestaesEmLote(questoes, professorIdOverride = null) {
    if (!this.init()) return null;
    try {
      const professorId = professorIdOverride || (await this.getProfessorId());
      if (!professorId) throw new Error("Professor não autenticado.");

      const registros = questoes.map((q) => {
        let alts = q.alternativas;
        if (q.tipo_questao === "verdadeiro_falso") alts = q.afirmacoes;
        if (q.tipo_questao === "associacao")
          alts = { coluna_a: q.coluna_a, coluna_b: q.coluna_b };

        return {
          professor_id: professorId,
          serie: q.serie || "Geral",
          disciplina: q.disciplina,
          tipo_questao: q.tipo_questao,
          dificuldade: q.dificuldade,
          enunciado: q.enunciado,
          alternativas: alts,
          gabarito: q.gabarito || q.resposta_esperada,
          justificativa_gabarito: q.justificativa_gabarito,
          tokens_usados: q.tokens_usados || 0,
          custo_estimado: q.custo_estimado || 0,
        };
      });

      const { data, error } = await this.client
        .from("questoes_geradas")
        .insert(registros)
        .select();

      if (error) throw error;
      console.log(`✅ ${data.length} questões salvas em lote.`);
      return data;
    } catch (e) {
      console.error("❌ Erro ao salvar lote:", e);
      throw e;
    }
  },

  async carregarQuestoes(professorIdOverride = null, filters = {}) {
    if (!this.init()) return [];
    try {
      const professorId = professorIdOverride || (await this.getProfessorId());
      if (!professorId) return [];

      let query = this.client
        .from("questoes_geradas")
        .select("*")
        .eq("professor_id", professorId)
        .order("created_at", { ascending: false });

      if (filters.limit) query = query.limit(filters.limit);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (e) {
      console.error("⚠️ Erro ao carregar questões:", e);
      return [];
    }
  },

  async deletarQuestao(id) {
    if (!this.init()) return false;
    try {
      await this.client.from("respostas_alunos").delete().eq("questao_id", id);
      const { error } = await this.client
        .from("questoes_geradas")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error("Erro ao deletar:", e);
      return false;
    }
  },

  async atualizarQuestao(id, campos) {
    if (!this.init()) return false;
    try {
      const { error } = await this.client
        .from("questoes_geradas")
        .update(campos)
        .eq("id", id);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error("Erro ao atualizar:", e);
      return false;
    }
  },
};

window.SupabaseClient = SupabaseClient;

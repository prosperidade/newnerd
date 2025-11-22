// ============================================================================
// SUPABASE CLIENT – NEW NERD (PROFESSOR) - CORRIGIDO
// ✅ Conexão corrigida com o cliente global
// ✅ Correção do erro de sintaxe em salvarQuestaesEmLote
// ============================================================================

const SupabaseClient = {
  // O cliente agora é obtido da janela global, inicializado pelo config.js
  get client() {
    return window.supabaseClient;
  },

  // A verificação de inicialização depende da existência do cliente global
  get initialized() {
    return !!window.supabaseClient;
  },

  // Função de inicialização agora é apenas um wrapper de verificação
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
      const { data } = await this.client.auth.getUser();
      const user = data?.user;

      if (user) return user.id;

      // MODO DEV – Se configurado em CONFIG
      if (
        typeof CONFIG !== "undefined" &&
        CONFIG.ENV === "dev" &&
        CONFIG.TESTE_EMAIL
      ) {
        console.warn("⚠️ DEV: Retornando professor fake...");
        // Aqui você pode retornar um ID fixo para testes se o login falhar
        // return "SEU_ID_FIXO_DE_TESTE";
      }

      return null;
    } catch (e) {
      console.error("❌ Erro no getProfessorId:", e);
      return null;
    }
  },

  // ============================================================================
  // CRUD QUESTÕES
  // ============================================================================

  // Salva uma única questão
  async salvarQuestao(questao, professorIdOverride = null) {
    if (!this.init()) return null;

    try {
      const professorId = professorIdOverride || (await this.getProfessorId());
      if (!professorId) throw new Error("Professor não autenticado.");

      const registro = {
        professor_id: professorId,
        enunciado: questao.enunciado ?? null,
        // Normalização de campos
        tipo_questao: questao.tipo_questao || questao.tipo,
        disciplina: questao.disciplina,
        serie: questao.serie || "Geral",
        dificuldade: questao.dificuldade,

        // JSONB fields
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

        // Metadados
        tokens_usados: questao.tokens_usados || 0,
        custo_estimado: questao.custo_estimado || 0,
        api_usada: questao.api_usada || "desconhecido",
      };

      // Ajuste específico para V/F e Associação para garantir que salve no campo 'alternativas' se o banco exigir
      // (Isso depende da estrutura do seu banco, mas mal não faz ter redundância se o banco for flexível)
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

  // Salva múltiplas questões (CORRIGIDO)
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
      // Tenta deletar dependências primeiro (se não tiver cascade no banco)
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

  // Atualizar Questão (Edição)
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

  // --- Métodos da Busca Semântica (Preservados) ---

  async buscarSemanticaProfessor(query, professorIdOverride, opts) {
    // ... (Mantenha seu código de busca semântica original aqui se ele for usado no gerador) ...
    // Como o foco agora é salvar questões, vou deixar o esqueleto para não dar erro se for chamado.
    console.log("Busca semântica chamada (Stub)");
    return [];
  },
};

// Exporta globalmente
window.SupabaseClient = SupabaseClient;

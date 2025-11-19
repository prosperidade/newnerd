// ========================================
// GERENCIAMENTO DE ARMAZENAMENTO LOCAL
// ========================================

const Storage = {
  /**
   * Salva questão no histórico
   */
  salvarQuestao(questao) {
    try {
      const historico = this.getHistorico();

      // Adicionar timestamp e ID único
      const questaoComMetadata = {
        ...questao,
        id: this.generateId(),
        timestamp: new Date().toISOString(),
        data_criacao: new Date().toLocaleString("pt-BR"),
      };

      historico.unshift(questaoComMetadata);

      // Limitar tamanho do histórico
      if (historico.length > CONFIG.MAX_HISTORY_ITEMS) {
        historico.length = CONFIG.MAX_HISTORY_ITEMS;
      }

      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(historico));

      console.log("✅ Questão salva no localStorage:", questaoComMetadata.id);
      return questaoComMetadata;
    } catch (error) {
      console.error("❌ Erro ao salvar questão:", error);
      return null;
    }
  },

  /**
   * Recupera todo o histórico
   */
  getHistorico() {
    try {
      const data = localStorage.getItem(CONFIG.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("❌ Erro ao recuperar histórico:", error);
      return [];
    }
  },

  /**
   * Busca questão por ID
   */
  getQuestaoById(id) {
    const historico = this.getHistorico();
    return historico.find((q) => q.id === id);
  },

  /**
   * Remove questão do histórico
   */
  removerQuestao(id) {
    try {
      let historico = this.getHistorico();
      historico = historico.filter((q) => q.id !== id);
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(historico));
      console.log("🗑️ Questão removida:", id);
      return true;
    } catch (error) {
      console.error("❌ Erro ao remover questão:", error);
      return false;
    }
  },

  /**
   * Limpa todo o histórico
   */
  limparHistorico() {
    try {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      console.log("🗑️ Histórico limpo");
      return true;
    } catch (error) {
      console.error("❌ Erro ao limpar histórico:", error);
      return false;
    }
  },

  /**
   * Atualiza uma questão existente
   */
  atualizarQuestao(id, dadosAtualizados) {
    try {
      const historico = this.getHistorico();
      const index = historico.findIndex((q) => q.id === id);

      if (index !== -1) {
        historico[index] = {
          ...historico[index],
          ...dadosAtualizados,
          ultima_atualizacao: new Date().toISOString(),
        };
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(historico));
        console.log("✏️ Questão atualizada:", id);
        return historico[index];
      }
      return null;
    } catch (error) {
      console.error("❌ Erro ao atualizar questão:", error);
      return null;
    }
  },

  /**
   * Gera ID único
   */
  generateId() {
    return "q_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  },

  /**
   * Gerenciar tema (dark/light)
   */
  getTema() {
    return localStorage.getItem(CONFIG.THEME_KEY) || "light";
  },

  setTema(tema) {
    localStorage.setItem(CONFIG.THEME_KEY, tema);
  },

  /**
   * Estatísticas do histórico
   */
  getEstatisticas() {
    const historico = this.getHistorico();

    const stats = {
      total: historico.length,
      porTipo: {},
      porDisciplina: {},
      custoTotal: 0,
      tokensTotal: 0,
      custoMedio: 0,
    };

    historico.forEach((q) => {
      // Contar por tipo
      const tipo = q.tipo_questao || "desconhecido";
      stats.porTipo[tipo] = (stats.porTipo[tipo] || 0) + 1;

      // Contar por disciplina
      const disciplina = q.disciplina || "Geral";
      stats.porDisciplina[disciplina] =
        (stats.porDisciplina[disciplina] || 0) + 1;

      // Somar custos e tokens
      stats.custoTotal += q.custo_estimado || 0;
      stats.tokensTotal += q.tokens_usados || 0;
    });

    stats.custoMedio = stats.total > 0 ? stats.custoTotal / stats.total : 0;

    return stats;
  },

  /**
   * Exportar histórico como JSON
   */
  exportarHistorico() {
    const historico = this.getHistorico();
    const dataStr = JSON.stringify(historico, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `newnerd-historico-${
      new Date().toISOString().split("T")[0]
    }.json`;
    a.click();

    URL.revokeObjectURL(url);
  },
};

// Disponibilizar globalmente
if (typeof window !== "undefined") {
  window.Storage = Storage;
}

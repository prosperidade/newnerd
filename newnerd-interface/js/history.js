// ========================================
// GERENCIAMENTO DO HISTÓRICO
// ========================================

/**
 * Carrega e exibe o histórico
 */
function loadHistory() {
  const historicoDiv = document.getElementById("historico");
  if (!historicoDiv) return;

  const historico = Storage.getHistorico();

  if (historico.length === 0) {
    historicoDiv.innerHTML = `
      <div style="text-align: center; color: #999; padding: 20px;">
        Nenhuma questão gerada ainda
      </div>
    `;
    return;
  }

  let html = "";

  historico.forEach((questao, index) => {
    const tipo = QUESTION_TYPES[questao.tipo_questao] || questao.tipo_questao;
    const disciplina = questao.disciplina || "Geral";
    const preview = (questao.enunciado || "").substring(0, 80) + "...";
    const data = questao.data_criacao || "Sem data";

    html += `
      <div class="history-item" onclick="loadQuestionFromHistory('${
        questao.id
      }')">
        <div class="history-header">
          <span class="history-badge">${tipo}</span>
          <span class="history-date">${data}</span>
        </div>
        <div class="history-preview">${preview}</div>
        <div class="history-meta">
          <span>${disciplina}</span>
          ${questao.serie ? `<span>• ${questao.serie}</span>` : ""}
          ${questao.dificuldade ? `<span>• ${questao.dificuldade}</span>` : ""}
        </div>
        <div class="history-actions">
          <button class="btn-icon" onclick="deleteQuestion(event, '${
            questao.id
          }')" title="Excluir">
            🗑️
          </button>
        </div>
      </div>
    `;
  });

  historicoDiv.innerHTML = html;
  console.log(`📚 Histórico carregado: ${historico.length} questões`);
}

/**
 * Carrega uma questão do histórico
 */
function loadQuestionFromHistory(questionId) {
  const questao = Storage.getQuestaoById(questionId);
  if (!questao) {
    alert("❌ Questão não encontrada");
    return;
  }

  currentQuestion = questao;
  window.currentQuestion = questao;

  displayQuestion(questao);

  // Scroll para o topo
  window.scrollTo({ top: 0, behavior: "smooth" });

  console.log("📖 Questão carregada do histórico:", questionId);
}

/**
 * Deleta uma questão específica
 */
function deleteQuestion(event, questionId) {
  // Prevenir propagação para não abrir a questão
  if (event) {
    event.stopPropagation();
  }

  if (!confirm("🗑️ Tem certeza que deseja excluir esta questão?")) {
    return;
  }

  const success = Storage.removerQuestao(questionId);

  if (success) {
    loadHistory();
    updateDashboard();
    alert("✅ Questão excluída com sucesso!");
  } else {
    alert("❌ Erro ao excluir questão");
  }
}

/**
 * Limpa todo o histórico
 */
function clearHistory() {
  if (!confirm("🗑️ Tem certeza que deseja limpar todo o histórico?")) {
    return;
  }

  const success = Storage.limparHistorico();

  if (success) {
    loadHistory();
    updateDashboard();

    // Limpar resultado atual
    const result = document.getElementById("result");
    if (result) {
      result.classList.remove("active");
    }

    alert(CONFIG.MESSAGES.HISTORY_CLEARED);
  } else {
    alert("❌ Erro ao limpar histórico");
  }
}

/**
 * Aplica filtros ao histórico
 */
function applyFilters() {
  const filterTipo = document.getElementById("filterTipo")?.value || "";
  const filterDisciplina =
    document.getElementById("filterDisciplina")?.value || "";
  const filterData = document.getElementById("filterData")?.value || "";

  let historico = Storage.getHistorico();

  // Filtrar por tipo
  if (filterTipo) {
    historico = historico.filter((q) => q.tipo_questao === filterTipo);
  }

  // Filtrar por disciplina
  if (filterDisciplina) {
    historico = historico.filter((q) => q.disciplina === filterDisciplina);
  }

  // Filtrar por data
  if (filterData) {
    const agora = new Date();
    let dataLimite;

    if (filterData === "hoje") {
      dataLimite = new Date(agora.setHours(0, 0, 0, 0));
    } else if (filterData === "semana") {
      dataLimite = new Date(agora.setDate(agora.getDate() - 7));
    } else if (filterData === "mes") {
      dataLimite = new Date(agora.setMonth(agora.getMonth() - 1));
    }

    if (dataLimite) {
      historico = historico.filter((q) => {
        const dataQuestao = new Date(q.timestamp);
        return dataQuestao >= dataLimite;
      });
    }
  }

  // Exibir histórico filtrado
  displayFilteredHistory(historico);

  console.log("🔍 Filtros aplicados. Resultados:", historico.length);
}

/**
 * Exibe histórico filtrado
 */
function displayFilteredHistory(historico) {
  const historicoDiv = document.getElementById("historico");
  if (!historicoDiv) return;

  if (historico.length === 0) {
    historicoDiv.innerHTML = `
      <div style="text-align: center; color: #999; padding: 20px;">
        Nenhuma questão encontrada com esses filtros
      </div>
    `;
    return;
  }

  let html = "";

  historico.forEach((questao) => {
    const tipo = QUESTION_TYPES[questao.tipo_questao] || questao.tipo_questao;
    const disciplina = questao.disciplina || "Geral";
    const preview = (questao.enunciado || "").substring(0, 80) + "...";
    const data = questao.data_criacao || "Sem data";

    html += `
      <div class="history-item" onclick="loadQuestionFromHistory('${
        questao.id
      }')">
        <div class="history-header">
          <span class="history-badge">${tipo}</span>
          <span class="history-date">${data}</span>
        </div>
        <div class="history-preview">${preview}</div>
        <div class="history-meta">
          <span>${disciplina}</span>
          ${questao.serie ? `<span>• ${questao.serie}</span>` : ""}
          ${questao.dificuldade ? `<span>• ${questao.dificuldade}</span>` : ""}
        </div>
        <div class="history-actions">
          <button class="btn-icon" onclick="deleteQuestion(event, '${
            questao.id
          }')" title="Excluir">
            🗑️
          </button>
        </div>
      </div>
    `;
  });

  historicoDiv.innerHTML = html;
}

/**
 * Limpa todos os filtros
 */
function clearFilters() {
  const filterTipo = document.getElementById("filterTipo");
  const filterDisciplina = document.getElementById("filterDisciplina");
  const filterData = document.getElementById("filterData");

  if (filterTipo) filterTipo.value = "";
  if (filterDisciplina) filterDisciplina.value = "";
  if (filterData) filterData.value = "";

  loadHistory();
  console.log("🧹 Filtros limpos");
}

/**
 * Busca questões por texto
 */
function searchQuestions() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  const termo = searchInput.value.toLowerCase().trim();

  if (!termo) {
    loadHistory();
    return;
  }

  const historico = Storage.getHistorico();
  const resultados = historico.filter((q) => {
    const enunciado = (q.enunciado || "").toLowerCase();
    const disciplina = (q.disciplina || "").toLowerCase();
    const tipo = (q.tipo_questao || "").toLowerCase();

    return (
      enunciado.includes(termo) ||
      disciplina.includes(termo) ||
      tipo.includes(termo)
    );
  });

  displayFilteredHistory(resultados);
  console.log(`🔍 Busca por "${termo}": ${resultados.length} resultados`);
}

// Disponibilizar funções globalmente
if (typeof window !== "undefined") {
  window.loadHistory = loadHistory;
  window.loadQuestionFromHistory = loadQuestionFromHistory;
  window.deleteQuestion = deleteQuestion;
  window.clearHistory = clearHistory;
  window.applyFilters = applyFilters;
  window.clearFilters = clearFilters;
  window.searchQuestions = searchQuestions;
}

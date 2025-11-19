// ========================================
// APLICAÇÃO PRINCIPAL - COM SUPABASE
// ========================================

// Variáveis globais
let currentQuestion = null;
let currentQuestions = [];

// ========================================
// INICIALIZAÇÃO PÓS-CONFIGURAÇÃO
// ========================================
function initializeApp() {
  console.log("🚀 New Nerd inicializado");

  // Inicializar Supabase
  if (typeof SupabaseClient !== "undefined") {
    SupabaseClient.init();
    console.log("✅ Supabase inicializado");
  }

  // Carregar tema salvo
  loadTheme();

  // Carregar histórico do Supabase
  if (typeof loadHistoryFromSupabase === "function") {
    loadHistoryFromSupabase();
  } else if (typeof loadHistory === "function") {
    loadHistory();
  }

  // Atualizar dashboard
  if (typeof updateDashboard === "function") {
    updateDashboard();
  }

  // Setup do formulário
  setupForm();

  console.log("✅ Configuração completa");
}

// A aplicação só inicia DEPOIS que a configuração estiver pronta.
document.addEventListener("configReady", initializeApp);

/**
 * Configura o formulário
 */
function setupForm() {
  const form = document.getElementById("questionForm");
  if (!form) return;

  form.addEventListener("submit", handleSubmit);
  console.log("📝 Formulário configurado");
}

/**
 * Handler principal do submit
 */
async function handleSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const loading = document.getElementById("loading");
  const result = document.getElementById("result");
  const error = document.getElementById("error");
  const generateBtn = document.getElementById("generateBtn");

  // Coletar dados do formulário
  const formData = {
    tema: document.getElementById("tema").value,
    disciplina: document.getElementById("disciplina").value,
    tipo: document.getElementById("tipo").value,
    serie: document.getElementById("serie").value,
    dificuldade: document.getElementById("dificuldade").value,
    criterios: document.getElementById("criterios")?.value || "",
  };

  const quantidade = parseInt(document.getElementById("quantidade").value) || 1;

  console.log("📝 Dados do formulário:", formData, "Quantidade:", quantidade);

  // UI feedback
  loading.classList.add("active");
  result.classList.remove("active");
  error.classList.remove("active");
  generateBtn.disabled = true;

  try {
    const params = Generator.buildParams(formData);

    if (quantidade === 1) {
      // ========================================
      // GERAR UMA QUESTÃO
      // ========================================
      const questao = await Generator.generateOne(params);

      // ⭐ SALVAR NO SUPABASE PRIMEIRO
      let questaoSalva = questao;
      if (typeof SupabaseClient !== "undefined" && SupabaseClient.initialized) {
        try {
          questaoSalva = await SupabaseClient.salvarQuestao(
            questao,
            CONFIG.PROFESSOR_ID
          );
          console.log("✅ Questão salva no Supabase:", questaoSalva.id);
        } catch (err) {
          console.warn(
            "⚠️ Erro ao salvar no Supabase, usando localStorage:",
            err
          );
          questaoSalva = Storage.salvarQuestao(questao);
        }
      } else {
        // Fallback para localStorage
        questaoSalva = Storage.salvarQuestao(questao);
      }

      // Setar como questão atual
      currentQuestion = questaoSalva;
      window.currentQuestion = questaoSalva;

      // Exibir
      displayQuestion(questaoSalva);

      // Atualizar histórico e dashboard
      if (typeof loadHistoryFromSupabase === "function") {
        loadHistoryFromSupabase();
      } else if (typeof loadHistory === "function") {
        loadHistory();
      }
      if (typeof updateDashboard === "function") updateDashboard();
    } else {
      // ========================================
      // GERAR MÚLTIPLAS QUESTÕES
      // ========================================
      const resultado = await Generator.generateMultiple(params, quantidade);
      currentQuestions = resultado.questoes || [];
      window.currentQuestions = currentQuestions;

      // ⭐ SALVAR TODAS NO SUPABASE EM LOTE
      if (
        typeof SupabaseClient !== "undefined" &&
        SupabaseClient.initialized &&
        currentQuestions.length > 0
      ) {
        try {
          const questoesSalvas = await SupabaseClient.salvarQuestaesEmLote(
            currentQuestions,
            CONFIG.PROFESSOR_ID
          );
          console.log(
            `✅ ${questoesSalvas.length} questões salvas no Supabase`
          );

          // Atualizar IDs das questões salvas
          currentQuestions = questoesSalvas;
          window.currentQuestions = questoesSalvas;
        } catch (err) {
          console.warn("⚠️ Erro ao salvar em lote no Supabase:", err);
          // Fallback: salvar uma por uma no localStorage
          currentQuestions.forEach((q) => Storage.salvarQuestao(q));
        }
      } else {
        // Fallback para localStorage
        currentQuestions.forEach((q) => Storage.salvarQuestao(q));
      }

      // Exibir todas as questões
      displayMultipleQuestions(resultado);

      // Atualizar histórico e dashboard
      if (typeof loadHistoryFromSupabase === "function") {
        loadHistoryFromSupabase();
      } else if (typeof loadHistory === "function") {
        loadHistory();
      }
      if (typeof updateDashboard === "function") updateDashboard();
    }
  } catch (err) {
    console.error("❌ Erro ao gerar questão:", err);
    error.textContent = err.message || CONFIG.MESSAGES.ERROR_GENERIC;
    error.classList.add("active");
  } finally {
    loading.classList.remove("active");
    generateBtn.disabled = false;
  }
}

/**
 * Carrega histórico do Supabase
 */
async function loadHistoryFromSupabase() {
  if (typeof SupabaseClient === "undefined" || !SupabaseClient.initialized) {
    console.warn("⚠️ Supabase não inicializado, carregando do localStorage");
    if (typeof loadHistory === "function") loadHistory();
    return;
  }

  try {
    const questoes = await SupabaseClient.carregarQuestoes(
      CONFIG.PROFESSOR_ID,
      { limit: 50 } // Limitar para performance
    );

    console.log(`📥 ${questoes.length} questões carregadas do Supabase`);

    // Exibir no histórico
    if (typeof displayHistoryFromData === "function") {
      displayHistoryFromData(questoes);
    } else if (typeof loadHistory === "function") {
      loadHistory();
    }
  } catch (error) {
    console.error("❌ Erro ao carregar do Supabase:", error);
    if (typeof loadHistory === "function") loadHistory();
  }
}

/**
 * Exibe histórico a partir de dados
 */
function displayHistoryFromData(questoes) {
  const historicoDiv = document.getElementById("historico");
  if (!historicoDiv) return;

  if (questoes.length === 0) {
    historicoDiv.innerHTML = `
      <div style="text-align: center; color: #999; padding: 20px;">
        Nenhuma questão gerada ainda
      </div>
    `;
    return;
  }

  let html = "";

  questoes.forEach((questao) => {
    const tipo = QUESTION_TYPES[questao.tipo_questao] || questao.tipo_questao;
    const disciplina = questao.disciplina || "Geral";
    const preview = (questao.enunciado || "").substring(0, 80) + "...";
    const data = questao.created_at
      ? new Date(questao.created_at).toLocaleString("pt-BR")
      : "Sem data";

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
          <button class="btn-icon" onclick="deleteQuestionFromSupabase(event, '${
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
 * Deleta questão do Supabase
 */
async function deleteQuestionFromSupabase(event, questionId) {
  if (event) event.stopPropagation();

  if (!confirm("🗑️ Tem certeza que deseja excluir esta questão?")) {
    return;
  }

  try {
    if (typeof SupabaseClient !== "undefined" && SupabaseClient.initialized) {
      const success = await SupabaseClient.deletarQuestao(questionId);
      if (success) {
        console.log("✅ Questão deletada");
        loadHistoryFromSupabase();
        if (typeof updateDashboard === "function") updateDashboard();
        alert("✅ Questão excluída com sucesso!");
      }
    } else {
      // Fallback localStorage
      Storage.removerQuestao(questionId);
      if (typeof loadHistory === "function") loadHistory();
      if (typeof updateDashboard === "function") updateDashboard();
    }
  } catch (error) {
    console.error("❌ Erro ao deletar:", error);
    alert("❌ Erro ao excluir questão");
  }
}

/**
 * Edita a resposta esperada de uma questão discursiva
 */
function editarResposta(questionId) {
  const questao = questionId
    ? Storage.getQuestaoById(questionId)
    : window.currentQuestion;

  if (!questao || !questao.resposta_esperada) {
    alert("❌ Questão não encontrada");
    return;
  }

  const respostaDiv = document.getElementById(`resposta-${questionId}`);
  if (!respostaDiv) return;

  const conteudoDiv = respostaDiv.querySelector(".resposta-content");
  if (!conteudoDiv) return;

  const respostaAtual = questao.resposta_esperada;

  // Criar textarea para edição
  const textarea = document.createElement("textarea");
  textarea.className = "edit-textarea";
  textarea.value = respostaAtual;
  textarea.rows = 8;
  textarea.style.width = "100%";
  textarea.style.padding = "10px";
  textarea.style.border = "2px solid #667eea";
  textarea.style.borderRadius = "6px";
  textarea.style.fontSize = "14px";
  textarea.style.fontFamily = "inherit";

  // Botões de ação
  const actions = document.createElement("div");
  actions.style.marginTop = "10px";
  actions.style.display = "flex";
  actions.style.gap = "10px";

  const btnSalvar = document.createElement("button");
  btnSalvar.textContent = "💾 Salvar";
  btnSalvar.className = "btn btn-small";
  btnSalvar.onclick = async () => {
    const novaResposta = textarea.value.trim();
    if (novaResposta) {
      questao.resposta_esperada = novaResposta;

      // Atualizar no Supabase se possível
      if (
        typeof SupabaseClient !== "undefined" &&
        SupabaseClient.initialized &&
        questionId
      ) {
        try {
          await SupabaseClient.atualizarQuestao(questionId, {
            resposta_esperada: novaResposta,
          });
          console.log("✅ Atualizado no Supabase");
        } catch (err) {
          console.warn("⚠️ Erro ao atualizar Supabase:", err);
          // Atualizar localStorage
          Storage.atualizarQuestao(questionId, {
            resposta_esperada: novaResposta,
          });
        }
      } else if (questionId) {
        // Fallback localStorage
        Storage.atualizarQuestao(questionId, {
          resposta_esperada: novaResposta,
        });
      }

      // Atualizar exibição
      conteudoDiv.textContent = novaResposta;
      conteudoDiv.style.display = "block";
      textarea.remove();
      actions.remove();

      alert("✅ Resposta atualizada!");
    }
  };

  const btnCancelar = document.createElement("button");
  btnCancelar.textContent = "❌ Cancelar";
  btnCancelar.className = "btn btn-small btn-secondary";
  btnCancelar.onclick = () => {
    conteudoDiv.style.display = "block";
    textarea.remove();
    actions.remove();
  };

  actions.appendChild(btnSalvar);
  actions.appendChild(btnCancelar);

  // Substituir conteúdo
  conteudoDiv.style.display = "none";
  respostaDiv.appendChild(textarea);
  respostaDiv.appendChild(actions);
  textarea.focus();
}

/**
 * Alterna tema dark/light
 */
function toggleTheme() {
  const body = document.body;
  const currentTheme = body.getAttribute("data-theme");
  const newTheme = currentTheme === "dark" ? "light" : "dark";

  body.setAttribute("data-theme", newTheme);
  Storage.setTema(newTheme);

  // Atualizar ícone do botão
  const themeToggle = document.querySelector(".theme-toggle");
  if (themeToggle) {
    themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙";
  }

  console.log("🎨 Tema alterado para:", newTheme);
}

/**
 * Carrega tema salvo
 */
function loadTheme() {
  const savedTheme = Storage.getTema();
  document.body.setAttribute("data-theme", savedTheme);

  const themeToggle = document.querySelector(".theme-toggle");
  if (themeToggle) {
    themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";
  }

  console.log("🎨 Tema carregado:", savedTheme);
}

/**
 * Toggle da sidebar
 */
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  sidebar.classList.toggle("collapsed");
  console.log("📂 Sidebar toggled");
}

// Disponibilizar funções globalmente
if (typeof window !== "undefined") {
  window.handleSubmit = handleSubmit;
  window.editarResposta = editarResposta;
  window.toggleTheme = toggleTheme;
  window.loadTheme = loadTheme;
  window.toggleSidebar = toggleSidebar;
  window.currentQuestion = currentQuestion;
  window.currentQuestions = currentQuestions;
  window.loadHistoryFromSupabase = loadHistoryFromSupabase;
  window.displayHistoryFromData = displayHistoryFromData;
  window.deleteQuestionFromSupabase = deleteQuestionFromSupabase;
}

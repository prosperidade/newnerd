// js/app.js

let currentQuestion = null;
let currentQuestions = [];
let appInitialized = false;

async function initializeApp() {
  if (appInitialized) return;
  if (!window.CONFIG_READY || !window.supabaseClient) {
    console.warn("⏳ Aguardando config/supabase para iniciar o app...");
    return;
  }

  appInitialized = true;
  console.log("🚀 New Nerd inicializado (professor)");

  if (typeof ensureProfessorAuth === "function") {
    const professor = await ensureProfessorAuth();
    if (!professor) {
      appInitialized = false; // permite nova tentativa após login
      return;
    }
  }

  if (typeof SupabaseClient !== "undefined") {
    SupabaseClient.init();
    console.log("✅ Supabase inicializado (SupabaseClient)");
  }

  loadTheme();

  if (typeof loadHistoryFromSupabase === "function") loadHistoryFromSupabase();
  else if (typeof loadHistory === "function") loadHistory();

  if (typeof updateDashboard === "function") updateDashboard();

  setupForm();
}

document.addEventListener("configReady", () => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp, {
      once: true,
    });
  } else {
    initializeApp();
  }
});

if (window.CONFIG_READY) initializeApp();

function setupForm() {
  const form = document.getElementById("questionForm");
  if (form) form.addEventListener("submit", handleSubmit);
}

window.switchMode = function (mode) {
  const individual = document.getElementById("individualPanel");
  const prova = document.getElementById("provaPanel");
  const tabs = document.querySelectorAll(".mode-tab");

  tabs.forEach((t) => {
    t.classList.remove("active");
    t.style.background = "#f5f5f5";
    t.style.color = "#666";
  });

  const activeBtn = mode === "individual" ? tabs[0] : tabs[1];
  if (activeBtn) {
    activeBtn.classList.add("active");
    activeBtn.style.background = "linear-gradient(135deg, #667eea, #764ba2)";
    activeBtn.style.color = "white";
  }

  if (mode === "individual") {
    individual.style.display = "block";
    prova.style.display = "none";
  } else {
    individual.style.display = "none";
    prova.style.display = "block";
  }
};

async function handleSubmit(e) {
  e.preventDefault();

  console.log("🧪 handleSubmit disparado");

  const loading = document.getElementById("loading");
  const result = document.getElementById("result");
  const error = document.getElementById("error");
  const generateBtn = document.getElementById("generateBtn");

  const formData = {
    tema: document.getElementById("tema").value,
    disciplina: document.getElementById("disciplina").value,
    tipo: document.getElementById("tipo").value,
    serie: document.getElementById("serie").value, // 🔴 Série para o aluno
    dificuldade: document.getElementById("dificuldade").value,
    criterios: document.getElementById("criterios")?.value || "",
  };

  const quantidade = parseInt(document.getElementById("quantidade").value) || 1;

  loading.classList.add("active");
  result.classList.remove("active");
  error.classList.remove("active");
  generateBtn.disabled = true;

  try {
    const params = Generator.buildParams(formData);
    let itemsToSave = [];

    if (quantidade === 1) {
      const questao = await Generator.generateOne(params);
      questao.serie = formData.serie;
      itemsToSave = [questao];

      currentQuestion = questao;
      window.currentQuestion = questao;

      displayQuestion(questao); // Usa display com menu completo
    } else {
      const resultado = await Generator.generateMultiple(params, quantidade);
      itemsToSave = resultado.questoes || [];
      itemsToSave.forEach((q) => (q.serie = formData.serie));

      currentQuestions = itemsToSave;
      window.currentQuestions = itemsToSave;

      displayMultipleQuestions(resultado);
    }

    // === SALVAR NO SUPABASE (INTEGRAÇÃO) ===
    if (
      typeof SupabaseClient !== "undefined" &&
      SupabaseClient.initialized &&
      itemsToSave.length > 0
    ) {
      try {
        const profId =
          (globalThis.currentProfessor && globalThis.currentProfessor.id) ||
          (typeof SupabaseClient !== "undefined"
            ? await SupabaseClient.getProfessorId()
            : null) ||
          CONFIG.PROFESSOR_ID ||
          "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

        const dbPayloads = itemsToSave.map((q) => ({
          professor_id: profId,
          serie: q.serie,
          disciplina: q.disciplina,
          tipo: q.tipo_questao,
          dificuldade: q.dificuldade,
          enunciado: q.enunciado,
          alternativas: q.alternativas ? JSON.stringify(q.alternativas) : null,
          gabarito: q.gabarito || q.resposta_esperada,
          justificativa: q.justificativa_gabarito,
        }));

        const { error: dbError } = await window.supabaseClient
          .from("questoes_geradas")
          .insert(dbPayloads);

        if (dbError) throw dbError;
        console.log(`✅ Salvo no banco para: ${formData.serie}`);
      } catch (saveErr) {
        console.error("Erro banco:", saveErr);
      }
    }

    // Atualiza Dashboard e Histórico
    if (typeof loadHistoryFromSupabase === "function")
      loadHistoryFromSupabase();
    if (typeof updateDashboard === "function") updateDashboard();
  } catch (err) {
    console.error("Erro:", err);
    error.textContent = err.message || "Erro desconhecido";
    error.classList.add("active");
  } finally {
    loading.classList.remove("active");
    generateBtn.disabled = false;
  }
}

// Funções de Tema
function toggleTheme() {
  const body = document.body;
  const current = body.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  body.setAttribute("data-theme", next);
  localStorage.setItem("nn-theme", next);
  const btn = document.querySelector(".theme-toggle");
  if (btn) btn.textContent = next === "dark" ? "☀️" : "🌙";
}

function loadTheme() {
  const saved = localStorage.getItem("nn-theme") || "light";
  document.body.setAttribute("data-theme", saved);
  const btn = document.querySelector(".theme-toggle");
  if (btn) btn.textContent = saved === "dark" ? "☀️" : "🌙";
}

function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("collapsed");
}

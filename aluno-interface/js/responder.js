// js/responder.js - Lógica de Resposta (Blindada)

let alunoPerfil = null;
let questaoAtual = null;
let inicioCronometro = null;
let timerInterval = null;

// Função principal de inicialização
async function initResponder() {
  console.log("🚀 Iniciando responder.js...");

  // 1. Verifica Auth
  const user = await verificarAuth();
  if (!user) {
    console.warn("Usuário não autenticado. Redirecionando...");
    // O próprio verificarAuth já redireciona, mas por segurança:
    // window.location.href = "login.html";
    return;
  }

  // Preenche nome no topo
  const nomeEl = document.getElementById("alunoNome");
  if (nomeEl) nomeEl.textContent = user.nome || user.email;
  alunoPerfil = user;

  // 2. Pega ID da URL
  const params = new URLSearchParams(window.location.search);
  const questaoId = params.get("questao_id");

  if (!questaoId) {
    alert("Erro: Nenhuma questão selecionada.");
    window.location.href = "painel.html";
    return;
  }

  // 3. Busca a questão no banco
  await carregarQuestao(questaoId);
}

// Espera o Config avisar que o Supabase está pronto
if (window.supabaseClient) {
  initResponder();
} else {
  document.addEventListener("configReady", initResponder);
}

async function carregarQuestao(id) {
  try {
    const { data: questao, error } = await window.supabaseClient
      .from("questoes_geradas")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !questao) throw new Error("Questão não encontrada.");

    questaoAtual = questao;
    renderizarTela(questao);

    // Inicia cronômetro
    inicioCronometro = Date.now();
    startTimer("timer");

    // Ativa o formulário
    const form = document.getElementById("respostaForm");
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        enviarResposta();
      };
    }
  } catch (err) {
    console.error("Erro ao carregar:", err);
    document.getElementById("enunciado").innerHTML = `
      <p style="color:red; text-align:center;">Erro ao carregar questão.<br>Tente voltar ao painel.</p>
    `;
  }
}

function renderizarTela(q) {
  // Badges
  setText(
    "tipoQuestao",
    (q.tipo_questao || "Questão").replace(/_/g, " ").toUpperCase()
  );
  setText("disciplina", q.disciplina || "");
  setText("serie", q.serie || "");

  // Enunciado
  const enunEl = document.getElementById("enunciado");
  if (enunEl) enunEl.textContent = q.enunciado;

  // Opções
  montarOpcoes(q);
}

function montarOpcoes(q) {
  const container = document.getElementById("opcoes");
  container.innerHTML = "";

  let alternativas = [];
  // Tenta parsear JSON se for string, ou usa direto se for array
  try {
    if (Array.isArray(q.alternativas)) alternativas = q.alternativas;
    else if (typeof q.alternativas === "string")
      alternativas = JSON.parse(q.alternativas);
    else if (q.opcoes) alternativas = q.opcoes; // Legado
  } catch (e) {
    // Se falhar o JSON, tenta quebrar por linhas se for string
    if (typeof q.alternativas === "string")
      alternativas = q.alternativas.split("\n");
  }

  const tipo = (q.tipo_questao || "").toLowerCase();

  // Lógica de renderização
  if (tipo.includes("multipla") && alternativas.length > 0) {
    alternativas.forEach((opt) => {
      const div = document.createElement("div");
      div.className = "option-modern";
      // Tratamento para aspas dentro do texto
      const safeOpt = String(opt).replace(/"/g, "&quot;");

      div.innerHTML = `
        <label style="display:flex; align-items:center; width:100%; cursor:pointer;">
          <input type="radio" name="resposta" value="${safeOpt}">
          <span class="radio-custom"></span>
          <span class="option-text" style="margin-left:10px;">${opt}</span>
        </label>
      `;
      container.appendChild(div);
    });
  } else if (tipo.includes("verdadeiro") || tipo.includes("falso")) {
    // V ou F
    ["Verdadeiro", "Falso"].forEach((val) => {
      const div = document.createElement("div");
      div.className = "option-modern";
      div.innerHTML = `
        <label style="display:flex; align-items:center; width:100%; cursor:pointer;">
          <input type="radio" name="resposta" value="${val}">
          <span class="radio-custom"></span>
          <span class="option-text" style="margin-left:10px;">${val}</span>
        </label>
      `;
      container.appendChild(div);
    });
  } else {
    // Discursiva
    container.innerHTML = `
      <textarea id="resposta_texto" class="form-textarea" 
      placeholder="Digite sua resposta aqui..." style="width:100%; min-height:150px;"></textarea>
    `;
  }
}

async function enviarResposta() {
  const btn = document.getElementById("btnEnviar");
  btn.disabled = true;
  btn.textContent = "Enviando...";

  if (timerInterval) clearInterval(timerInterval);
  const tempoGasto = Math.round((Date.now() - inicioCronometro) / 1000);

  // Captura resposta
  let respostaFinal = "";
  const radio = document.querySelector('input[name="resposta"]:checked');
  const texto = document.getElementById("resposta_texto");

  if (radio) respostaFinal = radio.value;
  else if (texto) respostaFinal = texto.value;

  if (!respostaFinal) {
    alert("Por favor, responda a questão.");
    btn.disabled = false;
    btn.textContent = "Enviar Resposta";
    return;
  }

  try {
    const payload = {
      aluno_id: alunoPerfil.id,
      questao_id: questaoAtual.id,
      resposta_alternativa: radio ? respostaFinal : null,
      resposta_texto: radio ? respostaFinal : respostaFinal, // Salva nos dois por garantia
      tempo_segundos: tempoGasto,
      status_correcao: "pendente",
    };

    const { data, error } = await window.supabaseClient
      .from("respostas_alunos")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    // Sucesso
    window.location.href = `resultado.html?resposta_id=${data.id}`;
  } catch (err) {
    console.error("Erro ao enviar:", err);
    alert("Erro ao enviar resposta. Tente novamente.");
    btn.disabled = false;
    btn.textContent = "Enviar Resposta";
  }
}

function startTimer(id) {
  const el = document.getElementById(id);
  const start = Date.now();
  timerInterval = setInterval(() => {
    const totalSec = Math.floor((Date.now() - start) / 1000);
    const m = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, "0");
    const s = (totalSec % 60).toString().padStart(2, "0");
    if (el) el.textContent = `⏱️ ${m}:${s}`;
  }, 1000);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

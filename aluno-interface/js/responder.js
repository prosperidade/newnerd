// ====================================================================
// RESPONDER.JS - Carrega questão, registra resposta e envia p/ n8n
// Depende de: window.supabase (CDN), CONFIG, supabaseClient (auth.js)
// ====================================================================

let alunoPerfil = null;
let questao = null;
let inicioCronometro = null;

function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function voltarPainel() {
  window.location.href = "painel.html";
}

function initializeResponder() {
  document.addEventListener("DOMContentLoaded", async () => {
    const user = await verificarAuth();
    if (!user) return;

    // Preenche nome/email no topo
    const alvo = document.getElementById("alunoNome");
    if (alvo) alvo.textContent = user.email ?? "Aluno";

    // Busca perfil do aluno
    const { data: perfil, error: perfErr } = await supabaseClient
      .from("alunos")
      .select("*")
      .eq("email", user.email)
      .single();

    if (perfErr || !perfil) {
      console.error("Aluno não encontrado na tabela 'alunos':", perfErr);
      alert("Seu usuário não está vinculado a um cadastro de aluno.");
      return;
    }
    alunoPerfil = perfil;

    // Carrega questão
    const questaoId = getParam("questao_id");
    if (!questaoId) {
      alert("Questão não informada.");
      return;
    }
    const { data: q, error: qErr } = await supabaseClient
      .from("questoes_geradas")
      .select("*")
      .eq("id", questaoId)
      .single();

    if (qErr || !q) {
      console.error("Erro ao carregar questão:", qErr);
      alert("Não foi possível carregar a questão.");
      return;
    }
    questao = q;

    // Preenche cabeçalho
    setText("tipoQuestao", (questao.tipo_questao || "").replace("_", " "));
    setText("disciplina", questao.disciplina || "");
    setText("serie", questao.serie || "");
    const enunEl = document.getElementById("enunciado");
    if (enunEl) enunEl.textContent = questao.enunciado || "—";

    // Monta opções
    montarOpcoes(questao);

    // Cronômetro simples
    inicioCronometro = Date.now();
    startTimer("timer");

    // Submit
    const form = document.getElementById("respostaForm");
    if (form) {
      form.addEventListener("submit", handleSubmit);
    }
  });
}

document.addEventListener("configReady", initializeResponder);

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function montarOpcoes(q) {
  const cont = document.getElementById("opcoes");
  if (!cont) return;
  cont.innerHTML = "";

  const tipo = (q.tipo_questao || "").toLowerCase();

  // tenta achar alternativas em vários campos possíveis
  let alternativas =
    q.alternativas || q.opcoes || q.opcoes_json || q.alternativas_json || [];

  if (typeof alternativas === "string") {
    try {
      alternativas = JSON.parse(alternativas);
    } catch {
      alternativas = alternativas
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  if (tipo.includes("multipla")) {
    if (!Array.isArray(alternativas) || alternativas.length === 0) {
      // fallback: campo único
      cont.innerHTML = `<textarea id="resp_discursiva" class="input" placeholder="Digite sua resposta..."></textarea>`;
      return;
    }
    cont.innerHTML = alternativas
      .map(
        (opt, i) => `
        <label class="option-modern">
          <input type="radio" name="resp_opcao" value="${escapeHtml(
            String(opt)
          )}">
          <span class="radio-custom"></span>
          <span class="option-text">${escapeHtml(String(opt))}</span>
        </label>`
      )
      .join("");
  } else if (tipo.includes("verdadeiro") || tipo.includes("falso")) {
    cont.innerHTML = `
      <label class="option-modern">
        <input type="radio" name="resp_opcao" value="Verdadeiro">
        <span class="radio-custom"></span>
        <span class="option-text">Verdadeiro</span>
      </label>
      <label class="option-modern">
        <input type="radio" name="resp_opcao" value="Falso">
        <span class="radio-custom"></span>
        <span class="option-text">Falso</span>
      </label>`;
  } else if (tipo.includes("associacao")) {
    // placeholder simples (customizar depois)
    cont.innerHTML = `<textarea id="resp_discursiva" class="input" placeholder="Descreva as associações..."></textarea>`;
  } else {
    // discursiva / default
    cont.innerHTML = `<textarea id="resp_discursiva" class="input" placeholder="Digite sua resposta..."></textarea>`;
  }
}

async function handleSubmit(e) {
  e.preventDefault();

  const btn = document.querySelector(".btn-submit");
  if (btn) btn.disabled = true;

  const tempoSeg = Math.max(
    1,
    Math.round((Date.now() - (inicioCronometro || Date.now())) / 1000)
  );

  // coleta resposta
  const sel = document.querySelector('input[name="resp_opcao"]:checked');
  const txt = document.getElementById("resp_discursiva");
  const respostaValor = sel ? sel.value : (txt && txt.value) || "";

  if (!respostaValor) {
    alert("Por favor, selecione ou escreva uma resposta.");
    if (btn) btn.disabled = false;
    return;
  }

  const payload = {
    aluno_id: alunoPerfil.id,
    aluno_email: alunoPerfil.email,
    questao_id: questao.id,
    tipo_questao: questao.tipo_questao,
    resposta: respostaValor,
    tempo_segundos: tempoSeg,
  };

  try {
    // Envia para o n8n (corrigir CORS no seu webhook se necessário)
    const resp = await fetch(CONFIG.WEBHOOK_CORRECAO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) throw new Error("Falha ao enviar para o corretor.");
    const out = await resp.json();

    // Esperado: { resposta_id: "<uuid>" }
    const respostaId = out?.resposta_id || out?.id;
    if (respostaId) {
      window.location.href = `resultado.html?resposta_id=${respostaId}`;
      return;
    }

    // Se não vier id, tenta ao menos direcionar ao painel
    alert("Resposta enviada. Aguarde a correção.");
    voltarPainel();
  } catch (err) {
    console.error("Erro ao enviar resposta:", err);
    alert("Não foi possível enviar sua resposta. Tente novamente.");
    if (btn) btn.disabled = false;
  }
}

// Utilidades
function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function startTimer(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = Date.now();
  const it = setInterval(() => {
    const sec = Math.floor((Date.now() - start) / 1000);
    const min = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    el.textContent = `⏱️ ${min}:${s}`;
  }, 1000);
}

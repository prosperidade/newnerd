// js/questao.js - Versão Estável e Simplificada

let aluno = null;
let todasQuestoes = [];
let todasRespostas = [];
let questaoAtual = null;
let timerInterval = null;
let tempoInicio = null;

// --- INICIALIZAÇÃO ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 JS de Questões Iniciado");

  // Aguarda auth e config
  if (!window.supabaseClient) {
    console.warn("⏳ Aguardando Supabase...");
    // Pequeno delay para garantir carregamento
    await new Promise((r) => setTimeout(r, 500));
  }

  const user = await verificarAuth();
  if (!user) return;

  try {
    const { data: perfil, error } = await window.supabaseClient
      .from("alunos")
      .select("*")
      .eq("email", user.email)
      .single();

    if (error || !perfil) {
      console.error("Perfil não encontrado:", error);
      alert("Erro ao carregar perfil do aluno.");
      return;
    }

    aluno = perfil;
    const elNome = document.getElementById("alunoNome");
    if (elNome) elNome.textContent = aluno.nome || "Aluno";

    await carregarDados();
  } catch (e) {
    console.error("Erro fatal init:", e);
  }
});

// --- CARREGAMENTO ---
async function carregarDados() {
  const grid = document.getElementById("questoesGrid");

  try {
    // 1. Minhas Respostas
    const { data: resps } = await window.supabaseClient
      .from("respostas_alunos")
      .select("*")
      .eq("aluno_id", aluno.id);
    todasRespostas = resps || [];

    // 2. Questões da Série
    let query = window.supabaseClient
      .from("questoes_geradas")
      .select("*")
      .eq("serie", aluno.serie)
      .order("created_at", { ascending: false });

    if (aluno.professor_id) {
      query = query.eq("professor_id", aluno.professor_id);
    }

    const { data: quests, error } = await query;
    if (error) throw error;

    todasQuestoes = quests || [];
    console.log(`✅ Carregado: ${todasQuestoes.length} questões.`);

    renderizarGrid(todasQuestoes);
    atualizarStats();
  } catch (err) {
    console.error("Erro carregamento:", err);
    if (grid)
      grid.innerHTML =
        '<p style="text-align:center; color:red;">Erro ao carregar dados.</p>';
  }
}

// --- GRID ---
function renderizarGrid(lista) {
  const grid = document.getElementById("questoesGrid");
  if (!grid) return;
  grid.innerHTML = "";

  if (lista.length === 0) {
    grid.innerHTML =
      '<div class="empty-state"><h3>Nenhuma atividade</h3></div>';
    return;
  }

  lista.forEach((q) => {
    const resposta = todasRespostas.find((r) => r.questao_id === q.id);
    const feita = !!resposta;

    const card = document.createElement("div");
    card.className = `action-card ${feita ? "card-respondida" : ""}`;
    // Força estilo para garantir visualização
    card.style.cssText =
      "background:white; padding:20px; border-radius:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05); margin-bottom:15px; border:1px solid #eee; position:relative;";

    const resumo = q.enunciado
      ? q.enunciado.length > 80
        ? q.enunciado.substring(0, 80) + "..."
        : q.enunciado
      : "Sem texto";

    let statusHtml = `<span style="color:#f57c00; font-weight:bold; font-size:0.8em;">Pendente</span>`;
    if (feita) {
      const nota = Number(resposta.nota || 0).toFixed(1);
      const cor = nota >= 6 ? "green" : "red";
      statusHtml = `<span style="color:${cor}; font-weight:bold;">Nota: ${nota}</span>`;
    }

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
         <span class="badge" style="background:#eee; color:#555; font-size:0.7em; padding:2px 8px; border-radius:4px;">${
           q.disciplina
         }</span>
         ${statusHtml}
      </div>
      <h3 style="font-size:1rem; margin:0 0 15px 0; color:#333;">${resumo}</h3>
      <button class="btn-login" style="width:100%; padding:8px; font-size:0.9rem;">
         ${feita ? "Ver Correção" : "Responder"}
      </button>
    `;

    card.onclick = () => {
      if (feita) carregarResultado(resposta, q);
      else abrirQuestao(q);
    };

    grid.appendChild(card);
  });
}

// --- ABRIR QUESTÃO ---
function abrirQuestao(q) {
  questaoAtual = q;
  console.log("📖 Abrindo:", q.id);

  document.getElementById("q-disciplina").textContent = q.disciplina || "Geral";
  document.getElementById("q-serie").textContent = q.serie || "";

  // Tratamento seguro do enunciado
  const textoEnunciado = q.enunciado || "Enunciado indisponível.";
  document.getElementById("q-enunciado").innerHTML = textoEnunciado.replace(
    /\n/g,
    "<br>"
  );

  const container = document.getElementById("q-opcoes");
  container.innerHTML = "";

  const tipo = (q.tipo || q.tipo_questao || "").toLowerCase();

  // 1. Múltipla Escolha / VF
  if (
    tipo.includes("multipla") ||
    tipo.includes("verdadeiro") ||
    tipo.includes("falso")
  ) {
    let opcoes = [];
    if (tipo.includes("multipla")) {
      try {
        opcoes =
          typeof q.alternativas === "string"
            ? JSON.parse(q.alternativas)
            : q.alternativas;
      } catch (e) {
        opcoes = [];
      }
    } else {
      opcoes = ["Verdadeiro", "Falso"];
    }

    if (Array.isArray(opcoes)) {
      opcoes.forEach((opt) => {
        const valor = typeof opt === "object" ? opt.texto : opt;
        const letra = typeof opt === "object" ? opt.letra : "";

        container.innerHTML += `
                <label style="display:flex; gap:10px; padding:12px; border:1px solid #eee; border-radius:8px; margin-bottom:8px; cursor:pointer; align-items:center;">
                    <input type="radio" name="resp" value="${valor}" style="transform:scale(1.2);">
                    <span style="font-size:1rem;">${
                      letra ? `<b>${letra})</b> ` : ""
                    }${valor}</span>
                </label>`;
      });
    }
  }
  // 2. Discursiva
  else {
    container.innerHTML = `
        <textarea id="resp-texto" 
        placeholder="Digite sua resposta aqui..." 
        style="width:100%; height:150px; padding:15px; border:1px solid #ccc; border-radius:8px; font-size:1rem; resize:vertical;"></textarea>
    `;
  }

  // Timer
  tempoInicio = Date.now();
  startTimer();

  // BIND SIMPLIFICADO (Sem cloneNode para evitar perda de referência)
  const form = document.getElementById("form-resposta");
  // Remove listener anterior sobrescrevendo o onsubmit
  form.onsubmit = async function (e) {
    e.preventDefault();
    await enviarResposta();
  };

  trocarView("view-responder");
}

// --- ENVIAR (LÓGICA DE NUVEM) ---
async function enviarResposta() {
  const btn = document.querySelector("#form-resposta button");

  let val = "";
  const radio = document.querySelector('input[name="resp"]:checked');
  const text = document.getElementById("resp-texto");
  if (radio) val = radio.value;
  else if (text) val = text.value;

  if (!val || val.trim() === "") {
    alert("Por favor, responda a questão!");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Salvando...";

  if (timerInterval) clearInterval(timerInterval);
  const tempo = Math.round((Date.now() - tempoInicio) / 1000);

  try {
    // 1. Salva Pendente
    const payload = {
      aluno_id: aluno.id,
      questao_id: questaoAtual.id,
      resposta_alternativa: radio ? val : null,
      resposta_texto: val,
      tempo_segundos: tempo,
      status_correcao: "pendente",
    };

    const { data: respSalva, error } = await window.supabaseClient
      .from("respostas_alunos")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    console.log("💾 Salvo localmente:", respSalva.id);

    // 2. Chama IA na Nuvem
    btn.textContent = "Corrigindo com IA...";

    const correcaoPayload = {
      questao: questaoAtual.enunciado,
      tipo: questaoAtual.tipo || questaoAtual.tipo_questao,
      gabarito_oficial:
        questaoAtual.gabarito ||
        questaoAtual.resposta_esperada ||
        "Analisar coerência",
      resposta_aluno: val,
    };

    console.log("📡 Chamando Edge Function...");
    const { data: iaResult, error: iaError } =
      await window.supabaseClient.functions.invoke("correct-answer", {
        body: correcaoPayload,
      });

    if (iaError) {
      console.warn("⚠️ IA falhou (Offline ou Timeout):", iaError);
      alert(
        "Resposta salva! A correção automática falhou, mas o professor poderá corrigir depois."
      );
    } else {
      console.log("🤖 IA Retornou:", iaResult);

      // 3. Atualiza Nota
      await window.supabaseClient
        .from("respostas_alunos")
        .update({
          nota: iaResult.nota,
          feedback: iaResult.feedback,
          pontos_melhoria: iaResult.pontos_melhoria,
          correta: iaResult.correta,
          status_correcao: "concluido",
          corrigido_por: "ia_edge",
        })
        .eq("id", respSalva.id);

      // Atualiza memória local
      Object.assign(respSalva, iaResult, { status_correcao: "concluido" });
    }

    // 4. Sucesso
    await carregarDados();
    carregarResultado(respSalva, questaoAtual);
  } catch (err) {
    console.error("❌ Erro fatal:", err);
    alert("Erro ao salvar: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirmar Resposta";
  }
}

// --- RESULTADOS E UTILS ---
function carregarResultado(resposta, questao) {
  const nota = Number(resposta.nota || 0);

  document.getElementById("res-nota").textContent = nota.toFixed(1);
  document.getElementById("res-msg").textContent =
    nota >= 6 ? "Mandou bem!" : "Estude mais um pouco.";
  document.getElementById("res-emoji").textContent = nota >= 6 ? "🎉" : "📚";

  document.getElementById("res-feedback").textContent =
    resposta.feedback || "Aguardando correção...";

  const boxGab = document.getElementById("box-gabarito");
  if (boxGab) {
    if (questao.gabarito || questao.resposta_esperada) {
      boxGab.style.display = "block";
      document.getElementById("res-gabarito-texto").textContent =
        questao.gabarito || questao.resposta_esperada;
      document.getElementById("res-justificativa").textContent =
        questao.justificativa_gabarito || "";
    } else {
      boxGab.style.display = "none";
    }
  }

  // Mostra Pontos de Melhoria se existirem
  const boxMelhoria = document.getElementById("box-melhoria");
  if (boxMelhoria) {
    if (resposta.pontos_melhoria) {
      boxMelhoria.style.display = "block";
      document.getElementById("res-melhoria").textContent =
        resposta.pontos_melhoria;
    } else {
      boxMelhoria.style.display = "none";
    }
  }

  trocarView("view-resultado");
}

function trocarView(id) {
  document
    .querySelectorAll(".view-section")
    .forEach((el) => el.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo(0, 0);
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  const el = document.getElementById("timer");
  timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - tempoInicio) / 1000);
    const min = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    if (el) el.textContent = `${min}:${sec}`;
  }, 1000);
}

function atualizarStats() {
  const elTotal = document.getElementById("totalQuestoes");
  const elFeitos = document.getElementById("totalRespondidas");
  const elMedia = document.getElementById("mediaNotas");

  if (elTotal) elTotal.textContent = todasQuestoes.length;
  if (elFeitos) elFeitos.textContent = todasRespostas.length;

  if (todasRespostas.length > 0) {
    const soma = todasRespostas.reduce(
      (acc, r) => acc + (Number(r.nota) || 0),
      0
    );
    if (elMedia)
      elMedia.textContent = (soma / todasRespostas.length).toFixed(1);
  } else {
    if (elMedia) elMedia.textContent = "-";
  }
}

window.aplicarFiltros = function () {
  const disc = document.getElementById("filtroDisciplina").value;
  const tipo = document.getElementById("filtroTipo").value;

  const filtradas = todasQuestoes.filter((q) => {
    if (disc && q.disciplina !== disc) return false;
    if (tipo && !String(q.tipo_questao || q.tipo).includes(tipo)) return false;
    return true;
  });
  renderizarGrid(filtradas);
};

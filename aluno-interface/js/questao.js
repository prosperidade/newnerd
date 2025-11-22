// js/questao.js - Lógica Unificada (Corrigida V/F e Discursivas)

let aluno = null;
let todasQuestoes = [];
let todasRespostas = [];
let questaoAtual = null;
let timerInterval = null;
let tempoInicio = null;

// --- INICIALIZAÇÃO ---
document.addEventListener("DOMContentLoaded", async () => {
  const user = await verificarAuth();
  if (!user) return;

  const { data: perfil } = await window.supabaseClient
    .from("alunos")
    .select("*")
    .eq("email", user.email)
    .single();

  if (!perfil) {
    alert("Erro: Perfil de aluno não encontrado.");
    return;
  }

  aluno = perfil;
  document.getElementById("alunoNome").textContent = aluno.nome || "Aluno";

  await carregarDados();
});

// --- CARREGAMENTO ---
async function carregarDados() {
  const grid = document.getElementById("questoesGrid");

  try {
    const { data: resps } = await window.supabaseClient
      .from("respostas_alunos")
      .select("*")
      .eq("aluno_id", aluno.id);
    todasRespostas = resps || [];

    let query = window.supabaseClient
      .from("questoes_geradas")
      .select("*")
      .eq("serie", aluno.serie)
      .order("created_at", { ascending: false });

    if (aluno.professor_id)
      query = query.eq("professor_id", aluno.professor_id);

    const { data: quests, error } = await query;
    if (error) throw error;
    todasQuestoes = quests || [];

    renderizarGrid(todasQuestoes);
    atualizarStats();
  } catch (err) {
    console.error("Erro carregamento:", err);
    grid.innerHTML =
      '<p style="text-align:center; color:red;">Erro ao carregar dados.</p>';
  }
}

// --- GRID ---
function renderizarGrid(lista) {
  const grid = document.getElementById("questoesGrid");
  grid.innerHTML = "";

  if (lista.length === 0) {
    grid.innerHTML =
      '<p style="text-align:center; padding:40px; color:#777; grid-column:1/-1;">Nenhuma atividade disponível.</p>';
    return;
  }

  lista.forEach((q) => {
    const resposta = todasRespostas.find((r) => r.questao_id === q.id);
    const feita = !!resposta;

    const card = document.createElement("div");
    card.className = `action-card ${feita ? "card-respondida" : ""}`;
    card.style.textAlign = "left";
    card.style.display = "flex";
    card.style.flexDirection = "column";

    const disciplina = q.disciplina || "Geral";
    const resumo =
      q.enunciado && q.enunciado.length > 80
        ? q.enunciado.substring(0, 80) + "..."
        : q.enunciado || "Questão sem texto";
    const tipoRaw = q.tipo || q.tipo_questao || "";
    const tipoFmt = tipoRaw.replace(/_/g, " ");

    card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <span class="badge badge-disciplina" style="font-size:0.7rem">${disciplina}</span>
                ${
                  feita
                    ? `<span style="color:#2f855a; font-weight:bold; font-size:0.8rem;">Nota: ${Number(
                        resposta.nota || 0
                      ).toFixed(1)}</span>`
                    : `<span style="color:#f57c00; font-size:0.8rem;">Pendente</span>`
                }
            </div>
            <h3 style="font-size:1rem; margin-bottom:15px; color:#333; flex-grow:1;">${resumo}</h3>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                <small style="color:#888; font-size:0.75rem; text-transform:capitalize;">${tipoFmt}</small>
                <button class="btn-login" style="width:auto; padding:6px 15px; font-size:0.8rem; margin:0;">
                    ${feita ? "Ver Feedback" : "Responder"}
                </button>
            </div>
        `;

    card.onclick = () => {
      if (feita) carregarResultado(resposta, q);
      else abrirQuestao(q);
    };

    grid.appendChild(card);
  });
}

// --- RESPONDER (LÓGICA CORRIGIDA) ---
function abrirQuestao(q) {
  questaoAtual = q;

  document.getElementById("q-disciplina").textContent = q.disciplina || "Geral";
  document.getElementById("q-serie").textContent = q.serie || "";
  document.getElementById("q-enunciado").textContent = q.enunciado;

  const container = document.getElementById("q-opcoes");
  container.innerHTML = "";

  // Pega o tipo do banco
  const tipo = (q.tipo || q.tipo_questao || "").toLowerCase();

  // Lógica Decisiva de Renderização
  if (tipo.includes("verdadeiro") || tipo.includes("falso")) {
    // === CASO 1: VERDADEIRO OU FALSO (Manual) ===
    ["Verdadeiro", "Falso"].forEach((opt) => {
      container.innerHTML += `
                <label class="option-modern">
                    <input type="radio" name="resp" value="${opt}">
                    <span class="radio-custom"></span>
                    <span class="option-text" style="margin-left:10px;">${opt}</span>
                </label>`;
    });
  } else if (tipo.includes("multipla")) {
    // === CASO 2: MÚLTIPLA ESCOLHA (Usa JSON do banco) ===
    let alts = [];
    try {
      if (Array.isArray(q.alternativas)) alts = q.alternativas;
      else if (typeof q.alternativas === "string")
        alts = JSON.parse(q.alternativas);
    } catch (e) {
      console.warn("Sem alternativas válidas");
    }

    if (alts.length > 0) {
      alts.forEach((opt) => {
        const safeOpt = String(opt).replace(/"/g, "&quot;");
        container.innerHTML += `
                    <label class="option-modern">
                        <input type="radio" name="resp" value="${safeOpt}">
                        <span class="radio-custom"></span>
                        <span class="option-text" style="margin-left:10px;">${opt}</span>
                    </label>`;
      });
    } else {
      container.innerHTML =
        "<p style='color:red'>Erro: Questão múltipla escolha sem alternativas cadastradas.</p>";
    }
  } else {
    // === CASO 3: DISCURSIVA (Textarea) ===
    container.innerHTML = `
            <textarea id="resp-texto" class="form-textarea" 
            placeholder="Digite sua resposta completa aqui..." 
            style="min-height:150px; width:100%; padding:15px; border:1px solid #ccc; border-radius:8px;"></textarea>`;
  }

  tempoInicio = Date.now();
  startTimer();

  document.getElementById("form-resposta").onsubmit = async (e) => {
    e.preventDefault();
    await enviarResposta();
  };

  trocarView("view-responder");
}
async function enviarResposta() {
  const btn = document.querySelector("#form-resposta button");

  // 1. Validação (Garante que tem resposta)
  let val = "";
  const radio = document.querySelector('input[name="resp"]:checked');
  const text = document.getElementById("resp-texto");

  if (radio) val = radio.value;
  else if (text) val = text.value;

  if (!val || val.trim() === "") {
    alert("Por favor, responda a questão.");
    return;
  }

  // Trava botão
  btn.disabled = true;
  btn.textContent = "Salvando...";

  if (timerInterval) clearInterval(timerInterval);
  const tempo = Math.round((Date.now() - tempoInicio) / 1000);

  try {
    // 2. CRIA O REGISTRO NO BANCO (Como Pendente)
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

    console.log("✅ Resposta inicial salva. ID:", respSalva.id);

    // 3. CHAMA A IA (N8N)
    btn.textContent = "Corrigindo com IA...";

    if (CONFIG.WEBHOOK_CORRECAO) {
      try {
        const n8nResp = await fetch(CONFIG.WEBHOOK_CORRECAO, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questao_id: questaoAtual.id,
            aluno_id: aluno.id,
            resposta: val,
            // Extras
            resposta_id: respSalva.id,
            tipo_questao: questaoAtual.tipo || questaoAtual.tipo_questao,
            gabarito: questaoAtual.gabarito,
          }),
        });

        if (n8nResp.ok) {
          const dadosIA = await n8nResp.json();
          console.log("🤖 IA Respondeu:", dadosIA);

          // === A CORREÇÃO MÁGICA É AQUI ===
          // Agora vamos GRAVAR o resultado da IA no banco imediatamente
          const { error: updateError } = await window.supabaseClient
            .from("respostas_alunos")
            .update({
              nota: dadosIA.nota,
              feedback: dadosIA.feedback,
              pontos_melhoria: dadosIA.pontos_melhoria,
              correta: dadosIA.correta,
              status_correcao: "concluido", // Marca como pronto!
              corrigido_por: "ia_openai",
            })
            .eq("id", respSalva.id);

          if (updateError) console.error("Erro ao salvar nota:", updateError);

          // Atualiza o objeto local para mostrar na tela agora
          respSalva.nota = dadosIA.nota;
          respSalva.feedback = dadosIA.feedback;
          respSalva.pontos_melhoria = dadosIA.pontos_melhoria;
          respSalva.correta = dadosIA.correta;
          respSalva.status_correcao = "concluido";
        }
      } catch (eN8N) {
        console.warn("⚠️ IA falhou ou offline:", eN8N);
      }
    }

    // 4. MOSTRA O RESULTADO
    await carregarDados(); // Atualiza a lista de fundo
    carregarResultado(respSalva, questaoAtual);
  } catch (err) {
    console.error("❌ Erro fatal:", err);
    alert("Erro ao salvar resposta. Tente novamente.");
    btn.disabled = false;
    btn.textContent = "Confirmar Resposta";
  }
}
function carregarResultado(resposta, questao) {
  const nota = Number(resposta.nota || 0);
  const aprovado = nota >= 6;
  const pendente =
    resposta.status_correcao === "pendente" && !resposta.feedback;

  // 1. Cabeçalho
  document.getElementById("res-emoji").textContent = pendente
    ? "⏳"
    : aprovado
    ? "🎉"
    : "📚";
  document.getElementById("res-msg").textContent = pendente
    ? "Aguardando Correção..."
    : aprovado
    ? "Parabéns!"
    : "Continue Estudando";
  document.getElementById("res-nota").textContent = pendente
    ? "..."
    : nota.toFixed(1);

  // 2. Feedback IA
  document.getElementById("res-feedback").textContent =
    resposta.feedback ||
    "A inteligência artificial está analisando sua resposta...";

  // 3. [NOVO] Gabarito Oficial
  // Usamos 'questao' (que vem do clique no card) ou 'questaoAtual' (se acabou de responder)
  const dadosQuestao = questao || questaoAtual;
  const boxGabarito = document.getElementById("box-gabarito");

  if (dadosQuestao && dadosQuestao.gabarito) {
    boxGabarito.style.display = "block";
    document.getElementById("res-gabarito-texto").textContent =
      dadosQuestao.gabarito;
    document.getElementById("res-justificativa").textContent =
      dadosQuestao.justificativa || "";
  } else {
    boxGabarito.style.display = "none";
  }

  // 4. Pontos de Melhoria
  const boxMelhoria = document.getElementById("box-melhoria");
  if (resposta.pontos_melhoria) {
    boxMelhoria.style.display = "block";
    document.getElementById("res-melhoria").textContent =
      resposta.pontos_melhoria;
  } else {
    boxMelhoria.style.display = "none";
  }

  // 5. Botão Contestar
  document.getElementById("btn-contestar").onclick = () => {
    window.location.href = `contestacoes.html?resposta_id=${resposta.id}`;
  };

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
    const min = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    el.textContent = `${min}:${sec}`;
  }, 1000);
}

function atualizarStats() {
  document.getElementById("totalQuestoes").textContent = todasQuestoes.length;
  document.getElementById("totalRespondidas").textContent =
    todasRespostas.length;
  if (todasRespostas.length > 0) {
    const media =
      todasRespostas.reduce((a, b) => a + (Number(b.nota) || 0), 0) /
      todasRespostas.length;
    document.getElementById("mediaNotas").textContent = media.toFixed(1);
  } else {
    document.getElementById("mediaNotas").textContent = "-";
  }
}

window.aplicarFiltros = function () {
  const disc = document.getElementById("filtroDisciplina").value;
  const tipo = document.getElementById("filtroTipo").value;
  const filtradas = todasQuestoes.filter((q) => {
    const qTipo = (q.tipo || q.tipo_questao || "").toLowerCase();
    if (disc && q.disciplina !== disc) return false;
    if (tipo && !qTipo.includes(tipo)) return false;
    return true;
  });
  renderizarGrid(filtradas);
};

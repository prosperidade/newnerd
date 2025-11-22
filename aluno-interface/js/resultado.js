// js/resultado.js - Exibe feedback (Versão Blindada)

async function initResultado() {
  const user = await verificarAuth();
  if (!user) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get("resposta_id");

  if (!id) {
    document.getElementById("resultadoCard").innerHTML =
      '<div class="loading">Erro: ID do resultado não fornecido.</div>';
    return;
  }

  carregarResultado(id);
}

// Inicialização segura
if (window.supabaseClient) {
  initResultado();
} else {
  document.addEventListener("configReady", initResultado);
}

async function carregarResultado(id) {
  try {
    const { data: res, error } = await window.supabaseClient
      .from("respostas_alunos")
      .select("*, questoes_geradas(*)")
      .eq("id", id)
      .single();

    if (error || !res) throw new Error("Resultado não encontrado");

    renderizarResultado(res, res.questoes_geradas);
  } catch (err) {
    console.error(err);
    document.getElementById("resultadoCard").innerHTML =
      '<div class="loading" style="color:red">Erro ao carregar resultado.</div>';
  }
}

function renderizarResultado(res, questao) {
  const container = document.getElementById("resultadoCard");
  const nota = Number(res.nota || 0);
  const isAprovado = nota >= 6;

  // Define resposta do aluno
  const respAluno =
    res.resposta_alternativa || res.resposta_texto || "Sem resposta";

  let html = `
    <div class="resultado-header">
      <h1 style="font-size:3rem;">${isAprovado ? "🎉" : "📚"}</h1>
      <h2 style="color: var(--primary-color); margin: 10px 0;">
        ${res.correta ? "Resposta Correta!" : "Resposta Incorreta"}
      </h2>
      <div class="nota-display ${isAprovado ? "aprovado" : "reprovado"}" 
           style="font-size: 2.5rem; font-weight: bold; margin: 20px 0;">
        Nota: ${nota.toFixed(1)}
      </div>
    </div>

    <div class="feedback-box">
      <h3>Questão</h3>
      <p>${escapeHTML(questao.enunciado)}</p>
    </div>

    <div class="feedback-box">
      <h3>Sua Resposta</h3>
      <p style="font-weight:bold; color: var(--primary-color)">${escapeHTML(
        respAluno
      )}</p>
    </div>
  `;

  if (questao.gabarito) {
    html += `
      <div class="feedback-box" style="background: var(--success-bg); border-left: 5px solid var(--success-color);">
        <h3>Gabarito Oficial</h3>
        <p style="font-weight:bold; color: var(--success-color)">${escapeHTML(
          questao.gabarito
        )}</p>
        ${
          questao.justificativa_gabarito
            ? `<p style="font-size:0.9rem; margin-top:5px;">${escapeHTML(
                questao.justificativa_gabarito
              )}</p>`
            : ""
        }
      </div>
    `;
  }

  if (res.feedback) {
    html += `
      <div class="feedback-box" style="background: var(--info-bg); border-left: 5px solid var(--info-color);">
        <h3>Análise da IA</h3>
        <p>${escapeHTML(res.feedback)}</p>
      </div>
    `;
  }

  // Botões
  html += `
    <div style="margin-top: 30px; display: flex; gap: 10px; justify-content: center;">
      <button onclick="voltarPainel()" class="btn-logout">Voltar ao Painel</button>
      <button onclick="window.location.href='contestacoes.html?resposta_id=${res.id}'" 
              class="btn-login" style="background: var(--warning-color)">
        ⚠️ Contestar
      </button>
    </div>
  `;

  container.innerHTML = html;
}

function escapeHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ====================================================================
// PAINEL.JS - Carrega perfil do aluno, questões e respostas
// Depende de: config.js -> Supabase CDN -> auth.js -> painel.js
// ====================================================================

let aluno = null;
let questoes = [];
let respostas = [];

document.addEventListener("DOMContentLoaded", async () => {
  const user = await verificarAuth(); // do auth.js
  if (!user) return;

  // Busca o perfil do aluno (match por e-mail)
  const { data: perfil, error } = await supabaseClient
    .from("alunos")
    .select("*")
    .eq("email", user.email)
    .single();

  if (error || !perfil) {
    console.error("❌ Aluno não encontrado na tabela 'alunos':", error);
    const nomeEl = document.getElementById("alunoNome");
    if (nomeEl) nomeEl.textContent = user.email ?? "Aluno";
    return;
  }

  aluno = perfil;
  const nomeEl = document.getElementById("alunoNome");
  if (nomeEl) nomeEl.textContent = aluno.nome ?? user.email;

  await carregarQuestoes();
  await carregarRespostas();
  exibirQuestoes();
  atualizarEstatisticas();
});

async function carregarQuestoes() {
  try {
    if (!aluno?.professor_id) {
      console.error("❌ Professor ID não encontrado para o aluno.");
      questoes = [];
      return;
    }

    const { data, error } = await supabaseClient
      .from("questoes_geradas")
      .select("*")
      .eq("professor_id", aluno.professor_id)
      .eq("serie", aluno.serie)
      .order("created_at", { ascending: false });

    if (error) throw error;
    questoes = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Erro ao carregar questões:", err);
    questoes = [];
  }
}

async function carregarRespostas() {
  try {
    const { data, error } = await supabaseClient
      .from("respostas_alunos")
      .select("*")
      .eq("aluno_id", aluno.id);

    if (error) throw error;
    respostas = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Erro ao carregar respostas:", err);
    respostas = [];
  }
}

function exibirQuestoes() {
  const grid = document.getElementById("questoesGrid");
  if (!grid) return;

  if (!Array.isArray(questoes) || questoes.length === 0) {
    grid.innerHTML =
      '<p style="text-align: center; color: #555; padding: 40px;">Nenhuma questão disponível para sua série no momento.</p>';
    return;
  }

  grid.innerHTML = questoes
    .map((q) => {
      const respondida = respostas.find((r) => r.questao_id === q.id);
      const statusClass = respondida ? "respondida" : "";
      return `
        <div class="questao-card ${statusClass}" onclick="abrirQuestao('${
        q.id
      }')">
          <div class="questao-card-header">
            <div class="badges">
              <span class="badge badge-tipo">${(q.tipo_questao || "").replace(
                "_",
                " "
              )}</span>
              <span class="badge badge-disciplina">${q.disciplina ?? ""}</span>
              <span class="badge badge-serie">${q.serie ?? ""}</span>
            </div>
            ${
              respondida
                ? `<span style="color:#4caf50;">✓ Nota: ${
                    respondida.nota ?? "-"
                  }</span>`
                : ""
            }
          </div>
          <div class="questao-preview">${(q.enunciado ?? "").substring(
            0,
            100
          )}...</div>
          <div class="questao-info"><span>Dificuldade: ${
            q.dificuldade ?? "-"
          }</span></div>
          <button class="btn-responder">${
            respondida ? "Ver Resultado" : "Responder"
          }</button>
        </div>
      `;
    })
    .join("");
}

function atualizarEstatisticas() {
  const totalQuestoesEl = document.getElementById("totalQuestoes");
  const totalRespondidasEl = document.getElementById("totalRespondidas");
  const mediaNotasEl = document.getElementById("mediaNotas");

  if (totalQuestoesEl) totalQuestoesEl.textContent = String(questoes.length);
  if (totalRespondidasEl)
    totalRespondidasEl.textContent = String(respostas.length);

  if (mediaNotasEl) {
    if (respostas.length > 0) {
      const media =
        respostas.reduce((sum, r) => sum + Number(r.nota || 0), 0) /
        respostas.length;
      mediaNotasEl.textContent = media.toFixed(1);
    } else {
      mediaNotasEl.textContent = "-";
    }
  }
}

function abrirQuestao(questaoId) {
  // Redireciona para a página unificada de atividades (SPA)
  window.location.href = `questao.html?id=${encodeURIComponent(questaoId)}`;
}

function aplicarFiltros() {
  const disciplina = document.getElementById("filtroDisciplina")?.value ?? "";
  const tipo = document.getElementById("filtroTipo")?.value ?? "";

  const filtradas = questoes.filter((q) => {
    const matchDisciplina = !disciplina || q.disciplina === disciplina;
    const matchTipo = !tipo || q.tipo_questao === tipo;
    return matchDisciplina && matchTipo;
  });

  exibirQuestoesFiltradas(filtradas);
}

function exibirQuestoesFiltradas(filtradas) {
  const grid = document.getElementById("questoesGrid");
  if (!grid) return;

  if (!filtradas.length) {
    grid.innerHTML =
      '<p style="text-align: center; color: #555; padding: 40px;">Nenhuma questão encontrada com os filtros selecionados.</p>';
    return;
  }

  grid.innerHTML = filtradas
    .map((q) => {
      const respondida = respostas.find((r) => r.questao_id === q.id);
      const statusClass = respondida ? "respondida" : "";
      return `
        <div class="questao-card ${statusClass}" onclick="abrirQuestao('${
        q.id
      }')">
          <div class="questao-card-header">
            <div class="badges">
              <span class="badge badge-tipo">${(q.tipo_questao || "").replace(
                "_",
                " "
              )}</span>
              <span class="badge badge-disciplina">${q.disciplina ?? ""}</span>
            </div>
            ${
              respondida
                ? `<span style="color:#4caf50;">✓ Nota: ${
                    respondida.nota ?? "-"
                  }</span>`
                : ""
            }
          </div>
          <div class="questao-preview">${(q.enunciado ?? "").substring(
            0,
            100
          )}...</div>
          <button class="btn-responder">${
            respondida ? "Ver Resultado" : "Responder"
          }</button>
        </div>
      `;
    })
    .join("");
}

function voltarPainel() {
  window.location.href = "painel.html";
}

// Expor funções usadas por onclick no HTML
window.aplicarFiltros = aplicarFiltros;
window.abrirQuestao = abrirQuestao;
window.voltarPainel = voltarPainel;

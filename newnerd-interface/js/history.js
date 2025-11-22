// js/history.js

async function loadHistoryFromSupabase() {
  if (typeof window.SupabaseClient === "undefined") return;

  const container = document.getElementById("historico");
  if (container)
    container.innerHTML =
      '<div style="text-align:center; padding:20px;">Carregando...</div>';

  try {
    const {
      data: { user },
    } = await window.supabase.auth.getUser(); // Acesso direto ao auth wrapper
    const profId =
      user?.id || CONFIG.PROFESSOR_ID || "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

    const questoes = await SupabaseClient.carregarQuestoes(profId);

    displayHistoryFromData(questoes);
  } catch (err) {
    console.error("Erro histórico:", err);
    if (container)
      container.innerHTML =
        '<p style="color:red; text-align:center">Erro ao carregar.</p>';
  }
}

function displayHistoryFromData(lista) {
  const container = document.getElementById("historico");
  if (!container) return;

  if (!lista || lista.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; color:#999; padding:20px;">Sem histórico.</div>';
    return;
  }

  let html = "";

  lista.forEach((q) => {
    const tipo = (q.tipo || q.tipo_questao || "").replace(/_/g, " ");
    const disc = q.disciplina || "Geral";
    const serie = q.serie || "";
    const texto = q.enunciado || "Sem texto...";
    const data = new Date(q.created_at).toLocaleDateString("pt-BR");

    // AQUI ESTÁ O CLICK QUE LEVA PARA O DISPLAY PRINCIPAL
    // Precisamos passar o ID e buscar os dados completos ou passar o objeto se serializável
    // Vamos buscar pelo ID para garantir dados frescos
    html += `
      <div class="history-card" onclick="carregarDoHistorico('${q.id}')">
        <div class="history-header">
           <span class="history-badge" style="background:#e3f2fd; color:#1565c0">${tipo}</span>
           <span class="history-badge" style="background:#f3e5f5; color:#7b1fa2">${disc}</span>
        </div>
        <div class="history-preview">${texto}</div>
        <div class="history-footer">
           <span>📅 ${data} - ${serie}</span>
           <button class="btn-hist-action" onclick="excluirDoHistorico(event, '${q.id}')">🗑️</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Funções auxiliares globais para o onclick
window.carregarDoHistorico = async function (id) {
  // Busca dados completos
  const { data } = await window.supabase
    .from("questoes_geradas")
    .select("*")
    .eq("id", id)
    .single();

  if (data) {
    // Normaliza
    if (!data.tipo_questao) data.tipo_questao = data.tipo;
    // Exibe
    displayQuestion(data);
  }
};

window.excluirDoHistorico = async function (e, id) {
  e.stopPropagation();
  if (!confirm("Apagar?")) return;
  await SupabaseClient.deletarQuestao(id);
  loadHistoryFromSupabase();
};

window.clearHistory = async function () {
  if (confirm("Limpar tudo?")) {
    // Implementar lógica de limpar tudo via Supabase se necessário
    alert("Lógica de limpar tudo deve ser implementada no SupabaseClient.");
  }
};

// Exporta
if (typeof window !== "undefined") {
  window.loadHistoryFromSupabase = loadHistoryFromSupabase;
  window.displayHistoryFromData = displayHistoryFromData;
}

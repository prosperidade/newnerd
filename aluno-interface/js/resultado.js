// resultado.js (corrigido)

let alunoCtx = null;

// Util: escapar HTML simples p/ evitar XSS ao montar innerHTML
function escapeHTML(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initializeResultado() {
  document.addEventListener("DOMContentLoaded", async () => {
    // verificarAuth do auth.js — costuma ser assíncrono
    alunoCtx = await verificarAuth();
    if (!alunoCtx) return;

    const params = new URLSearchParams(window.location.search);
    const respostaId = params.get("resposta_id");

    if (!respostaId) {
      el("resultadoCard").innerHTML = `
        <div style="text-align:center;padding:40px;">
          <p style="color:#f44336;font-size:18px;">❌ ID da resposta não informado.</p>
          <button class="btn-submit" onclick="voltarPainel()" style="margin-top:20px;">Voltar</button>
        </div>`;
      return;
    }

    await exibirResultado(respostaId);
  });
}

document.addEventListener("configReady", initializeResultado);

async function exibirResultado(id) {
  try {
    const resp = await fetch(
      `${
        CONFIG.SUPABASE_URL
      }/rest/v1/respostas_alunos?id=eq.${encodeURIComponent(
        id
      )}&select=*,questoes_geradas(*)`,
      {
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!resp.ok) throw new Error("Falha na consulta");

    const resultados = await resp.json();
    if (!Array.isArray(resultados) || resultados.length === 0) {
      el("resultadoCard").innerHTML = `
        <div style="text-align:center;padding:40px;">
          <p style="color:#f44336;font-size:18px;">❌ Resultado não encontrado.</p>
          <button class="btn-submit" onclick="voltarPainel()" style="margin-top:20px;">Voltar</button>
        </div>`;
      return;
    }

    const resultado = resultados[0];
    const questao = resultado.questoes_geradas || {};

    const notaNum = Number(resultado.nota ?? 0);
    const notaClass = notaNum >= 6 ? "aprovado" : "reprovado";
    const emoji = notaNum >= 6 ? "🎉" : "📚";

    let html = `
      <div class="resultado-header">
        <h1>${emoji} Resultado</h1>
        <div class="nota-display ${notaClass}">${
      isFinite(notaNum) ? notaNum.toFixed(1) : "—"
    }</div>
        <p style="font-size:18px;margin-top:10px;">
          ${
            resultado.correta ? "✅ Resposta Correta!" : "❌ Resposta Incorreta"
          }
        </p>
      </div>

      <div class="feedback-box">
        <h3>📝 Questão</h3>
        <p style="font-weight:600;color:#333;">${escapeHTML(
          questao.enunciado || "—"
        )}</p>
      </div>
    `;

    // Sua resposta (objetiva)
    if (resultado.resposta_alternativa) {
      html += `
        <div class="feedback-box">
          <h3>✍️ Sua Resposta</h3>
          <p style="font-size:20px;font-weight:700;color:#667eea;">
            Alternativa: ${escapeHTML(resultado.resposta_alternativa)}
          </p>
        </div>`;
    }

    // Sua resposta (discursiva)
    if (resultado.resposta_texto) {
      html += `
        <div class="feedback-box">
          <h3>✍️ Sua Resposta</h3>
          <p style="white-space:pre-wrap;">${escapeHTML(
            resultado.resposta_texto
          )}</p>
        </div>`;
    }

    // Feedback da IA (mantém como texto pré-formatado)
    if (resultado.feedback) {
      html += `
        <div class="feedback-box" style="background:linear-gradient(135deg,#e3f2fd 0%,#f0f4ff 100%);border-left:4px solid #667eea;">
          <h3>🤖 Análise Inteligente da IA</h3>
          <div style="line-height:1.8;color:#333;white-space:pre-wrap;">${escapeHTML(
            resultado.feedback
          )}</div>
        </div>`;
    }

    // Gabarito
    if (questao.gabarito) {
      html += `
        <div class="feedback-box" style="background:#e8f5e9;border-left:4px solid #4caf50;">
          <h3>✅ Gabarito Oficial</h3>
          <p style="font-size:20px;font-weight:700;color:#2e7d32;margin-bottom:10px;">
            Resposta Correta: ${escapeHTML(questao.gabarito)}
          </p>
          ${
            questao.justificativa_gabarito
              ? `<p style="line-height:1.8;color:#333;">` +
                `<strong>Justificativa:</strong> ${escapeHTML(
                  questao.justificativa_gabarito
                )}` +
                `</p>`
              : ""
          }
        </div>`;
    }

    // Pontos fortes
    if (resultado.pontos_fortes) {
      html += `
        <div class="feedback-box" style="background:#e6fcf5;border-left:4px solid #087f5b;">
          <h3>✨ Pontos Fortes</h3>
          <p style="line-height:1.8;color:#333;">${escapeHTML(
            resultado.pontos_fortes
          )}</p>
        </div>`;
    }

    // Pontos de melhoria
    if (resultado.pontos_melhoria) {
      html += `
        <div class="feedback-box" style="background:#fff3e0;border-left:4px solid #f57c00;">
          <h3>📈 Pontos de Melhoria</h3>
          <p style="line-height:1.8;color:#333;white-space:pre-line;">${escapeHTML(
            resultado.pontos_melhoria
          )}</p>
        </div>`;
    }

    // Próximos passos
    if (resultado.proximos_passos) {
      html += `
        <div class="feedback-box" style="background:#f3e5f5;border-left:4px solid #9c27b0;">
          <h3>🎯 Próximos Passos</h3>
          <p style="line-height:1.8;color:#333;">${escapeHTML(
            resultado.proximos_passos
          )}</p>
        </div>`;
    }

    // Informações adicionais
    const tipoFmt = String(questao.tipo_questao || "—").replaceAll("_", " ");
    html += `
      <div class="feedback-box" style="background:#f8f9fa;">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:15px;text-align:center;">
          <div>
            <div style="font-size:24px;font-weight:700;color:#667eea;">${escapeHTML(
              questao.disciplina || "—"
            )}</div>
            <div style="font-size:12px;color:#666;">Disciplina</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700;color:#667eea;">${escapeHTML(
              questao.dificuldade || "—"
            )}</div>
            <div style="font-size:12px;color:#666;">Dificuldade</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700;color:#667eea;">${escapeHTML(
              tipoFmt
            )}</div>
            <div style="font-size:12px;color:#666;">Tipo</div>
          </div>
        </div>
      </div>

      <div style="margin-top:30px;display:flex;gap:15px;flex-wrap:wrap;">
        <button class="btn-submit" onclick="voltarPainel()" style="flex:1;min-width:200px;">← Voltar ao Painel</button>
        <button class="btn-submit" onclick="abrirContestar('${resultado.id}')" 
                style="flex:1;min-width:200px;background:linear-gradient(135deg,#f57c00,#e65100);">
          ⚠️ Contestar Resultado
        </button>
      </div>

      <!-- Modal de Contestação -->
      <div id="modal-contestacao" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;padding:20px;overflow-y:auto;">
        <div style="max-width:600px;margin:50px auto;background:white;border-radius:15px;padding:30px;">
          <h2 style="color:#333;margin-bottom:20px;">⚠️ Contestar Resultado</h2>
          <p style="color:#666;margin-bottom:20px;">Explique por que você acredita que a correção está incorreta:</p>
          <textarea id="texto-contestacao"
                    style="width:100%;min-height:150px;padding:15px;border:2px solid #e0e0e0;border-radius:8px;font-size:16px;resize:vertical;"
                    placeholder="Descreva sua contestação aqui..."></textarea>
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button onclick="enviarContestacao('${resultado.id}')" 
                    style="flex:1;padding:15px;background:#f57c00;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;">
              Enviar Contestação
            </button>
            <button onclick="fecharContestar()"
                    style="flex:1;padding:15px;background:#999;color:white;border:none;border-radius:8px;font-weight:700;cursor:pointer;">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;

    el("resultadoCard").innerHTML = html;
  } catch (err) {
    console.error("Erro ao carregar resultado:", err);
    el("resultadoCard").innerHTML = `
      <div style="text-align:center;padding:40px;">
        <p style="color:#f44336;font-size:18px;">❌ Erro ao carregar resultado</p>
        <button class="btn-submit" onclick="voltarPainel()" style="margin-top:20px;">Voltar</button>
      </div>`;
  }
}

function el(id) {
  return document.getElementById(id);
}

function voltarPainel() {
  window.location.href = "painel.html";
}

function abrirContestar() {
  const m = el("modal-contestacao");
  if (m) m.style.display = "block";
}

function fecharContestar() {
  const m = el("modal-contestacao");
  if (m) m.style.display = "none";
}

async function enviarContestacao(respostaId) {
  const texto = el("texto-contestacao")?.value.trim();
  if (!texto) return alert("Por favor, descreva sua contestação.");

  try {
    // alunoCtx veio do verificarAuth(); se não houver, tentar sessionStorage (fallback legado)
    let alunoId = alunoCtx?.id;
    if (!alunoId) {
      const a = JSON.parse(sessionStorage.getItem("aluno") || "null");
      alunoId = a?.id;
    }
    if (!alunoId) {
      alert("Não foi possível identificar o aluno.");
      return;
    }

    const resp = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/contestacoes`, {
      method: "POST",
      headers: {
        apikey: CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        resposta_id: respostaId,
        aluno_id: alunoId,
        texto_contestacao: texto,
        status: "pendente",
      }),
    });

    if (resp.ok) {
      alert("✅ Contestação enviada com sucesso! O professor irá revisar.");
      fecharContestar();
      // opcional: redirecionar para lista
      // window.location.href = "contestações.html";
    } else {
      console.error("Falha ao inserir contestação:", await resp.text());
      alert("❌ Erro ao enviar contestação");
    }
  } catch (err) {
    console.error(err);
    alert("❌ Erro ao enviar contestação");
  }
}

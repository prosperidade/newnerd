// js/generator.js - Renderização corrigida

const Generator = {
  // ... (mantenha generateOne, generateMultiple e buildParams iguais) ...
  async generateOne(params, variacaoIndex = 0) {
    const endpoint = CONFIG.GENERATE_FUNCTION_URL || CONFIG.WEBHOOK_URL;
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      CONFIG.REQUEST_TIMEOUT
    );
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ ...params, variacao: variacaoIndex }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error("Erro na IA");
      let data = await response.json();
      if (data.questoes) data = data.questoes[0];
      if (!data.tipo_questao) data.tipo_questao = params.tipo || "discursiva";
      return data;
    } catch (error) {
      throw error;
    }
  },

  async generateMultiple(params, qtd) {
    const questoes = [];
    for (let i = 0; i < qtd; i++) {
      try {
        questoes.push(await this.generateOne(params, i));
      } catch (e) {}
    }
    return { questoes, total: qtd, sucesso: questoes.length };
  },

  buildParams(formData) {
    return {
      mensagem: formData.tema,
      disciplina: formData.disciplina,
      tipo_questao: formData.tipo,
      serie: formData.serie,
      dificuldade: formData.dificuldade,
      criterios_professor: formData.criterios,
    };
  },

  // ==========================================
  // RENDERIZADOR DE CARDS (CORRIGIDO)
  // ==========================================
  renderCardHTML(data, index = 0) {
    const tipos = {
      multipla_escolha: "Múltipla",
      discursiva: "Discursiva",
      verdadeiro_falso: "V/F",
      associacao: "Associação",
    };

    // ID único
    const cardId = data.id || `temp_${index}`;

    // --- PREPARAÇÃO ROBUSTA DOS DADOS ---
    let alternativas = data.alternativas;
    // Se for string, tenta parsear
    if (typeof alternativas === "string") {
      try {
        alternativas = JSON.parse(alternativas);
      } catch (e) {}
    }

    // Associação: Tenta achar colunas
    let colA = data.coluna_a;
    let colB = data.coluna_b;
    // Se não tem direto, procura dentro de alternativas (formato salvo no banco)
    if (!colA && alternativas && alternativas.coluna_a) {
      colA = alternativas.coluna_a;
      colB = alternativas.coluna_b;
    }

    // V/F: Tenta achar afirmações
    let afirmacoes = data.afirmacoes;
    if (
      !afirmacoes &&
      Array.isArray(alternativas) &&
      data.tipo_questao === "verdadeiro_falso"
    ) {
      afirmacoes = alternativas;
    }

    // --- HTML ---
    let html = `
      <div class="question-card" id="card-${cardId}" style="margin-bottom:20px;">
        <div class="question-header">
           <span class="badge badge-primary">${
             tipos[data.tipo_questao] || data.tipo_questao
           }</span>
           <span class="badge badge-success">${
             data.disciplina || "Geral"
           }</span>
           <span class="badge badge-warning">${data.serie || "Geral"}</span>
        </div>
        
        <div class="question-enunciado" style="font-size:1.1rem; margin:15px 0; display:block;">
             <strong>${index + 1}.</strong> ${
      data.enunciado || "Enunciado não carregado."
    }
        </div>
    `;

    // 1. MÚLTIPLA ESCOLHA
    if (
      data.tipo_questao === "multipla_escolha" &&
      Array.isArray(alternativas)
    ) {
      html +=
        `<ul class="alternativas">` +
        alternativas
          .map(
            (a) =>
              `<li class="alternativa ${
                a.letra === data.gabarito ? "correta" : ""
              }">${a.letra}) ${a.texto}</li>`
          )
          .join("") +
        `</ul>`;
    }

    // 2. VERDADEIRO OU FALSO (Com estilo corrigido)
    else if (
      data.tipo_questao === "verdadeiro_falso" &&
      Array.isArray(afirmacoes)
    ) {
      html += `<ul class="alternativas">`;
      afirmacoes.forEach((af) => {
        // Tenta pegar o valor correto
        const val = typeof af.valor !== "undefined" ? af.valor : af.verdadeiro;
        const badge = val
          ? '<span style="color:green; font-weight:bold;">[ V ]</span>'
          : '<span style="color:red; font-weight:bold;">[ F ]</span>';
        html += `<li class="alternativa" style="display:flex; gap:10px;">${badge} ${af.texto}</li>`;
      });
      html += `</ul>`;
    }

    // 3. ASSOCIAÇÃO (Colunas Lado a Lado)
    else if (data.tipo_questao === "associacao" && colA && colB) {
      html += `
        <div class="cols-container">
            <div class="col-box">
                <h4>Coluna A</h4>
                ${colA
                  .map(
                    (i) =>
                      `<div class="assoc-item"><strong>${
                        i.id || i.numero
                      }.</strong> ${i.texto}</div>`
                  )
                  .join("")}
            </div>
            <div class="col-box">
                <h4>Coluna B</h4>
                ${colB
                  .map(
                    (i) =>
                      `<div class="assoc-item"><strong>${
                        i.id || i.letra
                      })</strong> ${i.texto}</div>`
                  )
                  .join("")}
            </div>
        </div>`;
    }

    // GABARITO (Com Botão de Edição e Texto Escuro)
    const respText =
      data.gabarito || data.resposta_esperada || "Gabarito indisponível";
    const justText = data.justificativa_gabarito || data.justificativa || "";

    html += `
        <div class="resposta-esperada-container" id="resp-cont-${cardId}" style="margin-top:15px; background:#e8f5e9; padding:15px; border-radius:8px; border-left:4px solid #4caf50;">
            <div style="display:flex; justify-content:space-between;">
                <div id="view-gabarito-${cardId}">
                    <strong style="color:#1b5e20;">✅ Gabarito Oficial:</strong><br>
                    <span class="content" style="color:#333;">${respText}</span>
                    ${
                      justText
                        ? `<br><br><em style="color:#555;">💡 ${justText}</em>`
                        : ""
                    }
                </div>
                <button onclick="Generator.toggleEdit('${cardId}')" style="background:none; border:1px solid #ccc; border-radius:4px; cursor:pointer;">✏️</button>
            </div>

            <div id="edit-gabarito-${cardId}" style="display:none; margin-top:10px;">
                <label style="font-size:0.8rem; font-weight:bold;">Resposta:</label>
                <textarea id="input-resp-${cardId}" class="form-control" rows="3" style="width:100%; margin-bottom:5px;">${respText}</textarea>
                <label style="font-size:0.8rem; font-weight:bold;">Justificativa:</label>
                <textarea id="input-just-${cardId}" class="form-control" rows="2" style="width:100%; margin-bottom:10px;">${justText}</textarea>
                <div style="text-align:right;">
                    <button class="btn btn-small btn-secondary" onclick="Generator.toggleEdit('${cardId}')">Cancelar</button>
                    <button class="btn btn-small" onclick="Generator.saveEdit('${cardId}')" style="background:#4caf50; color:white;">Salvar</button>
                </div>
            </div>
        </div>
    `;

    html += `</div>`;
    return html;
  },

  // --- Lógica de Edição ---
  toggleEdit(id) {
    const view = document.getElementById(`view-gabarito-${id}`);
    const edit = document.getElementById(`edit-gabarito-${id}`);
    if (edit.style.display === "none") {
      edit.style.display = "block";
      view.style.display = "none";
    } else {
      edit.style.display = "none";
      view.style.display = "block";
    }
  },

  async saveEdit(id) {
    const novaResp = document.getElementById(`input-resp-${id}`).value;
    const novaJust = document.getElementById(`input-just-${id}`).value;

    // Atualiza UI
    const view = document.getElementById(`view-gabarito-${id}`);
    view.innerHTML = `<strong style="color:#1b5e20;">✅ Gabarito Oficial:</strong><br>
                        <span class="content" style="color:#333;">${novaResp}</span>
                        ${
                          novaJust
                            ? `<br><br><em style="color:#555;">💡 ${novaJust}</em>`
                            : ""
                        }`;

    this.toggleEdit(id);

    // Salva no Banco
    if (!id.startsWith("temp_") && window.SupabaseClient) {
      try {
        await SupabaseClient.atualizarQuestao(id, {
          gabarito: novaResp,
          justificativa: novaJust, // ou justificativa_gabarito dependendo da coluna
          resposta_esperada: novaResp, // para garantir compatibilidade
        });
        alert("Gabarito atualizado!");
      } catch (e) {
        alert("Erro ao salvar edição.");
      }
    }
  },
};

// ... (Funções de display unificadas mantidas iguais ao anterior) ...
function displayQuestion(data) {
  displayMultipleQuestions({ questoes: [data], total: 1, sucesso: 1 });
}
function displayMultipleQuestions(resultado) {
  const resultDiv = document.getElementById("result");
  if (!resultDiv) return;
  window.currentQuestions = resultado.questoes || [];
  const qs = window.currentQuestions;
  let html = `<div style="margin-bottom:20px;"><h3>✅ ${resultado.sucesso} Questões Geradas</h3></div>`;
  resultado.questoes.forEach((q, i) => {
    html += Generator.renderCardHTML(q, i);
  });
  html += `
      <div class="actions" style="margin-top: 30px; position: sticky; bottom: 20px; background: var(--bg-card); padding: 20px; border-radius: 8px; box-shadow: 0 -5px 20px rgba(0,0,0,0.1); display:flex; gap:10px; flex-wrap:wrap; justify-content:center; border:1px solid #ddd;">
        <button class="btn" onclick="location.reload()" style="background:#333;">🔄 Nova</button>
        <div style="width:1px; background:#ccc; margin:0 5px;"></div>
        <button class="btn btn-secondary" id="btn-pdf">📄 PDF</button>
        <button class="btn btn-secondary" id="btn-word">📝 Word</button>
        <button class="btn btn-secondary" id="btn-json">💾 JSON</button>
        <button class="btn btn-secondary" id="btn-csv">📊 CSV</button>
        <button class="btn btn-secondary" id="btn-zip">📦 ZIP</button>
        <button class="btn btn-secondary" id="btn-copy">📋 Copiar</button>
      </div>
    `;
  resultDiv.innerHTML = html;
  resultDiv.classList.add("active");
  resultDiv.scrollIntoView({ behavior: "smooth" });
  setTimeout(() => {
    document
      .getElementById("btn-pdf")
      ?.addEventListener("click", () => exportAllPDF(qs));
    document
      .getElementById("btn-word")
      ?.addEventListener("click", () => exportAllWord(qs));
    document
      .getElementById("btn-json")
      ?.addEventListener("click", () => exportAllJSON(qs));
    document
      .getElementById("btn-csv")
      ?.addEventListener("click", () => exportAllCSV(qs));
    document
      .getElementById("btn-zip")
      ?.addEventListener("click", () => exportAllZIP(qs));
    document
      .getElementById("btn-copy")
      ?.addEventListener("click", () => copyAllQuestions(qs));
  }, 100);
}

if (typeof window !== "undefined") {
  window.Generator = Generator;
  window.displayQuestion = displayQuestion;
  window.displayMultipleQuestions = displayMultipleQuestions;
}

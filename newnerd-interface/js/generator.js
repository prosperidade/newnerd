// js/generator.js - CORRIGIDO PARA V/F E ASSOCIAÇÃO

const Generator = {
  // --- Lógica de Geração (Mantida intacta) ---
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
      // Normalização de segurança
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
        const q = await this.generateOne(params, i);
        questoes.push(q);
      } catch (e) {
        console.error(e);
      }
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

  // ==================================================
  // RENDERIZADOR DE CARDS (CORRIGIDO V/F e ASSOC)
  // ==================================================
  renderCardHTML(data, index = 0) {
    const tipos = {
      multipla_escolha: "Múltipla",
      discursiva: "Discursiva",
      verdadeiro_falso: "V/F",
      associacao: "Associação",
    };

    // --- 1. PREPARAÇÃO DOS DADOS (Parse seguro) ---
    let alternativas = data.alternativas;
    if (typeof alternativas === "string")
      try {
        alternativas = JSON.parse(alternativas);
      } catch (e) {}

    // Tratamento específico para V/F (Afirmações)
    let afirmacoes = data.afirmacoes;
    if (
      !afirmacoes &&
      data.tipo_questao === "verdadeiro_falso" &&
      Array.isArray(alternativas)
    ) {
      afirmacoes = alternativas; // Fallback se vier no campo alternativas
    }

    // Tratamento específico para Associação (Colunas)
    let colA = data.coluna_a;
    let colB = data.coluna_b;
    if (
      !colA &&
      data.tipo_questao === "associacao" &&
      alternativas &&
      !Array.isArray(alternativas)
    ) {
      // Se estiver aninhado num objeto dentro de alternativas
      colA = alternativas.coluna_a;
      colB = alternativas.coluna_b;
    }

    // --- 2. HTML DO CABEÇALHO ---
    let html = `
      <div class="question-card" style="margin-bottom:20px;">
        <div class="question-header">
           <span class="badge badge-primary">${
             tipos[data.tipo_questao] || data.tipo_questao
           }</span>
           <span class="badge badge-success">${
             data.disciplina || "Geral"
           }</span>
           <span class="badge badge-warning">${data.serie || "Geral"}</span>
        </div>
        
        <div class="question-enunciado" style="font-size:1.1rem; margin:15px 0; font-weight:500;">
             <strong>${index + 1}.</strong> ${
      data.enunciado || "Questão sem enunciado."
    }
        </div>
    `;

    // --- 3. CORPO DA QUESTÃO (Por Tipo) ---

    // A) MÚLTIPLA ESCOLHA
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

    // B) VERDADEIRO OU FALSO
    else if (
      data.tipo_questao === "verdadeiro_falso" &&
      Array.isArray(afirmacoes)
    ) {
      html += `<ul class="alternativas">`;
      afirmacoes.forEach((af) => {
        html += `<li class="vf-item">[ &nbsp;&nbsp; ] ${af.texto}</li>`;
      });
      html += `</ul>`;
    }

    // C) ASSOCIAÇÃO
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

    // --- 4. GABARITO (BOX VERDE) ---
    // Monta o HTML do gabarito dependendo do tipo
    let gabaritoHTML = "";

    if (data.tipo_questao === "verdadeiro_falso" && Array.isArray(afirmacoes)) {
      // Monta lista V/F visual
      gabaritoHTML = afirmacoes
        .map((af) => {
          const val = af.valor || af.verdadeiro; // pega boolean
          const letter = val ? "V" : "F";
          const colorClass = val ? "v" : "f";
          return `<div><span class="vf-badge ${colorClass}">[ ${letter} ]</span> ${af.texto}</div>`;
        })
        .join("");
    } else if (data.tipo_questao === "associacao") {
      gabaritoHTML = `<strong>Pares Corretos:</strong> ${
        data.gabarito || "Verifique a justificativa"
      }`;
    } else {
      // Padrão (Texto ou Letra)
      gabaritoHTML = `<strong>${
        data.gabarito || data.resposta_esperada || "Gabarito não informado."
      }</strong>`;
    }

    // Renderiza o Box
    html += `
        <div class="resposta-esperada" style="margin-top:15px; padding:15px; background:#e8f5e9; border-radius:8px; border-left: 4px solid #4caf50;">
            <div style="font-size:0.9rem; color:#2e7d32; margin-bottom:5px;">✅ GABARITO OFICIAL</div>
            <div style="margin-bottom:10px;">${gabaritoHTML}</div>
            ${
              data.justificativa_gabarito
                ? `<div style="font-size:0.9rem; color:#555; border-top:1px solid #c8e6c9; padding-top:8px;"><em>💡 ${data.justificativa_gabarito}</em></div>`
                : ""
            }
        </div>
    `;

    html += `</div>`; // Fecha card
    return html;
  },
};

// ==================================================
// FUNÇÕES DE EXIBIÇÃO E MENU
// ==================================================

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

  // MENU DE EXPORTAÇÃO
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

  // Listeners
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

// Exporta
if (typeof window !== "undefined") {
  window.Generator = Generator;
  window.displayQuestion = displayQuestion;
  window.displayMultipleQuestions = displayMultipleQuestions;
}

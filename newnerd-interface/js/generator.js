// deno-lint-ignore-file
// @ts-nocheck

const Generator = {
  // --- Lógica de Geração Unitária ---
  async generateOne(params, variacaoIndex = 0) {
    const endpoint = CONFIG.GENERATE_FUNCTION_URL || CONFIG.WEBHOOK_URL;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ ...params, variacao: variacaoIndex }),
      });

      if (!response.ok) throw new Error("Erro na IA: " + response.statusText);

      const data = await response.json();

      // Pode vir { questoes: objeto } ou { questoes: array } ou formatos antigos
      let resultado = null;
      if (Array.isArray(data.questoes)) {
        resultado = data.questoes; // várias questões
      } else if (data.questoes && typeof data.questoes === "object") {
        resultado = data.questoes; // objeto único
      } else {
        // fallback para formatos antigos
        resultado = data;
      }

      // Garante tipo_questao se for objeto único
      if (!Array.isArray(resultado)) {
        if (!resultado.tipo_questao)
          resultado.tipo_questao = params.tipo || "discursiva";
      }

      return resultado;
    } catch (error) {
      console.error("Erro generateOne:", error);
      throw error;
    }
  },

  // --- Geração Múltipla ---
  async generateMultiple(params, qtd) {
    const questoes = [];
    const btn = document.getElementById("generateBtn");
    if (btn) btn.textContent = `Gerando 0/${qtd}...`;

    for (let i = 0; i < qtd; i++) {
      try {
        if (btn) btn.textContent = `Gerando ${i + 1}/${qtd}...`;
        const q = await this.generateOne(params, i);
        if (Array.isArray(q)) questoes.push(...q);
        else questoes.push(q);
      } catch (e) {
        console.error(e);
      }
    }

    if (btn) btn.textContent = "✨ Gerar Questão";
    return { questoes, total: qtd, sucesso: questoes.length };
  },

  // --- Prova Completa (opcional) ---
  async generateFullExam(tema, disciplina, serie) {
    console.log("Iniciando Prova Completa...");
    const prova = [];
    const configProva = [
      { tipo: "multipla_escolha", qtd: 3, dif: "fácil" },
      { tipo: "verdadeiro_falso", qtd: 1, dif: "média" },
      { tipo: "associacao", qtd: 1, dif: "média" },
      { tipo: "discursiva", qtd: 2, dif: "difícil" },
    ];

    try {
      for (const item of configProva) {
        const params = {
          tema,
          disciplina,
          serie,
          tipo: item.tipo,
          dificuldade: item.dif,
          quantidade: item.qtd,
        };

        const q = await this.generateOne(params);
        if (Array.isArray(q)) prova.push(...q);
        else prova.push(q);
      }

      return { questoes: prova, total: prova.length, sucesso: prova.length };
    } catch (e) {
      alert("Erro ao gerar prova completa: " + e.message);
      return { questoes: [], sucesso: 0 };
    }
  },

  buildParams(formData) {
    return {
      mensagem: formData.tema,
      disciplina: formData.disciplina,
      tipo_questao: formData.tipo,
      serie: formData.serie,
      dificuldade: formData.dificuldade,
      quantidade: formData.quantidade || 1,
    };
  },

  // =============== SALVAR E EDITAR ===============
  toggleEdit(index) {
    const card = document.getElementById(`card-${index}`);
    if (!card) return;
    const scope = card.querySelector(".resposta-esperada");
    if (!scope) return;

    const isEditing = scope.dataset.editing === "true";
    scope.dataset.editing = isEditing ? "false" : "true";

    // Alterna botões dentro do gabarito
    const btnEdit = scope.querySelector(".btn-edit");
    const btnSave = scope.querySelector(".btn-save");
    if (btnEdit && btnSave) {
      btnEdit.style.display = isEditing ? "inline-flex" : "none";
      btnSave.style.display = isEditing ? "none" : "inline-flex";
    }

    // Contenteditable no gabarito
    scope.querySelectorAll("[data-editable='true']").forEach((el) => {
      el.contentEditable = !isEditing ? "true" : "false";
      el.style.outline = !isEditing
        ? "1px dashed rgba(255,255,255,0.7)"
        : "none";
    });

    // Textarea (discursiva)
    const txt = scope.querySelector("textarea[data-field='resposta_esperada']");
    if (txt) {
      // quando entra em edição, habilita; quando salva, desabilita
      txt.disabled = isEditing;
      txt.style.outline = !isEditing
        ? "1px dashed rgba(255,255,255,0.7)"
        : "none";
    }
  },

  // Apenas colunas seguras (existem na maioria dos schemas)
  _sanitizePayload(raw) {
    const allowed = new Set([
      "tipo_questao",
      "disciplina",
      "serie",
      "dificuldade",
      "enunciado",
      "alternativas",
      "gabarito",
      "justificativa_gabarito",
      "resposta_esperada",
      "criterios_avaliacao",
      "professor_id",
      "created_at",
    ]);
    const out = {};
    Object.keys(raw || {}).forEach((k) => {
      if (allowed.has(k)) out[k] = raw[k];
    });
    return out;
  },

  async saveEditedQuestion(index) {
    try {
      if (!globalThis.currentQuestions || !globalThis.currentQuestions[index]) {
        alert("Questão não encontrada na memória.");
        return;
      }
      if (!globalThis.supabaseClient) {
        alert("Supabase não inicializado.");
        return;
      }

      // DOM -> objeto (pega textarea/justificativa dentro do gabarito)
      this.collectEditsFromDOM(index);

      const q = globalThis.currentQuestions[index];
      const professorId =
        (globalThis.currentProfessor && globalThis.currentProfessor.id) ||
        (typeof SupabaseClient !== "undefined"
          ? await SupabaseClient.getProfessorId()
          : null);

      if (!professorId) {
        alert("Você precisa estar logado como professor para salvar.");
        return;
      }

      // ⚠️ mapeia para os nomes de coluna existentes no seu schema:
      const payload = {
        // banco usa "tipo", não "tipo_questao"
        tipo: q.tipo || q.tipo_questao || null,

        disciplina: q.disciplina || null,
        serie: q.serie || null,
        dificuldade: q.dificuldade || null,
        enunciado: q.enunciado || null,

        // jsonb já existe
        alternativas: Array.isArray(q.alternativas) ? q.alternativas : null,

        // campos de gabarito
        gabarito: q.gabarito || null,

        // banco usa "justificativa", não "justificativa_gabarito"
        justificativa: q.justificativa ?? q.justificativa_gabarito ?? null,

        // nova coluna criada no passo 1
        resposta_esperada: q.resposta_esperada ?? null,

        // já existe no seu schema
        criterios_avaliacao: q.criterios_avaliacao ?? null,

        // metadados que existem no schema
        professor_id: professorId,
        tokens_usados: Number(q.tokens_usados || 0),
        custo_estimado: Number(q.custo_estimado || 0),
        created_at: q.created_at || new Date().toISOString(),
      };

      // remove chaves com undefined para evitar 400
      Object.keys(payload).forEach(
        (k) => payload[k] === undefined && delete payload[k]
      );

      let resp;
      if (q.id) {
        resp = await globalThis.supabaseClient
          .from("questoes_geradas")
          .update(payload)
          .eq("id", q.id)
          .select()
          .single();
      } else {
        resp = await globalThis.supabaseClient
          .from("questoes_geradas")
          .insert(payload)
          .select()
          .single();
        if (!resp.error && resp.data?.id) q.id = resp.data.id; // atualiza memória
      }

      if (resp.error) {
        console.error(resp.error);
        alert("Erro ao salvar: " + resp.error.message);
        return;
      }

      // Sai do modo edição (no gabarito)
      this.toggleEdit(index);
      alert("✅ Questão salva com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar questão: " + e.message);
    }
  },

  collectEditsFromDOM(index) {
    const q = globalThis.currentQuestions[index];
    const card = document.getElementById(`card-${index}`);
    if (!q || !card) return;

    // Enunciado (fora do gabarito)
    const elEnun = card.querySelector("[data-field='enunciado']");
    if (elEnun) q.enunciado = elEnun.innerText.trim();

    // Dentro do gabarito:
    const scope = card.querySelector(".resposta-esperada") || card;

    // Justificativa gabarito
    const elJust = scope.querySelector("[data-field='justificativa_gabarito']");
    if (elJust) q.justificativa_gabarito = elJust.innerText.trim();

    // Resposta esperada (discursiva)
    const elResp = scope.querySelector(
      "textarea[data-field='resposta_esperada']"
    );
    if (elResp) q.resposta_esperada = elResp.value;

    // Alternativas (ME)
    const altEls = card.querySelectorAll("[data-field='alternativa-texto']");
    if (altEls && altEls.length) {
      const novas = [];
      altEls.forEach((el) => {
        const letra = el.getAttribute("data-letra");
        novas.push({ letra, texto: el.innerText.trim() });
      });
      q.alternativas = novas;
    }
  },

  // ==================================================
  // RENDERIZADOR (corpo azul / fonte branca; gabarito cinza / fonte branca)
  // ==================================================
  renderCardHTML(data, index = 0) {
    const tipos = {
      multipla_escolha: "Múltipla",
      discursiva: "Discursiva",
      verdadeiro_falso: "V/F",
      associacao: "Associação",
    };

    let alternativas = data.alternativas;
    if (typeof alternativas === "string")
      try {
        alternativas = JSON.parse(alternativas);
      } catch {}

    // V/F
    let afirmacoes =
      data.afirmacoes ||
      (data.tipo_questao === "verdadeiro_falso" ? alternativas : null);

    // Associação
    const colA =
      data.coluna_a &&
      data.coluna_a.map((i, idx) => ({
        numero: typeof i.numero !== "undefined" ? i.numero : i.id ?? idx + 1,
        texto: i.texto,
      }));
    const colB =
      data.coluna_b &&
      data.coluna_b.map((i, idx) => ({
        letra: i.letra || i.id || String.fromCharCode(65 + idx),
        texto: i.texto,
      }));

    // ======= INÍCIO DO CARD (fundo azul, fonte branca) =======
    let html = `
      <div class="question-card" id="card-${index}" data-editing="false"
           style="
             margin-bottom:20px;
             border: 1px solid rgba(255,255,255,0.18);
             padding: 20px;
             border-radius: 12px;
             background: #1e3a8a; /* azul */
             color: #fff;
           ">

        <div class="question-top" style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
          <div class="question-badges" style="display:flex; gap:10px;">
            <span style="background: rgba(255,255,255,0.08); color:#fff; padding:4px 8px; border-radius:8px; font-size:12px;">
              ${tipos[data.tipo_questao] || data.tipo_questao}
            </span>
            <span style="background: rgba(255,255,255,0.08); color:#fff; padding:4px 8px; border-radius:8px; font-size:12px;">
              ${data.disciplina || "Geral"}
            </span>
            <span style="background: rgba(255,255,255,0.08); color:#fff; padding:4px 8px; border-radius:8px; font-size:12px;">
              ${data.serie || "Geral"}
            </span>
          </div>
        </div>

        <div class="question-enunciado" style="color:#fff;">
          <strong>${index + 1}.</strong> 
          <span data-field="enunciado" data-editable="true"
                onblur="Generator.updateField(${index}, 'enunciado', this.innerText)"
                style="border-bottom:1px dashed rgba(255,255,255,0.35); color:#fff;">
            ${data.enunciado || "Questão sem enunciado."}
          </span>
        </div>
    `;

    // ======= CORPO POR TIPO =======
    // Múltipla Escolha
    if (
      data.tipo_questao === "multipla_escolha" &&
      Array.isArray(alternativas)
    ) {
      html += `<ul class="alternativas" style="list-style:none; padding:0; margin-top:10px; color:#fff;">`;
      alternativas.forEach((a) => {
        html += `
          <li style="padding:5px 0;">
            <b>${a.letra})</b>
            <span data-field="alternativa-texto" data-letra="${a.letra}" data-editable="true"
                  onblur="Generator.collectEditsFromDOM(${index})">${a.texto}</span>
          </li>`;
      });
      html += `</ul>`;
    }
    // V/F
    else if (
      data.tipo_questao === "verdadeiro_falso" &&
      Array.isArray(afirmacoes)
    ) {
      html += `<ul class="alternativas" style="list-style:none; padding:0; margin-top:10px; color:#fff;">`;
      afirmacoes.forEach((af) => {
        const isTrue =
          typeof af.valor === "boolean"
            ? af.valor
            : typeof af.correta === "boolean"
            ? af.correta
            : null;
        const marca = isTrue === null ? "" : isTrue ? "V" : "F";
        html += `
          <li style="padding:5px 0;">
            [ &nbsp;&nbsp; ] 
            <span data-editable="true" onblur="Generator.collectEditsFromDOM(${index})">${
          af.texto
        }</span>
            ${
              marca
                ? ` <small style="color:rgba(255,255,255,0.6)">(${marca})</small>`
                : ""
            }
          </li>`;
      });
      html += `</ul>`;
    }
    // Associação
    else if (data.tipo_questao === "associacao" && colA && colB) {
      html += `
        <div class="cols-container" style="display:flex; gap:20px; margin-top:15px; color:#fff; border:1px solid rgba(255,255,255,0.25); border-radius:8px; padding:10px;">
            <div class="col-box" style="flex:1;">
                <h4 style="color:#fff; margin:0 0 6px 0; border-bottom:2px solid rgba(255,255,255,0.25); padding-bottom:4px;">Coluna A</h4>
                ${colA
                  .map(
                    (i) =>
                      `<div class="assoc-item" style="padding:6px 0; border-bottom:1px dashed rgba(255,255,255,0.2);">
                        <strong>${i.numero}.</strong> <span data-editable="true" onblur="Generator.collectEditsFromDOM(${index})">${i.texto}</span>
                      </div>`
                  )
                  .join("")}
            </div>
            <div class="col-box" style="flex:1;">
                <h4 style="color:#fff; margin:0 0 6px 0; border-bottom:2px solid rgba(255,255,255,0.25); padding-bottom:4px;">Coluna B</h4>
                ${colB
                  .map(
                    (i) =>
                      `<div class="assoc-item" style="padding:6px 0; border-bottom:1px dashed rgba(255,255,255,0.2);">
                        <strong>${i.letra})</strong> <span data-editable="true" onblur="Generator.collectEditsFromDOM(${index})">${i.texto}</span>
                      </div>`
                  )
                  .join("")}
            </div>
        </div>`;
    }

    // ======= GABARITO / MODELO (CAIXA CINZA + TEXTO BRANCO) =======
    let gabaritoContent = "";

    // Discursiva — textarea no mesmo estilo cinza
    if (data.tipo_questao === "discursiva") {
      gabaritoContent = `
        <div style="margin-bottom:10px; font-weight:bold; color:#fff;">📝 Modelo de Resposta (Editável)</div>
        <textarea 
          class="form-control" 
          rows="5" 
          data-field="resposta_esperada"
          style="width:100%; border:1px solid #6b7280; background:#6b7280; color:#fff; padding:10px; border-radius:6px;"
          disabled
          oninput="Generator.updateField(${index}, 'resposta_esperada', this.value)"
        >${data.resposta_esperada || ""}</textarea>
      `;
    } else {
      // Outros tipos — gabarito textual
      let textoGabarito = data.gabarito || "N/A";

      if (
        data.tipo_questao === "verdadeiro_falso" &&
        Array.isArray(afirmacoes)
      ) {
        const visual = afirmacoes
          .map((a) => {
            const v =
              typeof a.valor === "boolean"
                ? a.valor
                : typeof a.correta === "boolean"
                ? a.correta
                : null;
            const marca = v === null ? "?" : v ? "V" : "F";
            return `${a.texto.substring(0, 30)}... <b>(${marca})</b>`;
          })
          .join("<br>");
        textoGabarito = "<br>" + visual;
      }

      gabaritoContent =
        data.tipo_questao === "associacao"
          ? `<strong>Associação Correta:</strong> ${data.gabarito || ""}`
          : `<strong>Gabarito:</strong> ${textoGabarito}`;

      if (data.justificativa_gabarito) {
        gabaritoContent += `
          <div data-field="justificativa_gabarito" data-editable="true"
               contenteditable="false"
               onblur="Generator.updateField(${index}, 'justificativa_gabarito', this.innerText)"
               style="margin-top:10px; font-size:0.9em; color:#e5e7eb; border-top:1px solid #9ca3af; padding-top:5px;">
            💡 ${data.justificativa_gabarito}
          </div>`;
      }
    }

    html += `
      <div class="resposta-esperada" style="margin-top:15px; padding:15px; background:#6b7280; border: 3px solid #6b7280; border-radius:8px; color:#fff;" data-editing="false">
        ${gabaritoContent}

        <div class="gab-actions" style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
          <button class="btn-edit" title="Editar" onclick="Generator.toggleEdit(${index})"
                  style="display:inline-flex; align-items:center; gap:6px; background:#0ea5e9; color:#fff; border:none; border-radius:8px; padding:6px 10px; cursor:pointer;">
            ✏️ <span>Editar</span>
          </button>
          <button class="btn-save" title="Salvar" onclick="Generator.saveEditedQuestion(${index})"
                  style="display:none; align-items:center; gap:6px; background:#22c55e; color:#fff; border:none; border-radius:8px; padding:6px 10px; cursor:pointer;">
            💾 <span>Salvar</span>
          </button>
        </div>
      </div>
    `;

    // Fecha o card
    html += `</div>`;

    return html;
  },

  updateField(index, field, value) {
    if (globalThis.currentQuestions && globalThis.currentQuestions[index]) {
      globalThis.currentQuestions[index][field] = value;
    }
  },
};

// ==================================================
// EXIBIÇÃO
// ==================================================

function displayQuestion(data) {
  displayMultipleQuestions({ questoes: [data], total: 1, sucesso: 1 });
}

function displayMultipleQuestions(resultado) {
  const resultDiv = document.getElementById("result");
  if (!resultDiv) return;

  globalThis.currentQuestions = resultado.questoes || [];

  if (
    globalThis.currentQuestions.length > 0 &&
    Array.isArray(globalThis.currentQuestions[0])
  ) {
    globalThis.currentQuestions = globalThis.currentQuestions.flat();
  }

  let html = `<div style="margin-bottom:20px; color:#fff;"><h3>✅ ${globalThis.currentQuestions.length} Questões Geradas</h3></div>`;

  globalThis.currentQuestions.forEach((q, i) => {
    html += Generator.renderCardHTML(q, i);
  });

  // Barra de ações
  html += `
    <div class="actions" style="margin-top: 30px; padding: 20px; background: transparent; border-top: 1px solid rgba(255,255,255,0.18); text-align:center; display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
      <button class="btn" onclick="location.reload()" style="background:#333; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">🔄 Limpar / Nova</button>
      <div style="width:1px; background:rgba(255,255,255,0.18); margin:0 5px;"></div>
      <button id="btn-pdf" style="background:#dc3545; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">📄 PDF</button>
      <button id="btn-word" style="background:#007bff; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">📝 Word</button>
      <button id="btn-json" style="background:#17a2b8; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">💾 JSON</button>
      <button id="btn-csv" style="background:#28a745; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">📊 CSV</button>
      <button id="btn-zip" style="background:#ffc107; color:black; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">📦 ZIP</button>
      <button id="btn-copy" style="background:#6c757d; color:white; padding:10px 20px; border:none; border-radius:5px; cursor:pointer;">📋 Copiar</button>
    </div>
  `;

  resultDiv.innerHTML = html;
  resultDiv.classList.add("active");
  resultDiv.scrollIntoView({ behavior: "smooth" });

  // Listeners
  setTimeout(() => {
    const qs = globalThis.currentQuestions;
    document
      .getElementById("btn-pdf")
      ?.addEventListener("click", () => globalThis.exportAllPDF?.(qs));
    document
      .getElementById("btn-word")
      ?.addEventListener("click", () => globalThis.exportAllWord?.(qs));
    document
      .getElementById("btn-json")
      ?.addEventListener("click", () => globalThis.exportAllJSON?.(qs));
    document
      .getElementById("btn-csv")
      ?.addEventListener("click", () => globalThis.exportAllCSV?.(qs));
    document
      .getElementById("btn-zip")
      ?.addEventListener("click", () => globalThis.exportAllZIP?.(qs));
    document
      .getElementById("btn-copy")
      ?.addEventListener("click", () => globalThis.copyAllQuestions?.(qs));
  }, 500);
}

// Exporta globalmente
if (typeof globalThis !== "undefined") {
  globalThis.Generator = Generator;
  globalThis.displayQuestion = displayQuestion;
  globalThis.displayMultipleQuestions = displayMultipleQuestions;
}

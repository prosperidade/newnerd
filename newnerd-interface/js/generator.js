// ========================================
// GERADOR DE QUESTÕES - VERSÃO COM VARIAÇÃO
// ========================================

const Generator = {
  async generateOne(params, variacaoIndex = 0) {
    // 🔁 Endpoint da Edge Function — sem n8n
    const endpoint = CONFIG.GENERATE_FUNCTION_URL || CONFIG.WEBHOOK_URL;

    console.log("📬 Enviando requisição para Edge Function:", endpoint, params);

    const paramsComVariacao = {
      ...params,
      variacao: `v${variacaoIndex}_${Date.now()}`,
      seed: Math.floor(Math.random() * 1e9),
      timestamp: new Date().toISOString(),
    };

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
        body: JSON.stringify(paramsComVariacao),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log("📦 Response status:", response.status);

      const rawText = await response.text();
      console.log("📦 Response text:", rawText);

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${rawText}`);
      if (!rawText || !rawText.trim())
        throw new Error(CONFIG.MESSAGES.ERROR_EMPTY);

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        console.error("❌ Erro ao parsear JSON:", rawText);
        throw new Error(`Resposta inválida: ${rawText.substring(0, 200)}...`);
      }

      // ✅ Compatível com formato da Edge Function { questoes: [...] }
      if (data && Array.isArray(data.questoes)) {
        console.log(
          "🔄 Extraindo primeira questão do array retornado pela função..."
        );
        data = data.questoes.length > 0 ? data.questoes[0] : null;
      }

      if (!data)
        throw new Error("Resposta vazia da função — nenhuma questão gerada.");

      // 🧩 Detecta o tipo da questão automaticamente
      if (!data.tipo_questao) {
        if (data.alternativas?.length) data.tipo_questao = "multipla_escolha";
        else if (data.resposta_esperada) data.tipo_questao = "discursiva";
        else if (data.afirmacoes?.length)
          data.tipo_questao = "verdadeiro_falso";
        else if (data.coluna_a && data.coluna_b)
          data.tipo_questao = "associacao";
        else data.tipo_questao = "desconhecido";
        console.log(`🧩 Tipo detectado automaticamente: ${data.tipo_questao}`);
      }

      console.log("✅ Questão gerada:", data);
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError")
        throw new Error(CONFIG.MESSAGES.ERROR_TIMEOUT);
      if (error.message.includes("fetch"))
        throw new Error(CONFIG.MESSAGES.ERROR_NETWORK);
      throw error;
    }
  },

  /**
   * Gera exemplos diferentes para cada iteração
   * Isso ajuda a IA a criar questões mais variadas
   */
  getExemploDiferente(index) {
    const exemplos = [
      "Crie uma questão abordando aspectos práticos",
      "Foque em aplicações do cotidiano",
      "Desenvolva uma questão com análise crítica",
      "Crie uma questão contextualizada",
      "Aborde o tema de forma interdisciplinar",
      "Foque em resolução de problemas",
      "Crie uma questão com gráficos ou tabelas",
      "Desenvolva uma questão interpretativa",
      "Aborde conceitos fundamentais",
      "Crie uma questão desafiadora",
    ];
    return exemplos[index % exemplos.length];
  },

  // ========================================
  // NOVO: geração múltipla com concorrência limitada (3)
  // mantém a mesma assinatura pública e retorno
  // ========================================
  async generateMultiple(params, quantidade) {
    const questoes = [];
    const erros = [];

    // UI de progresso (preservada)
    const progressContainer = document.getElementById("progressContainer");
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");
    const loadingText = document.getElementById("loadingText");
    if (progressContainer) progressContainer.style.display = "block";
    if (progressFill) progressFill.style.width = "0%";
    if (progressText) progressText.textContent = `0 de ${quantidade}`;
    if (loadingText) loadingText.textContent = `Preparando geração...`;

    // controles de concorrência
    const MAX_CONCORRENTES = Math.min(3, Math.max(1, quantidade));
    let proximoIndice = 0;
    let concluidas = 0;

    const t0 = performance.now();

    const runWorker = async () => {
      while (true) {
        // obter índice da próxima tarefa
        const i = proximoIndice;
        if (i >= quantidade) break;
        proximoIndice++;

        try {
          if (loadingText)
            loadingText.textContent = `Gerando questões (${concluidas}/${quantidade})...`;

          // ⭐ passar o índice para variação
          const questao = await this.generateOne(params, i);
          questoes.push(questao);
          console.log(`✅ Questão ${i + 1}/${quantidade} gerada`);
        } catch (error) {
          console.error(`❌ Erro na questão ${i + 1}:`, error);
          erros.push({ indice: i + 1, mensagem: error.message });
        } finally {
          concluidas++;
          const progresso = Math.min(100, (concluidas / quantidade) * 100);
          if (progressFill) progressFill.style.width = progresso + "%";
          if (progressText)
            progressText.textContent = `${concluidas} de ${quantidade}`;
        }
      }
    };

    // dispara N workers em paralelo (concorrência limitada)
    const workers = Array.from({ length: MAX_CONCORRENTES }, () => runWorker());
    await Promise.all(workers);

    // encerra UI de progresso
    if (progressContainer) progressContainer.style.display = "none";
    if (progressFill) progressFill.style.width = "0%";

    // métricas
    const t1 = performance.now();
    const durationMs = Math.max(0, t1 - t0);
    const sucesso = questoes.length;
    const avgMs = sucesso > 0 ? durationMs / sucesso : 0;

    console.info(
      `[Generator] ⏱️ Tempo total: ${(durationMs / 1000).toFixed(2)}s | ` +
        `Média/questão: ${(avgMs / 1000).toFixed(2)}s | ` +
        `Sucesso: ${sucesso}/${quantidade} | Erros: ${erros.length}`
    );

    return {
      questoes,
      erros,
      sucesso,
      total: quantidade,
      metrics: {
        durationMs,
        avgMs,
        concorrencia: MAX_CONCORRENTES,
        timestamp: new Date().toISOString(),
      },
    };
  },

  buildParams(formData) {
    const params = {
      mensagem: formData.tema,
      tipo: formData.tipo,
      serie: formData.serie,
      dificuldade: formData.dificuldade,
    };
    if (formData.disciplina && formData.disciplina !== "auto")
      params.disciplina = formData.disciplina;
    if (formData.criterios && formData.criterios.trim())
      params.criterios_professor = formData.criterios.trim();
    return params;
  },

  // ========================================
  // GERAR PROVA COMPLETA
  // ========================================
  async gerarProvaCompleta(config) {
    console.log("📋 Iniciando geração de prova completa:", config);

    const prova = {
      titulo: config.titulo,
      disciplina: config.disciplina,
      serie: config.serie,
      topicos: config.topicos,
      dificuldade: config.dificuldade,
      questoes: [],
      data_geracao: new Date().toISOString(),
    };

    const tipos = [
      { tipo: "multipla_escolha", qtd: config.qtdMultipla },
      { tipo: "discursiva", qtd: config.qtdDiscursiva },
      { tipo: "verdadeiro_falso", qtd: config.qtdVF },
      { tipo: "associacao", qtd: config.qtdAssoc },
    ];

    // Mostrar loading
    const loading = document.getElementById("loading");
    const loadingText = document.getElementById("loadingText");
    const progressContainer = document.getElementById("progressContainer");
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");

    if (loading) loading.style.display = "block";
    if (progressContainer) progressContainer.style.display = "block";

    const totalQuestoes = tipos.reduce((acc, t) => acc + t.qtd, 0);
    let geradas = 0;

    try {
      for (const tipoConfig of tipos) {
        if (tipoConfig.qtd === 0) continue;

        // Distribuir tópicos entre questões
        const topicoPorQuestao = this.distribuirTopicos(
          config.topicos,
          tipoConfig.qtd
        );

        for (let i = 0; i < tipoConfig.qtd; i++) {
          if (loadingText) {
            loadingText.textContent = `Gerando questão ${
              geradas + 1
            } de ${totalQuestoes}...`;
          }

          // Determinar dificuldade
          let dificuldade = config.dificuldade;
          if (dificuldade === "mista") {
            const dificuldades = ["fácil", "média", "difícil"];
            dificuldade =
              dificuldades[Math.floor(Math.random() * dificuldades.length)];
          }

          const params = {
            tema: topicoPorQuestao[i],
            tipo_questao: tipoConfig.tipo,
            disciplina: config.disciplina,
            serie: config.serie,
            dificuldade: dificuldade,
          };

          const questao = await this.generateOne(params, geradas);
          prova.questoes.push(questao);

          geradas++;

          // Atualizar progresso
          if (progressFill) {
            progressFill.style.width = `${(geradas / totalQuestoes) * 100}%`;
          }
          if (progressText) {
            progressText.textContent = `${geradas} de ${totalQuestoes}`;
          }

          // Pequeno delay para não sobrecarregar API
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      console.log("✅ Prova completa gerada:", prova);

      // Esconder loading
      if (loading) loading.style.display = "none";
      if (progressContainer) progressContainer.style.display = "none";

      return prova;
    } catch (error) {
      console.error("❌ Erro ao gerar prova:", error);
      if (loading) loading.style.display = "none";
      if (progressContainer) progressContainer.style.display = "none";
      throw error;
    }
  },

  // Distribuir tópicos entre questões
  distribuirTopicos(topicos, quantidade) {
    const resultado = [];
    for (let i = 0; i < quantidade; i++) {
      resultado.push(topicos[i % topicos.length]);
    }
    return resultado;
  },

  // ================================================================
  // ⭐️ NOVA FUNÇÃO ADICIONADA PARA CORRIGIR O ERRO DA PROVA ⭐️
  // ================================================================
  /**
   * Renderiza o HTML de uma ÚNICA questão e RETORNA O HTML.
   * Esta é uma função "pura" para ser usada dentro de um .map()
   * A lógica visual é copiada de `displayQuestion` para consistência.
   */
  renderQuestion(data, index) {
    if (!data || !data.enunciado) {
      console.warn("Tentativa de renderizar questão inválida:", data);
      return `<div class="error active">❌ Questão ${
        index + 1
      } inválida - formato não reconhecido</div>`;
    }

    // Mapa de tipos de questão
    const tiposQuestao = {
      multipla_escolha: "Múltipla Escolha",
      discursiva: "Discursiva",
      verdadeiro_falso: "Verdadeiro/Falso",
      associacao: "Associação",
    };

    const tipoLabel =
      typeof CONFIG !== "undefined" && CONFIG.QUESTION_TYPES
        ? CONFIG.QUESTION_TYPES[data.tipo_questao] || "Tipo Desconhecido"
        : tiposQuestao[data.tipo_questao] || "Tipo Desconhecido";

    // Adiciona o separador
    let html = `
      <div class="question-separator" style="margin: 30px 0; padding: 15px; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid var(--primary-color);">
        <h3 style="font-size: 1.2rem; color: var(--primary-color);">🔖 Questão ${
          index + 1
        }</h3>
      </div>
    `;

    // Adiciona o card da questão
    html += `
      <div class="question-card" data-question-id="${data.id || ""}">
        <div class="question-header">
          <div class="question-badges">
            <span class="badge badge-primary">${tipoLabel}</span>
            <span class="badge badge-success">${
              data.disciplina || "Geral"
            }</span>
            <span class="badge badge-warning">${data.serie || "Geral"}</span>
          </div>
        </div>
        <div class="question-enunciado">${data.enunciado}</div>
    `;

    // MÚLTIPLA ESCOLHA
    if (data.tipo_questao === "multipla_escolha" && data.alternativas) {
      html += '<ul class="alternativas">';
      data.alternativas.forEach((alt) => {
        const isCorreta = alt.letra === data.gabarito ? "correta" : "";
        html += `<li class="alternativa ${isCorreta}"><span class="alternativa-letra">${alt.letra})</span> ${alt.texto}</li>`;
      });
      html += "</ul>";
      if (data.justificativa_gabarito)
        html += `<div class="resposta-esperada" style="margin-top: 15px;"><strong>💡 Justificativa:</strong> ${data.justificativa_gabarito}</div>`;
    }

    // DISCURSIVA
    if (data.tipo_questao === "discursiva" && data.resposta_esperada)
      html += `<div class="resposta-esperada" style="margin-top: 15px;"><strong>🔖 Resposta Esperada:</strong><br>${data.resposta_esperada}</div>`;

    // VERDADEIRO/FALSO
    if (data.tipo_questao === "verdadeiro_falso" && data.afirmacoes) {
      html += '<ul class="alternativas" style="margin-top: 15px;">';
      data.afirmacoes.forEach((afirm, idx) => {
        html += `<li class="alternativa"><strong>${idx + 1}.</strong> ${
          afirm.texto
        } <span class="badge ${
          afirm.valor ? "badge-success" : "badge-error"
        }" style="margin-left: 10px;">${
          afirm.valor ? "✓ Verdadeiro" : "✗ Falso"
        }</span></li>`;
      });
      html += "</ul>";
      if (data.justificativa_gabarito)
        html += `<div class="resposta-esperada" style="margin-top: 15px;"><strong>💡 Explicação:</strong> ${data.justificativa_gabarito}</div>`;
    }

    // ASSOCIAÇÃO
    if (data.tipo_questao === "associacao" && data.coluna_a && data.coluna_b) {
      html +=
        '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;"><div><strong>📌 Coluna A:</strong><ul class="alternativas" style="margin-top: 10px;">';
      data.coluna_a.forEach(
        (item) =>
          (html += `<li class="alternativa"><strong>${item.numero}.</strong> ${item.texto}</li>`)
      );
      html +=
        '</ul></div><div><strong>📦 Coluna B:</strong><ul class="alternativas" style="margin-top: 10px;">';
      data.coluna_b.forEach(
        (item) =>
          (html += `<li class="alternativa"><strong>${item.letra})</strong> ${item.texto}</li>`)
      );
      html += "</ul></div></div>";
      if (data.gabarito)
        html += `<div class="resposta-esperada" style="margin-top: 15px;"><strong>🎯 Gabarito:</strong> ${data.gabarito}</div>`;
    }

    // CRITÉRIOS
    if (
      data.criterios_avaliacao &&
      Array.isArray(data.criterios_avaliacao) &&
      data.criterios_avaliacao.length > 0
    ) {
      html +=
        '<div class="criterios" style="margin-top: 20px;"><strong>📋 Critérios de Avaliação:</strong>';
      data.criterios_avaliacao.forEach(
        (crit) =>
          (html += `<div class="criterio"><div class="criterio-header">${crit.aspecto} (${crit.peso}%)</div><div>${crit.descricao}</div></div>`)
      );
      html += "</div>";
    }

    // STATS
    html += `<div class="stats">
      <div class="stat-item"><div class="stat-value">${
        data.tokens_usados || 0
      }</div><div class="stat-label">Tokens</div></div>
      <div class="stat-item"><div class="stat-value">$${(
        data.custo_estimado || 0
      ).toFixed(6)}</div><div class="stat-label">Custo</div></div>
      <div class="stat-item"><div class="stat-value">${
        data.dificuldade || "N/A"
      }</div><div class="stat-label">Dificuldade</div></div>
      <div class="stat-item"><div class="stat-value">${
        data.api_usada || "N/A"
      }</div><div class="stat-label">API</div></div>
    </div>`;

    // Fecha o card
    html += `</div>`;

    return html;
  },
  async salvarRespostaEditada(id) {
    try {
      const textarea = document.getElementById(`resposta_${id}`);
      if (!textarea) return alert("Campo de resposta não encontrado.");
      const novaResposta = textarea.value.trim();
      if (!novaResposta) return alert("Digite uma resposta antes de salvar.");

      console.log(`💾 Salvando resposta editada (${id}):`, novaResposta);

      // Atualiza localStorage
      const questao = Storage.getQuestaoById(id);
      if (questao) {
        questao.resposta_editada = novaResposta;
        Storage.atualizarQuestao(id, { resposta_editada: novaResposta });
      }

      // Atualiza Supabase (se disponível)
      if (CONFIG?.SUPABASE_URL && CONFIG?.SUPABASE_ANON_KEY) {
        const resp = await fetch(
          `${CONFIG.SUPABASE_URL}/rest/v1/questoes_geradas?id=eq.${id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: CONFIG.SUPABASE_ANON_KEY,
              Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              resposta_editada: novaResposta,
              ultima_atualizacao: new Date().toISOString(),
            }),
          }
        );

        if (resp.ok) {
          console.log("✅ Resposta salva no Supabase!");
          alert("✅ Resposta salva com sucesso!");
        } else {
          const err = await resp.text();
          console.error("❌ Erro ao salvar no Supabase:", err);
          alert("❌ Erro ao salvar resposta no banco.");
        }
      }
    } catch (err) {
      console.error("❌ Erro ao salvar resposta editada:", err);
      alert("❌ Falha ao salvar resposta.");
    }
  },
}; // <-- FIM DO OBJETO GENERATOR

function displayQuestion(data) {
  const result = document.getElementById("result");
  if (!result) {
    console.error("❌ #result não encontrado");
    return;
  }
  console.log("📺 Exibindo questão:", data);

  if (!data || !data.enunciado) {
    console.error("❌ Dados inválidos:", data);
    result.innerHTML = `<div class="error active">❌ Questão inválida - formato não reconhecido</div>`;
    return;
  }

  // ✅ expõe a questão atual para exportações individuais
  window.currentQuestion = data;

  // Mapa de tipos de questão (fallback se CONFIG não estiver disponível)
  const tiposQuestao = {
    multipla_escolha: "Múltipla Escolha",
    discursiva: "Discursiva",
    verdadeiro_falso: "Verdadeiro/Falso",
    associacao: "Associação",
  };

  const tipoLabel =
    typeof CONFIG !== "undefined" && CONFIG.QUESTION_TYPES
      ? CONFIG.QUESTION_TYPES[data.tipo_questao] || "Tipo Desconhecido"
      : tiposQuestao[data.tipo_questao] || "Tipo Desconhecido";

  let html = `
    <div class="question-card" data-question-id="${data.id || ""}">
      <div class="question-header">
        <div class="question-badges">
          <span class="badge badge-primary">${tipoLabel}</span>
          <span class="badge badge-success">${data.disciplina || "Geral"}</span>
          <span class="badge badge-warning">${data.serie || "Geral"}</span>
        </div>
      </div>
      <div class="question-enunciado">${data.enunciado}</div>
  `;

  // MÚLTIPLA ESCOLHA
  if (data.tipo_questao === "multipla_escolha" && data.alternativas) {
    console.log("🔖 Múltipla escolha:", data.alternativas.length);
    html += '<ul class="alternativas">';
    data.alternativas.forEach((alt) => {
      const isCorreta = alt.letra === data.gabarito ? "correta" : "";
      html += `<li class="alternativa ${isCorreta}"><span class="alternativa-letra">${alt.letra})</span> ${alt.texto}</li>`;
    });
    html += "</ul>";
    if (data.justificativa_gabarito)
      html += `<div class="resposta-esperada" style="margin-top: 15px;"><strong>💡 Justificativa:</strong> ${data.justificativa_gabarito}</div>`;
  }

  // DISCURSIVA
  if (data.tipo_questao === "discursiva" && data.resposta_esperada)
    html += `<div class="resposta-esperada" style="margin-top: 15px;"><strong>🔖 Resposta Esperada:</strong><br>${data.resposta_esperada}</div>`;

  // VERDADEIRO/FALSO
  if (data.tipo_questao === "verdadeiro_falso" && data.afirmacoes) {
    console.log("✓/✗ Verdadeiro/Falso:", data.afirmacoes.length);
    html += '<ul class="alternativas" style="margin-top: 15px;">';
    data.afirmacoes.forEach((afirm, idx) => {
      html += `<li class="alternativa"><strong>${idx + 1}.</strong> ${
        afirm.texto
      } <span class="badge ${
        afirm.valor ? "badge-success" : "badge-error"
      }" style="margin-left: 10px;">${
        afirm.valor ? "✓ Verdadeiro" : "✗ Falso"
      }</span></li>`;
    });
    html += "</ul>";
    if (data.justificativa_gabarito)
      html += `<div class="resposta-esperada" style="margin-top: 15px;"><strong>💡 Explicação:</strong> ${data.justificativa_gabarito}</div>`;
  }

  // ASSOCIAÇÃO
  if (data.tipo_questao === "associacao" && data.coluna_a && data.coluna_b) {
    console.log("🔗 Associação");
    html +=
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;"><div><strong>📌 Coluna A:</strong><ul class="alternativas" style="margin-top: 10px;">';
    data.coluna_a.forEach(
      (item) =>
        (html += `<li class="alternativa"><strong>${item.numero}.</strong> ${item.texto}</li>`)
    );
    html +=
      '</ul></div><div><strong>📦 Coluna B:</strong><ul class="alternativas" style="margin-top: 10px;">';
    data.coluna_b.forEach(
      (item) =>
        (html += `<li class="alternativa"><strong>${item.letra})</strong> ${item.texto}</li>`)
    );
    html += "</ul></div></div>";
    if (data.gabarito)
      html += `<div class="resposta-esperada" style="margin-top: 15px;"><strong>🎯 Gabarito:</strong> ${data.gabarito}</div>`;
  }

  // CRITÉRIOS
  if (
    data.criterios_avaliacao &&
    Array.isArray(data.criterios_avaliacao) &&
    data.criterios_avaliacao.length > 0
  ) {
    console.log("📋 Critérios:", data.criterios_avaliacao.length);
    html +=
      '<div class="criterios" style="margin-top: 20px;"><strong>📋 Critérios de Avaliação:</strong>';
    data.criterios_avaliacao.forEach(
      (crit) =>
        (html += `<div class="criterio"><div class="criterio-header">${crit.aspecto} (${crit.peso}%)</div><div>${crit.descricao}</div></div>`)
    );
    html += "</div>";
  }

  // STATS
  html += `<div class="stats">
    <div class="stat-item"><div class="stat-value">${
      data.tokens_usados || 0
    }</div><div class="stat-label">Tokens</div></div>
    <div class="stat-item"><div class="stat-value">$${(
      data.custo_estimado || 0
    ).toFixed(6)}</div><div class="stat-label">Custo</div></div>
    <div class="stat-item"><div class="stat-value">${
      data.dificuldade || "N/A"
    }</div><div class="stat-label">Dificuldade</div></div>
    <div class="stat-item"><div class="stat-value">${
      data.api_usada || "N/A"
    }</div><div class="stat-label">API</div></div>
  </div>`;

  // AÇÕES — agora com JSON e CSV também, sem onclick inline
  html += `</div>`;

  result.innerHTML = html;
  result.classList.add("active");

  // 🔗 Ligações de evento
  document
    .getElementById("btn-one-new")
    ?.addEventListener("click", () => location.reload());
  document.getElementById("btn-one-copy")?.addEventListener("click", () => {
    if (typeof window.copyQuestion === "function") return copyQuestion();
    alert("Cópia indisponível. Carregue export.js.");
  });
  document.getElementById("btn-one-pdf")?.addEventListener("click", () => {
    if (typeof window.exportPDF === "function") return exportPDF();
    alert("Exportação PDF indisponível. Carregue export.js.");
  });
  document.getElementById("btn-one-word")?.addEventListener("click", () => {
    if (typeof window.exportWord === "function") return exportWord();
    alert("Exportação Word indisponível. Carregue export.js.");
  });
  document.getElementById("btn-one-json")?.addEventListener("click", () => {
    const q = window.currentQuestion ? [window.currentQuestion] : [];
    if (typeof window.exportAllJSON === "function") return exportAllJSON(q);
    alert("Exportação JSON indisponível. Carregue export.js.");
  });
  document.getElementById("btn-one-csv")?.addEventListener("click", () => {
    const q = window.currentQuestion ? [window.currentQuestion] : [];
    if (typeof window.exportAllCSV === "function") return exportAllCSV(q);
    alert("Exportação CSV indisponível. Carregue export.js.");
  });

  console.log("✅ Questão exibida");
}

function displayMultipleQuestions(resultado) {
  const result = document.getElementById("result");
  if (!result) {
    console.error("❌ #result não encontrado");
    return;
  }

  console.log("📺 Exibindo múltiplas questões:", resultado);

  // ✅ expõe o array para exportações em lote (PDF/Word/JSON/CSV/ZIP)
  window.currentQuestions = resultado.questoes || [];

  const tempoTotal = resultado?.metrics?.durationMs ?? 0;
  const tempoMedio = resultado?.metrics?.avgMs ?? 0;
  const resumoTempo = `
    <div style="margin-top:8px; font-size:.95rem; opacity:.9;">
      ⏱️ Tempo total: <b>${(tempoTotal / 1000).toFixed(2)}s</b> ·
      Média por questão: <b>${(tempoMedio / 1000).toFixed(2)}s</b> ·
      Concorrência: <b>${resultado?.metrics?.concorrencia ?? 1}</b>
    </div>`;

  let html = `
    <div class="multiple-results">
      <div class="results-summary" style="background: var(--bg-secondary); padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: center;">
        <h3 style="margin-bottom: 10px;">✅ ${resultado.sucesso} de ${
    resultado.total
  } questões geradas</h3>
        ${
          resultado.erros && resultado.erros.length > 0
            ? `<div class="error-summary" style="color: var(--error-color); margin-top: 10px;">⚠️ ${resultado.erros.length} erro(s)</div>`
            : ""
        }
        ${resumoTempo}
      </div>
  `;

  // Exibir cada questão (preservado)
  (resultado.questoes || []).forEach((q, i) => {
    html += `
      <div class="question-separator" style="margin: 30px 0; padding: 15px; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid var(--primary-color);">
        <h3 style="font-size: 1.2rem; color: var(--primary-color);">🔖 Questão ${
          i + 1
        }</h3>
      </div>
    `;

    // Renderização isolada (hack preservado)
    const tempDiv = document.createElement("div");
    const oldGetElement = document.getElementById;
    document.body.appendChild(tempDiv);
    tempDiv.id = "temp-result";

    document.getElementById = function (id) {
      if (id === "result") return tempDiv;
      return oldGetElement.call(document, id);
    };

    displayQuestion(q);
    html += tempDiv.innerHTML;

    // Restaurar
    document.getElementById = oldGetElement;
    tempDiv.remove();
  });

  // Ações globais — apenas botões, sem funções internas
  html += `
    <div class="actions" style="margin-top: 30px; position: sticky; bottom: 20px; background: var(--bg-card); padding: 20px; border-radius: 8px; box-shadow: var(--shadow-lg);">
      <button class="btn" id="btn-new">🔄 Gerar Novas Questões</button>
      <button class="btn btn-secondary" id="btn-copy-all">📋 Copiar Todas</button>
      <button class="btn btn-secondary" id="btn-all-pdf">📄 Exportar Todas em PDF</button>
      <button class="btn btn-secondary" id="btn-all-word">📝 Exportar Todas em Word</button>
      <button class="btn btn-secondary" id="btn-all-json">🧪 Baixar JSON</button>
      <button class="btn btn-secondary" id="btn-all-csv">🧬 Baixar CSV</button>
      <button class="btn btn-secondary" id="btn-all-zip">📦 Baixar ZIP</button>
    </div>
  </div>`;

  result.innerHTML = html;
  result.classList.add("active");

  // 🔗 Ligações de evento (chamam funções globais do export.js)
  const qs = window.currentQuestions;
  document
    .getElementById("btn-new")
    ?.addEventListener("click", () => location.reload());
  document.getElementById("btn-copy-all")?.addEventListener("click", () => {
    if (typeof window.copyAllQuestions === "function")
      return copyAllQuestions();
    alert("Cópia indisponível. Carregue export.js.");
  });
  document.getElementById("btn-all-pdf")?.addEventListener("click", () => {
    if (typeof window.exportAllPDF === "function") return exportAllPDF(qs);
    alert("Exportação PDF indisponível. Carregue export.js.");
  });
  document.getElementById("btn-all-word")?.addEventListener("click", () => {
    if (typeof window.exportAllWord === "function") return exportAllWord(qs);
    alert("Exportação Word indisponível. Carregue export.js.");
  });
  document.getElementById("btn-all-json")?.addEventListener("click", () => {
    if (typeof window.exportAllJSON === "function") return exportAllJSON(qs);
    alert("Exportação JSON indisponível. Carregue export.js.");
  });
  document.getElementById("btn-all-csv")?.addEventListener("click", () => {
    if (typeof window.exportAllCSV === "function") return exportAllCSV(qs);
    alert("Exportação CSV indisponível. Carregue export.js.");
  });
  document.getElementById("btn-all-zip")?.addEventListener("click", () => {
    if (typeof window.exportAllZIP === "function") return exportAllZIP(qs);
    alert("Exportação ZIP indisponível. Carregue export.js.");
  });

  console.log("✅ Múltiplas questões exibidas");
}

if (typeof window !== "undefined") {
  window.Generator = Generator;
  window.displayQuestion = displayQuestion;
  window.displayMultipleQuestions = displayMultipleQuestions;
}

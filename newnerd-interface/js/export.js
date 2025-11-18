// ========================================
// EXPORTAÇÃO DE QUESTÕES (PDF, WORD, JSON, CSV, ZIP)
// NEW NERD — Compatível com 1 questão e múltiplas
// ========================================

/**
 * Gera texto padronizado de uma questão
 */
function formatarQuestaoTexto(q, idx = 0) {
  let text = `==============================\n`;
  text += `QUESTÃO ${idx + 1} - ${q.tipo_questao || "Questão"}\n`;
  text += `Disciplina: ${q.disciplina || "N/A"} | Série: ${
    q.serie || "N/A"
  } | Dificuldade: ${q.dificuldade || "N/A"}\n`;
  text += `==============================\n\n${q.enunciado || ""}\n\n`;

  if (q.alternativas && q.alternativas.length > 0) {
    q.alternativas.forEach((alt) => {
      text += `${alt.letra}) ${alt.texto}\n`;
    });
    text += `\nGabarito: ${q.gabarito || ""}\n`;
    if (q.justificativa_gabarito)
      text += `Justificativa: ${q.justificativa_gabarito}\n`;
  }

  if (q.resposta_esperada)
    text += `\nResposta Esperada:\n${q.resposta_esperada}\n`;

  if (q.afirmacoes && q.afirmacoes.length > 0) {
    q.afirmacoes.forEach((a, i) => {
      // O prompt n8n usa 'correta', mas o front-end pode usar 'valor'
      const eCorreta = a.correta !== undefined ? a.correta : a.valor;
      text += `${i + 1}. ${a.texto} - ${eCorreta ? "VERDADEIRO" : "FALSO"}\n`;
    });
  }

  if (q.coluna_a && q.coluna_b) {
    text += `\nColuna A:\n`;
    q.coluna_a.forEach((i) => (text += `${i.numero}. ${i.texto}\n`));
    text += `\nColuna B:\n`;
    q.coluna_b.forEach((i) => (text += `${i.letra}) ${i.texto}\n`));
    text += `\nGabarito: ${q.gabarito || ""}\n`;
  }

  if (q.criterios_avaliacao && q.criterios_avaliacao.length > 0) {
    text += `\nCritérios de Avaliação:\n`;
    q.criterios_avaliacao.forEach((c) => {
      text += `- ${c.aspecto} (${c.peso}%): ${c.descricao}\n`;
    });
  }

  return text + "\n";
}

/* ======================================================================
    INDIVIDUAL: Copy / PDF / Word
    ====================================================================== */

/**
 * Copia a questão atual para a área de transferência
 */
async function copyQuestion(questionId) {
  try {
    let q = null;
    if (questionId && typeof Storage?.getQuestaoById === "function") {
      q = Storage.getQuestaoById(questionId);
    } else if (window.currentQuestion) {
      q = window.currentQuestion;
    }

    if (!q || !q.enunciado) {
      console.error("[Export][Copy] Questão não encontrada:", {
        questionId,
        q,
      });
      alert("❌ Nenhuma questão disponível para copiar");
      return;
    }

    const text =
      typeof formatarQuestaoTexto === "function"
        ? formatarQuestaoTexto(q, 0)
        : q.enunciado || "";
    await navigator.clipboard.writeText(text);
    console.log("[Export][Copy] Copiado com sucesso");
    alert("✅ Questão copiada para a área de transferência!");
  } catch (err) {
    console.error("❌ Erro ao copiar:", err);
    alert("❌ Erro ao copiar. Use Ctrl+C manualmente.");
  }
}

/**
 * Exporta a questão atual para PDF (jsPDF necessário)
 */
function exportPDF(questionId) {
  let q = null;
  if (questionId && typeof Storage?.getQuestaoById === "function") {
    q = Storage.getQuestaoById(questionId);
  } else if (window.currentQuestion) {
    q = window.currentQuestion;
  }

  if (!q || !q.enunciado) {
    console.error("[Export][PDF] Questão não encontrada:", { questionId, q });
    alert("❌ Nenhuma questão disponível para exportar");
    return;
  }
  if (typeof window.jspdf === "undefined") {
    alert("❌ Biblioteca jsPDF não carregada");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;
  const margin = 20;
  const lineHeight = 7;
  const pageHeight = doc.internal.pageSize.height;

  const addText = (text, bold = false, size = 11) => {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(size);
    doc.setFont(undefined, bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(String(text ?? ""), 170);
    doc.text(lines, margin, y);
    y += Math.max(lineHeight, lines.length * lineHeight);
  };

  addText("NEW NERD — Questão Gerada", true, 16);
  y += 3;
  addText(
    `Tipo: ${QUESTION_TYPES?.[q.tipo_questao] || q.tipo_questao || "N/A"}`,
    false,
    10
  );
  addText(`Disciplina: ${q.disciplina || "N/A"}`, false, 10);
  addText(`Série: ${q.serie || "N/A"}`, false, 10);
  addText(`Dificuldade: ${q.dificuldade || "N/A"}`, false, 10);
  y += 4;

  addText("Enunciado:", true, 12);
  addText(q.enunciado || "", false, 11);
  y += 3;

  if (q.alternativas?.length) {
    addText("Alternativas:", true, 12);
    q.alternativas.forEach((alt) => {
      const isCorreta = alt.letra === q.gabarito ? " ✓" : "";
      addText(`${alt.letra}) ${alt.texto}${isCorreta}`);
    });
    if (q.gabarito) {
      y += 2;
      addText(`Gabarito: ${q.gabarito}`, true);
    }
    if (q.justificativa_gabarito) {
      y += 2;
      addText("Justificativa:", true);
      addText(q.justificativa_gabarito);
    }
    y += 2;
  }

  if (q.resposta_esperada) {
    addText("Resposta Esperada:", true, 12);
    addText(q.resposta_esperada);
    y += 2;
  }

  if (q.afirmacoes?.length) {
    addText("Afirmações:", true, 12);
    q.afirmacoes.forEach((afirm, idx) => {
      const eCorreta =
        afirm.correta !== undefined ? afirm.correta : afirm.valor;
      const status = eCorreta ? "Verdadeiro ✓" : "Falso ✗";
      addText(`${idx + 1}. ${afirm.texto} — ${status}`);
    });
    y += 2;
  }

  if (q.coluna_a?.length && q.coluna_b?.length) {
    addText("Coluna A:", true, 12);
    q.coluna_a.forEach((item) => addText(`${item.numero}. ${item.texto}`));
    y += 2;
    addText("Coluna B:", true, 12);
    q.coluna_b.forEach((item) => addText(`${item.letra}) ${item.texto}`));
    if (q.gabarito) {
      y += 2;
      addText(`Gabarito: ${q.gabarito}`, true);
    }
  }

  const filename = `newnerd-questao-${Date.now()}.pdf`;
  doc.save(filename);
  console.log("[Export][PDF] Gerado:", filename);
}

/**
 * Exporta a questão atual para Word (DOCX) — fallback em .doc
 */
async function exportWord(questionId) {
  let q = null;
  if (questionId && typeof Storage?.getQuestaoById === "function") {
    q = Storage.getQuestaoById(questionId);
  } else if (window.currentQuestion) {
    q = window.currentQuestion;
  }

  if (!q || !q.enunciado) {
    console.error("[Export][Word] Questão não encontrada:", { questionId, q });
    alert("❌ Nenhuma questão disponível para exportar");
    return;
  }

  // Fallback simples se docx não estiver carregado
  if (typeof window.docx === "undefined") {
    let html = `
      <!DOCTYPE html>
      <html><head><meta charset="utf-a"><title>NEW NERD — Questão</title></head>
      <body style="font-family: Arial; padding: 20px;">
        <h1>NEW NERD — Questão Gerada</h1>
        <p><strong>Tipo:</strong> ${
          QUESTION_TYPES?.[q.tipo_questao] || q.tipo_questao || "N/A"
        }</p>
        <p><strong>Disciplina:</strong> ${q.disciplina || "N/A"}</p>
        <p><strong>Série:</strong> ${q.serie || "N/A"}</p>
        <p><strong>Dificuldade:</strong> ${q.dificuldade || "N/A"}</p>
        <h2>Enunciado</h2>
        <p>${q.enunciado || ""}</p>`;
    if (q.alternativas?.length) {
      html += "<h2>Alternativas</h2><ul>";
      q.alternativas.forEach(
        (alt) =>
          (html += `<li><strong>${alt.letra})</strong> ${alt.texto}</li>`)
      );
      html += "</ul>";
      if (q.gabarito) html += `<p><strong>Gabarito:</strong> ${q.gabarito}</p>`;
      if (q.justificativa_gabarito)
        html += `<p><strong>Justificativa:</strong> ${q.justificativa_gabarito}</p>`;
    }
    if (q.resposta_esperada)
      html += `<h2>Resposta Esperada</h2><p>${q.resposta_esperada}</p>`;
    html += "</body></html>";

    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newnerd-questao-${Date.now()}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    console.log("[Export][Word] Fallback gerado (.doc)");
    return;
  }

  // DOCX com a lib docx
  const { Document, Paragraph, HeadingLevel, Packer } = window.docx;
  const children = [];
  children.push(
    new Paragraph({
      text: "NEW NERD — Questão Gerada",
      heading: HeadingLevel.HEADING_1,
    })
  );
  children.push(
    new Paragraph({
      text: `Tipo: ${
        QUESTION_TYPES?.[q.tipo_questao] || q.tipo_questao || "N/A"
      }`,
    })
  );
  children.push(
    new Paragraph({ text: `Disciplina: ${q.disciplina || "N/A"}` })
  );
  children.push(new Paragraph({ text: `Série: ${q.serie || "N/A"}` }));
  children.push(
    new Paragraph({ text: `Dificuldade: ${q.dificuldade || "N/A"}` })
  );
  children.push(new Paragraph({ text: "" }));
  children.push(
    new Paragraph({ text: "Enunciado", heading: HeadingLevel.HEADING_2 })
  );
  children.push(new Paragraph({ text: q.enunciado || "" }));

  if (q.alternativas?.length) {
    children.push(new Paragraph({ text: "" }));
    children.push(
      new Paragraph({ text: "Alternativas", heading: HeadingLevel.HEADING_2 })
    );
    q.alternativas.forEach((alt) =>
      children.push(
        new Paragraph({
          text: `${alt.letra}) ${alt.texto}${
            alt.letra === q.gabarito ? " ✓" : ""
          }`,
        })
      )
    );
    if (q.gabarito)
      children.push(new Paragraph({ text: `Gabarito: ${q.gabarito}` }));
    if (q.justificativa_gabarito) {
      children.push(new Paragraph({ text: "" }));
      children.push(
        new Paragraph({
          text: "Justificativa",
          heading: HeadingLevel.HEADING_2,
        })
      );
      children.push(new Paragraph({ text: q.justificativa_gabarito }));
    }
  }

  if (q.resposta_esperada) {
    children.push(new Paragraph({ text: "" }));
    children.push(
      new Paragraph({
        text: "Resposta Esperada",
        heading: HeadingLevel.HEADING_2,
      })
    );
    children.push(new Paragraph({ text: q.resposta_esperada }));
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `newnerd-questao-${Date.now()}.docx`;
  a.click();
  URL.revokeObjectURL(a.href);
  console.log("[Export][Word] DOCX gerado");
}

/* ======================================================================
    LOTE: PDF / Word / JSON / CSV / ZIP
    ====================================================================== */

// ⭐️ FUNÇÃO ADICIONADA/CORRIGIDA ⭐️
/**
 * Copia TODAS as questões (lote/prova) para a área de transferência.
 */
async function copyAllQuestions() {
  const questoes = window.currentQuestions || [];
  if (!questoes || questoes.length === 0) {
    alert("❌ Nenhuma questão para copiar.");
    return;
  }

  try {
    const text = (questoes || [])
      .map((q, i) => formatarQuestaoTexto(q, i))
      .join("\n");

    await navigator.clipboard.writeText(text);
    console.log(`[Export][CopyAll] ${questoes.length} copiadas com sucesso`);
    alert("✅ Todas as questões copiadas para a área de transferência!");
  } catch (err) {
    console.error("❌ Erro ao copiar todas as questões:", err);
    alert("❌ Erro ao copiar. Use Ctrl+C manualmente.");
  }
}

// PDF (várias)
function exportAllPDF(
  questoes = window.currentQuestions,
  titulo = "questoes-lote"
) {
  if (!questoes || questoes.length === 0) {
    alert("❌ Nenhuma questão para exportar");
    return;
  }
  if (typeof window.jspdf === "undefined") {
    alert("❌ Biblioteca jsPDF não carregada");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;
  const margin = 20;
  const lineHeight = 7;
  const pageHeight = doc.internal.pageSize.height;
  const addText = (text, bold = false, size = 11) => {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(size);
    doc.setFont(undefined, bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(String(text ?? ""), 170);
    doc.text(lines, margin, y);
    y += Math.max(lineHeight, lines.length * lineHeight);
  };

  doc.setFontSize(16);
  addText(`NEW NERD — ${titulo || "Questões Geradas"}`, true, 16);
  doc.setFontSize(11);
  (questoes || []).forEach((q, idx) => {
    y += 8;
    addText(formatarQuestaoTexto(q, idx), false, 11);
  });

  const filename = `newnerd-${titulo.replace(/ /g, "_")}-${Date.now()}.pdf`;
  doc.save(filename);
  console.log(`[Export][PDF] Gerado: ${filename}`);
}

// Word (várias)
async function exportAllWord(
  questoes = window.currentQuestions,
  titulo = "questoes-lote"
) {
  if (!questoes || questoes.length === 0) {
    alert("❌ Nenhuma questão para exportar");
    return;
  }
  if (typeof window.docx === "undefined") {
    alert("❌ Biblioteca docx não carregada. Gerando versão simples.");
    exportAllWordSimple(questoes, titulo);
    return;
  }

  const { Document, Paragraph, HeadingLevel, Packer } = window.docx;
  const children = [];

  children.push(
    new Paragraph({
      text: `NEW NERD — ${titulo || "Questões Geradas"}`,
      heading: HeadingLevel.HEADING_1,
    })
  );
  (questoes || []).forEach((q, idx) => {
    const textoFormatado = formatarQuestaoTexto(q, idx);
    const paragrafos = textoFormatado
      .split("\n")
      .map((linha) => new Paragraph({ text: linha }));

    children.push(
      new Paragraph({
        text: `Questão ${idx + 1}`,
        heading: HeadingLevel.HEADING_2,
      })
    );
    children.push(...paragrafos);
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `newnerd-${titulo.replace(/ /g, "_")}-${Date.now()}.docx`;
  a.click();
  URL.revokeObjectURL(a.href);
  console.log(`[Export][Word] Lote gerado`);
}

// Word simples (fallback, várias)
function exportAllWordSimple(questoes, titulo = "questoes-lote") {
  let html = `<html><head><meta charset='utf-8'><title>NEW NERD Questões</title></head><body style='font-family:Arial;padding:20px;'>`;
  html += `<h1>NEW NERD — ${titulo || "Questões Geradas"}</h1>`;
  (questoes || []).forEach((q, i) => {
    html += `<h2>Questão ${i + 1}</h2><pre>${formatarQuestaoTexto(q, i)}</pre>`;
  });
  html += `</body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `newnerd-${titulo.replace(/ /g, "_")}-${Date.now()}.doc`;
  a.click();
  URL.revokeObjectURL(url);
  console.log(`[Export][WordSimple] Lote gerado`);
}

// JSON (várias)
function exportAllJSON(
  questoes = window.currentQuestions,
  titulo = "questoes"
) {
  if (!questoes || questoes.length === 0) {
    alert("❌ Nenhuma questão para exportar");
    return;
  }
  const blob = new Blob([JSON.stringify(questoes, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `newnerd-${titulo.replace(/ /g, "_")}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  console.log(`[Export][JSON] ${questoes.length} questões exportadas.`);
}

// CSV (várias)
function exportAllCSV(questoes = window.currentQuestions, titulo = "questoes") {
  if (!questoes || questoes.length === 0) {
    alert("❌ Nenhuma questão para exportar");
    return;
  }
  const cols = [
    "tipo_questao",
    "disciplina",
    "serie",
    "dificuldade",
    "enunciado",
    "gabarito",
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`; // CSV-safe
  let csv = cols.join(",") + "\n";
  (questoes || []).forEach((q) => {
    csv += cols.map((c) => esc(q[c])).join(",") + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `newnerd-${titulo.replace(/ /g, "_")}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  console.log(`[Export][CSV] ${questoes.length} linhas exportadas.`);
}

// ZIP (várias)
async function exportAllZIP(
  questoes = window.currentQuestions,
  titulo = "questoes"
) {
  if (!questoes || questoes.length === 0) {
    alert("❌ Nenhuma questão para exportar");
    return;
  }
  if (typeof JSZip === "undefined") {
    alert("❌ Biblioteca JSZip não carregada");
    return;
  }

  const now = Date.now();
  const zip = new JSZip();
  const baseName = `newnerd-${titulo.replace(/ /g, "_")}-${now}`;

  // JSON
  zip.file(`${baseName}.json`, JSON.stringify(questoes, null, 2));

  // CSV
  const cols = [
    "tipo_questao",
    "disciplina",
    "serie",
    "dificuldade",
    "enunciado",
    "gabarito",
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  let csv = cols.join(",") + "\n";
  (questoes || []).forEach((q) => {
    csv += cols.map((c) => esc(q[c])).join(",") + "\n";
  });
  zip.file(`${baseName}.csv`, csv);

  // Texto puro (útil para colar em planilhas ou docs)
  const text = (questoes || [])
    .map((q, i) => formatarQuestaoTexto(q, i))
    .join("\n");
  zip.file(`${baseName}.txt`, text);

  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${baseName}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);

  console.log(`[Export][ZIP] Pacote gerado com ${questoes.length} questões.`);
}

/* ======================================================================
    Mapeamento Global — manter ESTE bloco no FINAL do arquivo
    ====================================================================== */
if (typeof window !== "undefined") {
  // individuais
  window.copyQuestion =
    typeof copyQuestion === "function" ? copyQuestion : undefined;
  window.exportPDF = typeof exportPDF === "function" ? exportPDF : undefined;
  window.exportWord = typeof exportWord === "function" ? exportWord : undefined;

  // lote
  window.copyAllQuestions =
    typeof copyAllQuestions === "function" ? copyAllQuestions : undefined;
  window.exportAllPDF =
    typeof exportAllPDF === "function" ? exportAllPDF : undefined;
  window.exportAllWord =
    typeof exportAllWord === "function" ? exportAllWord : undefined;
  window.exportAllJSON =
    typeof exportAllJSON === "function" ? exportAllJSON : undefined;
  window.exportAllCSV =
    typeof exportAllCSV === "function" ? exportAllCSV : undefined;
  window.exportAllZIP =
    typeof exportAllZIP === "function" ? exportAllZIP : undefined;
}

// ========================================
// DASHBOARD E ESTATÍSTICAS
// ========================================

/**
 * Atualiza o dashboard com estatísticas
 */
function updateDashboard() {
  const stats = Storage.getEstatisticas();

  // Atualizar cards de estatísticas
  updateStatCard("statTotal", stats.total);
  updateStatCard("statCusto", `$${stats.custoTotal.toFixed(4)}`);
  updateStatCard("statTokens", stats.tokensTotal.toLocaleString());
  updateStatCard("statMedia", `$${stats.custoMedio.toFixed(6)}`);

  // Atualizar gráficos de tipos de questão
  updateTypeChart(
    "multipla_escolha",
    stats.porTipo.multipla_escolha || 0,
    stats.total
  );
  updateTypeChart("discursiva", stats.porTipo.discursiva || 0, stats.total);
  updateTypeChart(
    "verdadeiro_falso",
    stats.porTipo.verdadeiro_falso || 0,
    stats.total
  );
  updateTypeChart("associacao", stats.porTipo.associacao || 0, stats.total);

  console.log("📊 Dashboard atualizado:", stats);
}

/**
 * Atualiza um card de estatística
 */
function updateStatCard(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = value;
  }
}

/**
 * Atualiza gráfico de tipo de questão
 */
function updateTypeChart(tipo, count, total) {
  const chartMap = {
    multipla_escolha: { fill: "chartMC", count: "countMC" },
    discursiva: { fill: "chartDisc", count: "countDisc" },
    verdadeiro_falso: { fill: "chartVF", count: "countVF" },
    associacao: { fill: "chartAssoc", count: "countAssoc" },
  };

  const ids = chartMap[tipo];
  if (!ids) return;

  const percentage = total > 0 ? (count / total) * 100 : 0;

  const fillElement = document.getElementById(ids.fill);
  const countElement = document.getElementById(ids.count);

  if (fillElement) {
    fillElement.style.width = `${percentage}%`;

    // Animação suave
    fillElement.style.transition = "width 0.3s ease";
  }

  if (countElement) {
    countElement.textContent = count;
  }
}

/**
 * Gera relatório detalhado
 */
function generateReport() {
  const stats = Storage.getEstatisticas();
  const historico = Storage.getHistorico();

  let report = `
═══════════════════════════════════════════
           RELATÓRIO NEW NERD
═══════════════════════════════════════════

📊 ESTATÍSTICAS GERAIS
───────────────────────────────────────────
Total de Questões: ${stats.total}
Custo Total: $${stats.custoTotal.toFixed(6)}
Tokens Utilizados: ${stats.tokensTotal.toLocaleString()}
Custo Médio por Questão: $${stats.custoMedio.toFixed(6)}

📋 QUESTÕES POR TIPO
───────────────────────────────────────────
`;

  Object.entries(stats.porTipo).forEach(([tipo, count]) => {
    const tipoLabel = QUESTION_TYPES[tipo] || tipo;
    const percentage = ((count / stats.total) * 100).toFixed(1);
    report += `${tipoLabel}: ${count} (${percentage}%)\n`;
  });

  report += `
\n📚 QUESTÕES POR DISCIPLINA
───────────────────────────────────────────
`;

  Object.entries(stats.porDisciplina)
    .sort((a, b) => b[1] - a[1])
    .forEach(([disciplina, count]) => {
      const percentage = ((count / stats.total) * 100).toFixed(1);
      report += `${disciplina}: ${count} (${percentage}%)\n`;
    });

  report += `
\n📅 ÚLTIMAS QUESTÕES
───────────────────────────────────────────
`;

  historico.slice(0, 5).forEach((q, idx) => {
    const tipo = QUESTION_TYPES[q.tipo_questao] || q.tipo_questao;
    const preview = (q.enunciado || "").substring(0, 60) + "...";
    report += `${idx + 1}. [${tipo}] ${preview}\n   ${
      q.disciplina || "Geral"
    } • ${q.data_criacao || "Sem data"}\n\n`;
  });

  report += `
═══════════════════════════════════════════
Relatório gerado em: ${new Date().toLocaleString("pt-BR")}
═══════════════════════════════════════════
`;

  return report;
}

/**
 * Exporta relatório
 */
function exportReport() {
  const report = generateReport();

  const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `newnerd-relatorio-${
    new Date().toISOString().split("T")[0]
  }.txt`;
  a.click();
  URL.revokeObjectURL(url);

  console.log("📊 Relatório exportado");
}

/**
 * Mostra estatísticas detalhadas em modal
 */
function showDetailedStats() {
  const stats = Storage.getEstatisticas();

  alert(`📊 ESTATÍSTICAS DETALHADAS

Total de Questões: ${stats.total}
Custo Total: $${stats.custoTotal.toFixed(6)}
Tokens Utilizados: ${stats.tokensTotal.toLocaleString()}
Custo Médio: $${stats.custoMedio.toFixed(6)}

Questões por Tipo:
${Object.entries(stats.porTipo)
  .map(([tipo, count]) => {
    const tipoLabel = QUESTION_TYPES[tipo] || tipo;
    return `• ${tipoLabel}: ${count}`;
  })
  .join("\n")}

Questões por Disciplina:
${Object.entries(stats.porDisciplina)
  .slice(0, 5)
  .map(([disciplina, count]) => {
    return `• ${disciplina}: ${count}`;
  })
  .join("\n")}
  `);
}

// Disponibilizar funções globalmente
if (typeof window !== "undefined") {
  window.updateDashboard = updateDashboard;
  window.generateReport = generateReport;
  window.exportReport = exportReport;
  window.showDetailedStats = showDetailedStats;
}

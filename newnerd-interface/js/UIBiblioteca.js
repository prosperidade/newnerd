// js/UiBiblioteca.js
// Renderizador Robusto (Aceita content, chunk_texto ou texto_extraido)

export const UIManager = {
  toast(msg, type = "info") {
    const icons = { info: "ℹ️", success: "✅", error: "❌", warning: "⚠️" };
    alert(`${icons[type] || "ℹ️"} ${msg}`);
  },

  formatSize(bytes) {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  },

  escapeHtml(s) {
    return (s || "").replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m])
    );
  },

  statusBadge(status) {
    const map = {
      pendente: "⏳ pendente",
      uploading: "📤 enviando",
      processing: "🧠 processando",
      ready: "✅ pronto",
      uploaded: "📦 enviado",
      error: "❌ erro",
    };
    return `<span class="badge">${map[status] || status}</span>`;
  },

  renderDocs(list, containerEl) {
    if (!containerEl) return;

    // Limpa o container antes de desenhar
    containerEl.innerHTML = "";

    if (!list || list.length === 0) {
      containerEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <h3>Nenhum resultado</h3>
          <p>Tente termos diferentes ou faça upload de materiais.</p>
        </div>`;
      return;
    }

    containerEl.innerHTML = list
      .map((doc) => {
        // 1. Tratamento de Título (Prioriza metadados, depois nome do arquivo)
        const titulo =
          doc.metadata?.titulo ||
          doc.titulo ||
          doc.nome_original ||
          (doc.caminho || doc.documento_path || "").split("/").pop() ||
          "Sem título";

        // 2. Tratamento de Score (Identifica se é busca semântica)
        // O banco retorna 'similarity', o front mapeia para 'score_final'
        const scoreRaw = doc.score_final ?? doc.similarity;
        const isSemantic = typeof scoreRaw === "number";

        const scoreHtml = isSemantic
          ? `<div class="semantic-score" style="background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; display: inline-block; margin-bottom: 5px;">
             Relevância: ${(scoreRaw * 100).toFixed(0)}%
           </div>`
          : "";

        // 3. Tratamento ROBUSTO de Texto (A Correção Principal)
        // O banco manda 'content', a tabela manda 'texto_extraido', o código antigo manda 'chunk_texto'
        // Aqui lemos qualquer um deles.
        const textoCru =
          doc.content || doc.chunk_texto || doc.texto_extraido || "";
        const snippetHtml = textoCru
          ? `<div style="font-size:0.85em; color:#666; margin-top:8px; line-height: 1.4; border-left: 2px solid #ddd; padding-left: 8px;">
             ${this.escapeHtml(textoCru.slice(0, 200))}...
           </div>`
          : "";

        // Caminho para preview/remover
        const path = doc.caminho || doc.documento_path;

        return `
        <div class="document-card ${
          isSemantic ? "semantic" : ""
        }" style="background: #fff; border: 1px solid #eee; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
             <div>
                ${scoreHtml}
                <div class="document-title" style="font-weight: 600; color: #333;">${this.escapeHtml(
                  titulo
                )}</div>
             </div>
             <div class="document-type-icon" style="font-size: 1.5em;">${
               isSemantic ? "🧠" : "📄"
             }</div>
          </div>
          
          <div class="document-excerpt">
            ${
              isSemantic
                ? ""
                : `<small>${this.formatSize(doc.tamanho_bytes)} • ${
                    doc.tipo_arquivo || "-"
                  }</small> <br>`
            }
            ${isSemantic ? "" : this.statusBadge(doc.status)}
            ${snippetHtml}
          </div>
          
          <div class="document-meta" style="margin-top: 15px; display: flex; gap: 10px;">
            <button class="action-btn" onclick="bibliotecaProfessor.preview('${path}')" style="cursor: pointer; padding: 5px 10px;">👁️ Ver</button>
            <button class="action-btn" onclick="bibliotecaProfessor.remove('${path}')" style="cursor: pointer; padding: 5px 10px; color: red;">🗑️</button>
          </div>
        </div>`;
      })
      .join("");
  },
};

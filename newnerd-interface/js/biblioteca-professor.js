/* ============================================================================
   BIBLIOTECA DO PROFESSOR (FINAL)
   - Drawer Lateral RECUPERADO (Visualização de PDF, DOCX, TXT)
   - Busca Semântica com FILTRO (Remove resultados ruins)
   - Upload Híbrido (PDF baixa no server, DOCX/TXT envia texto)
============================================================================ */
import { FileProcessor } from "./FileBiblioteca.js";
import { UIManager } from "./UiBiblioteca.js";

class BibliotecaProfessor {
  constructor() {
    console.log("📚 Inicializando BibliotecaProfessor...");

    if (!window.SupabaseClient || !window.SupabaseClient.init()) {
      alert("ERRO CRÍTICO: Falha ao carregar SupabaseClient.");
      return;
    }
    this.supa = window.SupabaseClient.client;
    this.bucket =
      (window.CONFIG && CONFIG.BUCKET_PROFESSOR) || "newnerd_professores";
    this.table =
      (window.CONFIG && CONFIG.TABLE_ARQUIVOS_PROF) || "arquivos_professor";
    this.professorId =
      CONFIG?.ENV === "dev" ? CONFIG.PROFESSOR_ID ?? null : null;

    this.docs = [];
    this.fileQueue = [];

    this.cacheEls();
    this.bindEvents();
    this.ensureAuth().then(() => this.loadDocuments());
  }

  cacheEls() {
    this.els = {
      dropZone: document.getElementById("dropZone"),
      fileInput: document.getElementById("fileInput"),
      uploadQueue: document.getElementById("uploadQueue"),
      fileQueueList: document.getElementById("fileQueue"),
      uploadAllBtn: document.getElementById("uploadAllBtn"),
      searchInput: document.getElementById("searchInput"),
      semanticInput: document.getElementById("semanticSearch"),
      semanticBtn: document.getElementById("semanticBtn"),
      filterTabs: document.querySelectorAll(".filter-tab"),
      docsGrid: document.getElementById("documentsGrid"),
      totalDocs: document.getElementById("totalDocs"),
      totalSize: document.getElementById("totalSize"),
      // Elementos do Drawer (Painel Lateral)
      drawerOverlay: document.getElementById("drawerOverlay"),
      drawerPanel: document.getElementById("drawerPanel"),
      drawerTitle: document.getElementById("drawerTitle"),
      drawerBody: document.getElementById("drawerBody"),
      drawerCloseBtn: document.getElementById("drawerCloseBtn"),
    };
  }

  bindEvents() {
    const {
      dropZone,
      fileInput,
      uploadAllBtn,
      semanticBtn,
      searchInput,
      filterTabs,
      drawerCloseBtn,
      drawerOverlay,
    } = this.els;

    if (dropZone && fileInput) {
      dropZone.addEventListener("click", () => fileInput.click());
      dropZone.addEventListener("dragover", (e) => e.preventDefault());
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        this.addFiles(Array.from(e.dataTransfer.files));
      });
      fileInput.addEventListener("change", (e) =>
        this.addFiles(Array.from(e.target.files))
      );
    }

    if (uploadAllBtn)
      uploadAllBtn.addEventListener("click", () => this.uploadAll());
    if (semanticBtn)
      semanticBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.performSemanticSearch();
      });
    if (searchInput)
      searchInput.addEventListener(
        "input",
        this.debounce((e) => this.handleSearch(e.target.value), 250)
      );

    filterTabs?.forEach((tab) =>
      tab.addEventListener("click", () => {
        filterTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        this.applyTypeFilter(tab.getAttribute("data-type"));
      })
    );

    // Eventos do Drawer
    drawerCloseBtn?.addEventListener("click", () => this.closePreviewDrawer());
    drawerOverlay?.addEventListener("click", () => this.closePreviewDrawer());
  }

  async ensureAuth() {
    const { data } = await this.supa.auth.getUser();
    if (data?.user) {
      this.professorId = data.user.id;
      return;
    }
    if (CONFIG?.ENV === "dev" && CONFIG.TESTE_EMAIL) {
      await this.supa.auth.signInWithPassword({
        email: CONFIG.TESTE_EMAIL,
        password: CONFIG.TESTE_SENHA,
      });
      const { data: d2 } = await this.supa.auth.getUser();
      this.professorId = d2?.user?.id;
    }
  }

  // --- Upload Logic ---
  addFiles(files) {
    files.forEach((file) => {
      this.fileQueue.push({
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        file,
        status: "pendente",
      });
    });
    this.updateQueueUI();
    if (this.els.uploadQueue) this.els.uploadQueue.style.display = "block";
  }

  updateQueueUI() {
    if (!this.els.fileQueueList) return;
    this.els.fileQueueList.innerHTML = this.fileQueue
      .map(
        (item) => `
      <div class="file-item">
        <div class="file-icon">📄</div>
        <div class="file-info">
          <div class="file-name">${UIManager.escapeHtml(item.file.name)}</div>
          <div class="file-meta">${UIManager.formatSize(item.file.size)}</div>
        </div>
        <div class="file-status">${UIManager.statusBadge(item.status)}</div>
      </div>`
      )
      .join("");
  }

  async uploadAll() {
    if (!this.professorId) await this.ensureAuth();
    const pendentes = this.fileQueue.filter((i) => i.status === "pendente");
    if (!pendentes.length) return;

    this.els.uploadAllBtn.disabled = true;
    for (const item of pendentes) await this.uploadOne(item);
    this.els.uploadAllBtn.disabled = false;

    this.fileQueue = [];
    this.updateQueueUI();
    await this.loadDocuments();
  }

  async uploadOne(item) {
    try {
      item.status = "uploading";
      this.updateQueueUI();

      const cleanName = item.file.name.replace(/[^\w.\-() ]+/g, "_");
      const path = `${this.professorId}/${Date.now()}_${cleanName}`;

      const { error: upErr } = await this.supa.storage
        .from(this.bucket)
        .upload(path, item.file);
      if (upErr) throw upErr;

      const { data: inserted, error: dbErr } = await this.supa
        .from(this.table)
        .insert({
          professor_id: this.professorId,
          caminho: path,
          titulo: item.file.name,
          nome_original: item.file.name,
          tipo_arquivo:
            item.file.type ||
            FileProcessor.guessMimeByExtension(item.file.name),
          tamanho_bytes: item.file.size,
          status: "uploaded",
          metadata: { origem: "web", ext: FileProcessor.ext(item.file.name) },
        })
        .select()
        .single();
      if (dbErr) throw dbErr;

      item.status = "processing";
      this.updateQueueUI();

      const text = await FileProcessor.tryExtractText(item.file);
      await this.sendEmbeddings(path, text);

      await this.supa
        .from(this.table)
        .update({ status: "ready" })
        .eq("id", inserted.id);
      item.status = "ready";
      this.updateQueueUI();
    } catch (e) {
      console.error("Upload falhou:", e);
      item.status = "error";
      this.updateQueueUI();
      UIManager.toast(`Erro: ${e.message}`, "error");
    }
  }

  async sendEmbeddings(path, extractedText) {
    console.log(`📡 IA processando: ${path}`);
    try {
      const isPDF = path.toLowerCase().endsWith(".pdf");
      const payload = {
        record: { name: path, owner: this.professorId },
        text: !isPDF && extractedText ? extractedText : null,
      };

      const { data, error } = await this.supa.functions.invoke("embed", {
        body: payload,
      });
      if (error) throw error;

      if (data?.success) console.log("✅ Embedding OK");
      else console.warn("⚠️ IA ignorou:", data);
    } catch (e) {
      console.error("Erro IA:", e);
    }
  }

  async loadDocuments() {
    if (!this.professorId) return;
    const { data } = await this.supa
      .from(this.table)
      .select("*")
      .eq("professor_id", this.professorId)
      .order("created_at", { ascending: false });
    this.docs = data || [];
    UIManager.renderDocs(this.docs, this.els.docsGrid);
    if (this.els.totalDocs) this.els.totalDocs.textContent = this.docs.length;
  }

  // --- BUSCA HÍBRIDA (IA + PALAVRA CHAVE) ---
  async performSemanticSearch() {
    const q = this.els.semanticInput.value.trim();
    if (!q) {
      UIManager.toast("Digite algo para buscar", "info");
      return;
    }

    UIManager.toast("Buscando (Conteúdo + Título)...", "info");

    try {
      // Vamos rodar duas buscas em paralelo:
      // 1. Busca Exata no Título (Banco de Dados)
      const searchKeyword = this.supa
        .from(this.table)
        .select("*")
        .eq("professor_id", this.professorId)
        .or(`titulo.ilike.%${q}%,nome_original.ilike.%${q}%`) // Busca no nome
        .limit(5);

      // 2. Busca Semântica no Conteúdo (IA / Edge Function)
      const searchAI = this.supa.functions.invoke("semantic-search", {
        body: {
          query: q,
          professor_id: this.professorId,
          match_count: 10,
          match_threshold: 0.4, // Baixei um pouco para ser mais tolerante
        },
      });

      // Aguarda as duas terminarem
      const [resKeyword, resAI] = await Promise.all([searchKeyword, searchAI]);

      // --- PROCESSAR RESULTADOS DA PALAVRA-CHAVE (TÍTULO) ---
      let docsKeyword = [];
      if (resKeyword.data) {
        docsKeyword = resKeyword.data.map((d) => ({
          ...d,
          score_final: 1.0, // Título exato ganha nota máxima (100%)
          origem: "Título", // Etiqueta para sabermos de onde veio
          chunk_texto: d.texto_extraido || "Encontrado pelo título do arquivo.",
        }));
      }

      // --- PROCESSAR RESULTADOS DA IA (CONTEÚDO) ---
      let docsAI = [];
      if (resAI.data && resAI.data.results) {
        docsAI = resAI.data.results.map((r) => ({
          ...r,
          titulo:
            r.metadata?.titulo ||
            r.metadata?.nome_original ||
            "Documento Encontrado",
          chunk_texto: r.content || "",
          score_final: r.similarity,
          origem: "Conteúdo",
        }));
      }

      // --- UNIFICAR E REMOVER DUPLICATAS ---
      // Criamos um Map usando o ID/Caminho como chave para não repetir arquivo
      const mapaUnico = new Map();

      // Adiciona primeiro os da IA
      docsAI.forEach((doc) => {
        const chave = doc.id || doc.caminho || doc.documento_path;
        if (doc.score_final >= 0.45) {
          // Filtro de qualidade da IA
          mapaUnico.set(chave, doc);
        }
      });

      // Adiciona os do Título (sobrescreve se já existir, pois título é relevância 100%)
      docsKeyword.forEach((doc) => {
        const chave = doc.id || doc.caminho;
        // Se já existe, mantemos o objeto mais completo, mas forçamos score alto
        if (mapaUnico.has(chave)) {
          const existente = mapaUnico.get(chave);
          existente.score_final = 1.0; // Upgrade no score
          existente.origem = "Título + Conteúdo";
        } else {
          mapaUnico.set(chave, doc);
        }
      });

      // Converte de volta para array e ordena por relevância
      const resultadosFinais = Array.from(mapaUnico.values()).sort(
        (a, b) => b.score_final - a.score_final
      );

      console.log("📊 Resultados Híbridos:", resultadosFinais);

      if (resultadosFinais.length === 0) {
        UIManager.toast("Nenhum documento encontrado.", "info");
        this.els.docsGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🧐</div>
                    <h3>Nada encontrado</h3>
                    <p>Não achamos nem no título, nem no conteúdo.</p>
                </div>`;
        return;
      }

      // Renderiza
      UIManager.renderDocs(resultadosFinais, this.els.docsGrid);
      UIManager.toast(
        `Encontrados ${resultadosFinais.length} resultados!`,
        "success"
      );
    } catch (e) {
      console.error("Erro Busca Híbrida:", e);
      UIManager.toast("Erro ao buscar.", "error");
    }
  }
  handleSearch(val) {
    const q = val.toLowerCase();
    const filtered = this.docs.filter((d) =>
      (d.titulo || "").toLowerCase().includes(q)
    );
    UIManager.renderDocs(filtered, this.els.docsGrid);
  }

  // --- REMOVER ---
  async remove(path) {
    if (!confirm("Apagar arquivo?")) return;
    await this.supa.storage.from(this.bucket).remove([path]);
    await this.supa.from(this.table).delete().eq("caminho", path);
    this.loadDocuments();
  }

  // --- PREVIEW (DRAWER LATERAL RESTAURADO) ---
  async preview(path) {
    try {
      if (!path) return;

      // Ativa o Drawer (CSS class 'active')
      this.els.drawerOverlay?.classList.add("active");
      this.els.drawerPanel?.classList.add("active");
      this.els.drawerBody.innerHTML = "<p>Carregando...</p>"; // Loading state

      // Gera URL assinada
      const { data, error } = await this.supa.storage
        .from(this.bucket)
        .createSignedUrl(path, 3600);
      if (error) throw error;
      const signedUrl = data.signedUrl;

      // Tenta pegar metadados locais para saber o título/tipo
      const doc = this.docs.find((d) => d.caminho === path) || {};
      const title = doc.titulo || doc.nome_original || path.split("/").pop();
      this.els.drawerTitle.textContent = title;

      const mime = (doc.tipo_arquivo || "").toLowerCase();
      const isPDF = mime.includes("pdf") || path.toLowerCase().endsWith(".pdf");
      const isWord =
        mime.includes("word") ||
        mime.includes("docx") ||
        path.toLowerCase().endsWith(".docx");
      const isText =
        mime.includes("text") || path.toLowerCase().endsWith(".txt");

      // Renderiza baseado no tipo
      if (isPDF) {
        this.els.drawerBody.innerHTML = `
          <iframe src="${signedUrl}" style="width:100%; height:85vh; border:none; background:#f5f5f5;"></iframe>
          <div style="margin-top:10px; text-align:center;">
             <a href="${signedUrl}" target="_blank" class="btn">Baixar PDF Original</a>
          </div>
        `;
      } else if (isWord) {
        // Usa Mammoth para converter DOCX -> HTML para visualização
        if (window.mammoth) {
          try {
            const response = await fetch(signedUrl);
            const arrayBuffer = await response.arrayBuffer();
            const result = await window.mammoth.convertToHtml({
              arrayBuffer: arrayBuffer,
            });
            this.els.drawerBody.innerHTML = `
                    <div class="docx-content" style="padding:20px; background:white; min-height:50vh;">
                        ${result.value}
                    </div>
                    <div style="margin-top:10px; text-align:center;">
                        <a href="${signedUrl}" target="_blank" class="btn">Baixar DOCX</a>
                    </div>`;
          } catch (err) {
            this.els.drawerBody.innerHTML = `<p>Erro ao visualizar DOCX. <a href="${signedUrl}" target="_blank">Baixar arquivo</a></p>`;
          }
        } else {
          this.els.drawerBody.innerHTML = `<p>Visualizador indisponível. <a href="${signedUrl}" target="_blank">Baixar arquivo</a></p>`;
        }
      } else if (isText) {
        const response = await fetch(signedUrl);
        const text = await response.text();
        this.els.drawerBody.innerHTML = `<pre style="background:#f4f4f4; padding:15px; overflow:auto;">${UIManager.escapeHtml(
          text
        )}</pre>`;
      } else {
        // Fallback genérico
        this.els.drawerBody.innerHTML = `
            <div style="text-align:center; padding:50px;">
                <p>Pré-visualização não disponível para este formato.</p>
                <a href="${signedUrl}" target="_blank" class="btn" style="margin-top:10px;">Baixar Arquivo</a>
            </div>
        `;
      }
    } catch (e) {
      console.error("Erro Preview:", e);
      this.els.drawerBody.innerHTML = `<p>Erro ao carregar. Tente novamente.</p>`;
    }
  }

  closePreviewDrawer() {
    this.els.drawerOverlay?.classList.remove("active");
    this.els.drawerPanel?.classList.remove("active");
    if (this.els.drawerBody) this.els.drawerBody.innerHTML = "";
  }

  debounce(fn, d) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, a), d);
    };
  }
}

// ============================================================================
// INICIALIZAÇÃO ROBUSTA (Suporta modules)
// ============================================================================
function startApp() {
  if (window.bibliotecaProfessor) return;

  if (!window.SupabaseClient || !window.CONFIG) {
    // Aguarda um pouco se as dependências ainda não carregaram
    setTimeout(startApp, 100);
    return;
  }

  window.bibliotecaProfessor = new BibliotecaProfessor();
}

// Tenta iniciar
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  startApp();
} else {
  document.addEventListener("DOMContentLoaded", startApp);
}
// Backup: Ouvinte do config
document.addEventListener("configReady", startApp);

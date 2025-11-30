/* ============================================================================
   BIBLIOTECA DO PROFESSOR (FINAL - REVISADA)
============================================================================ */
import { FileProcessor } from "../../modules/FileBiblioteca.js";
import { UIManager } from "../../modules/UiBiblioteca.js";

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

    // CORREÇÃO FILTRO: Garante que o clique chame a função corretamente
    filterTabs?.forEach((tab) =>
      tab.addEventListener("click", () => {
        filterTabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const tipo = tab.getAttribute("data-type");
        console.log("Filtro clicado:", tipo); // Debug
        this.applyTypeFilter(tipo);
      })
    );

    drawerCloseBtn?.addEventListener("click", () => this.closePreviewDrawer());
    drawerOverlay?.addEventListener("click", () => this.closePreviewDrawer());
  }

  async ensureAuth() {
    const professor =
      (typeof ensureProfessorAuth === "function"
        ? await ensureProfessorAuth()
        : null) || null;

    if (professor?.id) {
      this.professorId = professor.id;
      this.professor = professor;
      return;
    }

    if (CONFIG?.ENV === "dev" && CONFIG.TESTE_EMAIL) {
      await this.supa.auth.signInWithPassword({
        email: CONFIG.TESTE_EMAIL,
        password: CONFIG.TESTE_SENHA,
      });
      const prof =
        (typeof ensureProfessorAuth === "function"
          ? await ensureProfessorAuth()
          : null) || null;
      this.professorId = prof?.id || null;
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

      // 1. Upload Storage
      const { error: upErr } = await this.supa.storage
        .from(this.bucket)
        .upload(path, item.file);
      if (upErr) throw upErr;

      // 2. Insert Metadata
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

      // 3. IA Processing (Extração Local)
      const text = await FileProcessor.tryExtractText(item.file);

      if (text === "SKIP_AI") {
        console.log("⏩ Pulando IA para arquivo binário/zip.");
      } else {
        item.status = "processing";
        this.updateQueueUI();
        // Aqui enviamos o texto extraído para a Edge Function
        await this.sendEmbeddings(path, text);
      }

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

      // SEGURANÇA DE PAYLOAD: Limita o tamanho do texto enviado para não estourar o limite da Edge Function
      let textToSend = null;
      if (!isPDF && extractedText) {
        textToSend = extractedText.slice(0, 30000); // 30k chars max para envio seguro
      }

      const payload = {
        record: { name: path, owner: this.professorId },
        text: textToSend, // Envia texto ou null (se for PDF)
      };

      const { data, error } = await this.supa.functions.invoke("embed", {
        body: payload,
      });
      if (error) throw error;

      if (data?.success) console.log("✅ Embedding OK");
      else console.warn("⚠️ IA ignorou:", data);
    } catch (e) {
      console.error("Erro IA:", e);
      // Não damos alert aqui pois o upload físico já funcionou
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
    UIManager.renderDocs(this.docs, this.els.docsGrid, "bibliotecaProfessor");
    if (this.els.totalDocs) this.els.totalDocs.textContent = this.docs.length;
  }

  // --- FILTRO POR TIPO (CORRIGIDO PARA FUNCIONAR COM TODAS AS EXTENSÕES) ---
  applyTypeFilter(type) {
    if (!type || type === "all") {
      this.loadDocuments();
      return;
    }

    // Mapeamento de tipos para extensões reais
    const map = {
      pdf: [".pdf", "application/pdf"],
      docx: [".doc", ".docx", "word"],
      txt: [".txt", "text/plain", ".md"],
      csv: [".csv"],
      json: [".json"],
      zip: [".zip", ".rar"],
      audio: [".mp3", "audio/"],
      video: [".mp4", "video/"],
    };

    const matchers = map[type] || [type]; // Se não tiver no mapa, usa o próprio tipo

    const filtered = this.docs.filter((d) => {
      const nome = (d.nome_original || d.titulo || "").toLowerCase();
      const mime = (d.tipo_arquivo || "").toLowerCase();
      // Verifica se alguma das extensões/mimes bate
      return matchers.some((m) => nome.endsWith(m) || mime.includes(m));
    });

    UIManager.renderDocs(filtered, this.els.docsGrid, "bibliotecaProfessor");
  }

  // --- BUSCA HÍBRIDA ---
  async performSemanticSearch() {
    const q = this.els.semanticInput.value.trim();
    if (!q) {
      UIManager.toast("Digite algo para buscar", "info");
      return;
    }

    UIManager.toast("Buscando...", "info");

    try {
      const searchKeyword = this.supa
        .from(this.table)
        .select("*")
        .eq("professor_id", this.professorId)
        .or(`titulo.ilike.%${q}%,nome_original.ilike.%${q}%`)
        .limit(5);

      const searchAI = this.supa.functions.invoke("semantic-search", {
        body: {
          query: q,
          professor_id: this.professorId,
          match_count: 10,
          match_threshold: 0.4,
        },
      });

      const [resKeyword, resAI] = await Promise.all([searchKeyword, searchAI]);

      let docsKeyword = (resKeyword.data || []).map((d) => ({
        ...d,
        score_final: 1.0,
        origem: "Título",
        chunk_texto: d.texto_extraido || "Encontrado pelo título",
        caminho: d.caminho, // Professor usa 'caminho'
      }));

      let docsAI = (resAI.data?.results || []).map((r) => ({
        ...r,
        titulo: r.metadata?.titulo || "Doc IA",
        chunk_texto: r.content || "",
        score_final: r.similarity,
      }));

      const mapa = new Map();
      docsAI.forEach((d) => {
        if (d.score_final >= 0.45) mapa.set(d.id || d.caminho, d);
      });
      docsKeyword.forEach((d) => {
        const k = d.id || d.caminho;
        if (mapa.has(k)) mapa.get(k).score_final = 1.0;
        else mapa.set(k, { ...d, score_final: 1.0 });
      });

      const finais = Array.from(mapa.values()).sort(
        (a, b) => b.score_final - a.score_final
      );

      if (finais.length === 0) {
        this.els.docsGrid.innerHTML = `<div class="empty-state"><h3>Nada encontrado</h3></div>`;
        return;
      }

      UIManager.renderDocs(finais, this.els.docsGrid, "bibliotecaProfessor");
      UIManager.toast(`Encontrados ${finais.length} resultados`, "success");
    } catch (e) {
      console.error("Erro Busca:", e);
      UIManager.toast("Erro ao buscar.", "error");
    }
  }

  handleSearch(val) {
    const q = val.toLowerCase();
    const filtered = this.docs.filter((d) =>
      (d.titulo || "").toLowerCase().includes(q)
    );
    UIManager.renderDocs(filtered, this.els.docsGrid, "bibliotecaProfessor");
  }

  // --- REMOVER ---
  async remove(path) {
    if (!confirm("Apagar arquivo?")) return;
    await this.supa.storage.from(this.bucket).remove([path]);
    await this.supa.from(this.table).delete().eq("caminho", path);
    this.loadDocuments();
  }

  // --- PREVIEW ---
  async preview(path) {
    try {
      if (!path) return;

      this.els.drawerOverlay?.classList.add("active");
      this.els.drawerPanel?.classList.add("active");
      this.els.drawerBody.innerHTML = "<p>Carregando...</p>";

      const { data } = await this.supa.storage
        .from(this.bucket)
        .createSignedUrl(path, 3600);
      if (!data?.signedUrl) throw new Error("URL inválida");
      const signedUrl = data.signedUrl;

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
        mime.includes("text") ||
        path.toLowerCase().endsWith(".txt") ||
        mime.includes("json") ||
        path.toLowerCase().endsWith(".json") ||
        path.toLowerCase().endsWith(".csv");
      const isImage = mime.startsWith("image/");

      if (isPDF) {
        this.els.drawerBody.innerHTML = `
          <iframe src="${signedUrl}" style="width:100%; height:85vh; border:none; background:#f5f5f5;"></iframe>
          <div style="margin-top:10px; text-align:center;">
             <a href="${signedUrl}" target="_blank" class="btn">Baixar PDF Original</a>
          </div>
        `;
      } else if (isWord) {
        if (window.mammoth) {
          try {
            const response = await fetch(signedUrl);
            const arrayBuffer = await response.arrayBuffer();
            const result = await window.mammoth.convertToHtml({
              arrayBuffer: arrayBuffer,
            });
            this.els.drawerBody.innerHTML = `
                    <div class="docx-content" style="padding:20px; background:white; min-height:50vh;">${result.value}</div>
                    <div style="margin-top:10px; text-align:center;"><a href="${signedUrl}" target="_blank" class="btn">Baixar DOCX</a></div>`;
          } catch (err) {
            this.els.drawerBody.innerHTML = `<p>Erro ao visualizar DOCX.</p>`;
          }
        } else {
          this.els.drawerBody.innerHTML = `<p>Visualizador indisponível.</p>`;
        }
      } else if (isText) {
        const response = await fetch(signedUrl);
        const text = await response.text();
        let display = UIManager.escapeHtml(text);
        // Tenta formatar JSON se for JSON
        if (path.toLowerCase().endsWith(".json")) {
          try {
            display = JSON.stringify(JSON.parse(text), null, 2);
          } catch (e) {}
        }
        this.els.drawerBody.innerHTML = `<pre style="background:#f4f4f4; padding:15px; overflow:auto; height:80vh;">${display}</pre>`;
      } else if (isImage) {
        this.els.drawerBody.innerHTML = `<div style="text-align:center"><img src="${signedUrl}" style="max-width:100%; max-height:80vh"></div>`;
      } else {
        this.els.drawerBody.innerHTML = `
            <div style="text-align:center; padding:50px;">
                <p>Pré-visualização não disponível.</p>
                <a href="${signedUrl}" target="_blank" class="btn">Baixar Arquivo</a>
            </div>
        `;
      }
    } catch (e) {
      console.error("Erro Preview:", e);
      this.els.drawerBody.innerHTML = `<p>Erro ao carregar.</p>`;
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

// INICIALIZAÇÃO
function startApp() {
  if (window.bibliotecaProfessor) return;
  if (!window.SupabaseClient || !window.CONFIG) {
    setTimeout(startApp, 100);
    return;
  }
  window.bibliotecaProfessor = new BibliotecaProfessor();
}
if (document.readyState === "complete" || document.readyState === "interactive")
  startApp();
else document.addEventListener("DOMContentLoaded", startApp);
document.addEventListener("configReady", startApp);

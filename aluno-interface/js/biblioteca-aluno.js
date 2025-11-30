/* ============================================================================
   BIBLIOTECA DO ALUNO (FINAL - VISUALIZAÇÃO CORRIGIDA)
   - Agora com o mesmo Drawer avançado do Professor
   - Lê PDF, DOCX (convertido), TXT, JSON, CSV visualmente
============================================================================ */
import { FileProcessor } from "../../modules/FileBiblioteca.js";
import { UIManager } from "../../modules/UiBiblioteca.js";

class BibliotecaAluno {
  constructor() {
    console.log("🎒 Inicializando Biblioteca do Aluno...");

    // Inicialização segura
    if (!window.supabaseClient && window.supabase && window.CONFIG) {
      window.supabaseClient = window.supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_ANON_KEY
      );
    }

    if (!window.supabaseClient) {
      console.warn("Aguardando Supabase...");
      return;
    }

    this.supa = window.supabaseClient;

    // Configurações
    this.bucket = "alunos-biblioteca";
    this.table = "aluno_documentos";

    this.studentId = null;
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
      chooseBtn: document.getElementById("chooseBtn"),
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
      chooseBtn,
      uploadAllBtn,
      semanticBtn,
      searchInput,
      filterTabs,
      drawerCloseBtn,
      drawerOverlay,
    } = this.els;

    if (fileInput) {
      if (dropZone) {
        dropZone.addEventListener("click", () => fileInput.click());
        dropZone.addEventListener("dragover", (e) => e.preventDefault());
        dropZone.addEventListener("drop", (e) => {
          e.preventDefault();
          this.addFiles(Array.from(e.dataTransfer.files));
        });
      }
      if (chooseBtn) {
        chooseBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          fileInput.click();
        });
      }
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

    drawerCloseBtn?.addEventListener("click", () => this.closePreviewDrawer());
    drawerOverlay?.addEventListener("click", () => this.closePreviewDrawer());
  }

  async ensureAuth() {
    const perfilAluno =
      typeof verificarAuth === "function" ? await verificarAuth() : null;

    if (perfilAluno?.id) {
      this.studentId = perfilAluno.id;
      this.aluno = perfilAluno;
      console.log("🎓 Aluno autenticado:", this.studentId);
    } else {
      console.warn("⚠️ Aluno não logado ou sessão inválida.");
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
    if (!this.studentId) await this.ensureAuth();
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
      const path = `${this.studentId}/${Date.now()}_${cleanName}`;

      // 1. Storage
      const { error: upErr } = await this.supa.storage
        .from(this.bucket)
        .upload(path, item.file);
      if (upErr) throw upErr;

      // 2. Banco
      const { data: inserted, error: dbErr } = await this.supa
        .from(this.table)
        .insert({
          aluno_id: this.studentId,
          caminho_arquivo: path,
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

      // 3. IA
      item.status = "processing";
      this.updateQueueUI();

      const text = await FileProcessor.tryExtractText(item.file);

      // SKIP lógico
      if (text === "SKIP_AI") {
        console.log("⏩ Pulando IA para arquivo binário.");
      } else {
        await this.sendEmbeddings(path, text);
      }

      // 4. Update status
      try {
        await this.supa
          .from(this.table)
          .update({ status: "ready" })
          .eq("id", inserted.id);
      } catch (e) {}

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
    console.log(`📡 IA processando (Aluno): ${path}`);
    try {
      const isPDF = path.toLowerCase().endsWith(".pdf");

      // Limite de segurança para envio de texto (30k chars)
      let textToSend = null;
      if (!isPDF && extractedText) {
        textToSend = extractedText.slice(0, 30000);
      }

      const payload = {
        record: {
          name: path,
          owner: this.studentId,
          is_student: true,
        },
        text: textToSend,
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
    if (!this.studentId) return;

    const { data } = await this.supa
      .from(this.table)
      .select("*")
      .eq("aluno_id", this.studentId)
      .order("created_at", { ascending: false });

    this.docs = data || [];

    const docsAdaptados = this.docs.map((d) => ({
      ...d,
      caminho: d.caminho_arquivo,
      documento_path: d.caminho_arquivo,
    }));

    UIManager.renderDocs(docsAdaptados, this.els.docsGrid, "bibliotecaAluno");
    if (this.els.totalDocs) this.els.totalDocs.textContent = this.docs.length;
  }

  // --- BUSCA HÍBRIDA ---
  async performSemanticSearch() {
    const q = this.els.semanticInput.value.trim();
    if (!q) {
      UIManager.toast("Digite algo...", "info");
      return;
    }

    UIManager.toast("Buscando...", "info");

    try {
      const searchKeyword = this.supa
        .from(this.table)
        .select("*")
        .eq("aluno_id", this.studentId)
        .ilike("titulo", `%${q}%`)
        .limit(5);

      const searchAI = this.supa.functions.invoke("semantic-search", {
        body: {
          query: q,
          student_id: this.studentId,
          is_student: true,
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
        caminho: d.caminho_arquivo,
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
        const k = d.id || d.caminho_arquivo;
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

      UIManager.renderDocs(finais, this.els.docsGrid, "bibliotecaAluno");
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
    const adaptados = filtered.map((d) => ({
      ...d,
      caminho: d.caminho_arquivo,
    }));
    UIManager.renderDocs(adaptados, this.els.docsGrid, "bibliotecaAluno");
  }

  // --- PREVIEW (DRAWER AVANÇADO) ---
  async preview(path) {
    try {
      if (!path) return;

      this.els.drawerOverlay?.classList.add("active");
      this.els.drawerPanel?.classList.add("active");
      this.els.drawerBody.innerHTML =
        '<p style="padding:20px;">Carregando...</p>';

      const { data } = await this.supa.storage
        .from(this.bucket)
        .createSignedUrl(path, 3600);
      if (!data?.signedUrl) throw new Error("URL inválida");
      const signedUrl = data.signedUrl;

      // Determina tipo e título
      const doc = this.docs.find((d) => d.caminho_arquivo === path) || {};
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

      // 1. PDF (Iframe estilo Professor)
      if (isPDF) {
        this.els.drawerBody.innerHTML = `
          <iframe src="${signedUrl}" style="width:100%; height:85vh; border:none; background:#f5f5f5;" allow="fullscreen"></iframe>
          <div style="margin-top:10px; text-align:center;">
             <a href="${signedUrl}" target="_blank" class="btn">Baixar PDF Original</a>
          </div>
        `;
      }
      // 2. Word (Mammoth)
      else if (isWord) {
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
            this.els.drawerBody.innerHTML = `<p style="padding:20px;">Erro ao visualizar DOCX. <a href="${signedUrl}" target="_blank">Baixar</a></p>`;
          }
        } else {
          this.els.drawerBody.innerHTML = `<p style="padding:20px;">Visualizador indisponível.</p>`;
        }
      }
      // 3. Texto / JSON / CSV
      else if (isText) {
        const response = await fetch(signedUrl);
        const text = await response.text();
        let display = UIManager.escapeHtml(text);
        // Prettify se for JSON
        if (path.toLowerCase().endsWith(".json")) {
          try {
            display = JSON.stringify(JSON.parse(text), null, 2);
          } catch (e) {}
        }
        this.els.drawerBody.innerHTML = `<pre style="background:#f4f4f4; padding:15px; overflow:auto; height:80vh;">${display}</pre>`;
      }
      // 4. Imagem
      else if (isImage) {
        this.els.drawerBody.innerHTML = `<div style="text-align:center; padding:20px;"><img src="${signedUrl}" style="max-width:100%; max-height:80vh"></div>`;
      }
      // 5. Fallback
      else {
        this.els.drawerBody.innerHTML = `
            <div style="text-align:center; padding:50px;">
                <p>Visualização não disponível.</p>
                <a href="${signedUrl}" target="_blank" class="btn" style="padding:10px 20px; background:#4b66c9; color:white; border-radius:5px; text-decoration:none;">Baixar Arquivo</a>
            </div>
        `;
      }
    } catch (e) {
      console.error("Erro Preview:", e);
      this.els.drawerBody.innerHTML = `<p style="padding:20px;">Erro ao carregar arquivo.</p>`;
    }
  }

  async remove(path) {
    if (!confirm("Apagar?")) return;
    await this.supa.storage.from(this.bucket).remove([path]);
    await this.supa.from(this.table).delete().eq("caminho_arquivo", path);
    this.loadDocuments();
  }

  closePreviewDrawer() {
    this.els.drawerOverlay?.classList.remove("active");
    this.els.drawerPanel?.classList.remove("active");
    this.els.drawerBody.innerHTML = "";
  }

  applyTypeFilter(type) {
    if (!type || type === "all") {
      this.loadDocuments();
      return;
    }

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

    const matchers = map[type] || [type];

    const filtered = this.docs.filter((d) => {
      const nome = (d.nome_original || d.titulo || "").toLowerCase();
      const mime = (d.tipo_arquivo || "").toLowerCase();
      return matchers.some((m) => nome.endsWith(m) || mime.includes(m));
    });

    const adaptados = filtered.map((d) => ({
      ...d,
      caminho: d.caminho_arquivo,
    }));
    UIManager.renderDocs(adaptados, this.els.docsGrid, "bibliotecaAluno");
  }

  debounce(fn, d) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, a), d);
    };
  }
}

function startStudentApp() {
  if (window.bibliotecaAluno) return;
  if (!window.supabaseClient && !window.supabase) {
    setTimeout(startStudentApp, 100);
    return;
  }
  window.bibliotecaAluno = new BibliotecaAluno();
}

if (document.readyState === "complete" || document.readyState === "interactive")
  startStudentApp();
else document.addEventListener("DOMContentLoaded", startStudentApp);

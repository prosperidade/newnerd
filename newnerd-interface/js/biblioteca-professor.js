/* ============================================================================
   BIBLIOTECA DO PROFESSOR – VERSÃO REVISADA
   Autenticação limpa (Supabase Auth real + modo dev)
   Fluxo robusto, sem duplicações e sem risco de quebrar o sistema
============================================================================ */

class BibliotecaProfessor {
  constructor() {
    console.log("📚 Inicializando BibliotecaProfessor...");

    // ========================
    // Supabase Client
    // ========================
    if (!window.SupabaseClient || !window.SupabaseClient.init()) {
      alert("ERRO CRÍTICO: Falha ao carregar SupabaseClient.");
      return;
    }

    this.supa = window.SupabaseClient.client;

    // ========================
    // Configurações
    // ========================
    this.bucket = CONFIG.BUCKET_PROFESSOR || "newnerd_professores";
    this.table = CONFIG.TABLE_ARQUIVOS_PROF || "arquivos_professor";

    // Modo dev ainda permite PROFESSOR_ID legado
    this.professorId =
      CONFIG.ENV === "dev" ? CONFIG.PROFESSOR_ID ?? null : null;

    // ========================
    // Estado interno
    // ========================
    this.docs = [];
    this.fileQueue = [];

    // ========================
    // DOM
    // ========================
    this.cacheEls();
    this.bindEvents();

    // Dark Mode opcional
    this.initDarkMode?.();

    // ========================
    // Iniciar fluxo
    // ========================
    this.ensureAuth().then(() => {
      this.loadDocuments();
    });
  }

  /* ============================================================================
     AUTENTICAÇÃO
     ============================================================================
     Regras:
     - Se houver usuário logado → usa user.id como professorId
     - Se NÃO houver usuário E estamos em DEV → tenta login fake
     - Se NÃO houver usuário E estamos em PROD → REDIRECIONA para login
  =========================================================================== */

  async ensureAuth() {
    console.log("🔐 Verificando autenticação do professor...");

    const { data } = await this.supa.auth.getUser();
    const user = data?.user;

    if (user) {
      this.professorId = user.id;
      console.log("🔐 Professor autenticado:", this.professorId);
      return;
    }

    // =============================
    // MODO DEV — LOGIN FAKE
    // =============================
    if (
      CONFIG.ENV === "dev" &&
      CONFIG.TESTE_EMAIL &&
      CONFIG.TESTE_SENHA &&
      !this.professorId
    ) {
      console.warn("⚠️ Modo DEV: executando login fake...");
      const { error } = await this.supa.auth.signInWithPassword({
        email: CONFIG.TESTE_EMAIL,
        password: CONFIG.TESTE_SENHA,
      });

      if (error) {
        console.error("❌ Login fake falhou:", error.message);
        alert("Erro no login de teste: " + error.message);
        return;
      }

      const { data: data2 } = await this.supa.auth.getUser();
      this.professorId = data2?.user?.id ?? null;

      console.log("✅ Login fake dev bem-sucedido:", this.professorId);
      return;
    }

    // =============================
    // PRODUÇÃO — REDIRECIONA
    // =============================
    if (CONFIG.ENV === "prod") {
      console.log("🔒 Sem login. Redirecionando para prof-login.html...");
      window.location.href = "prof-login.html";
      return;
    }
  }

  /* ============================================================================
     DOM
  ============================================================================ */
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

      darkModeToggle: document.getElementById("themeToggle"),
    };
  }

  bindEvents() {
    const dz = this.els.dropZone;
    const fi = this.els.fileInput;

    if (dz && fi) {
      dz.addEventListener("click", () => fi.click());
      dz.addEventListener("dragover", (e) => e.preventDefault());
      dz.addEventListener("dragenter", () => dz.classList.add("dragover"));
      dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
      dz.addEventListener("drop", (e) => {
        e.preventDefault();
        dz.classList.remove("dragover");
        this.addFiles(Array.from(e.dataTransfer.files));
      });

      fi.addEventListener("change", (e) =>
        this.addFiles(Array.from(e.target.files))
      );
    }

    if (this.els.uploadAllBtn)
      this.els.uploadAllBtn.addEventListener("click", () => this.uploadAll());

    if (this.els.searchInput)
      this.els.searchInput.addEventListener(
        "input",
        this.debounce((e) => this.handleSearch(e.target.value), 250)
      );

    if (this.els.filterTabs?.length)
      this.els.filterTabs.forEach((tab) =>
        tab.addEventListener("click", () => {
          this.els.filterTabs.forEach((t) => t.classList.remove("active"));
          tab.classList.add("active");
          this.applyTypeFilter(tab.getAttribute("data-type"));
        })
      );

    if (this.els.semanticBtn)
      this.els.semanticBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.performSemanticSearch();
      });

    if (this.els.drawerOverlay)
      this.els.drawerOverlay.addEventListener("click", () =>
        this.closePreviewDrawer()
      );

    if (this.els.drawerCloseBtn)
      this.els.drawerCloseBtn.addEventListener("click", () =>
        this.closePreviewDrawer()
      );

    if (this.els.darkModeToggle)
      this.els.darkModeToggle.addEventListener("click", () =>
        this.toggleDarkMode?.()
      );
  }

  /* ============================================================================
     ARQUIVOS – ADD / UPLOAD
  ============================================================================ */
  addFiles(files) {
    if (!files?.length) return;

    let novos = 0;

    files.forEach((file) => {
      const duplicadoFila = this.fileQueue.some(
        (f) => f.file.name === file.name && f.file.size === file.size
      );

      const duplicadoBiblioteca = this.docs.some(
        (d) => d.nome_original === file.name && d.tamanho_bytes === file.size
      );

      if (duplicadoFila) return;
      if (duplicadoBiblioteca) {
        this.toast(`"${file.name}" já existe na biblioteca.`, "warning");
        return;
      }

      this.fileQueue.push({
        id: `f_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        file,
        status: "pendente",
      });

      novos++;
    });

    if (novos > 0) {
      this.updateQueueUI();
      if (this.els.uploadQueue) this.els.uploadQueue.style.display = "block";
    }
  }

  updateQueueUI() {
    if (!this.els.fileQueueList) return;

    this.els.fileQueueList.innerHTML = this.fileQueue
      .map(
        (item) => `
      <div class="file-item" data-id="${item.id}">
        <div class="file-icon">📄</div>
        <div class="file-info">
          <div class="file-name">${this.escapeHtml(item.file.name)}</div>
          <div class="file-meta">${this.formatSize(item.file.size)}</div>
        </div>
        <div class="file-status">${this.statusBadge(item.status)}</div>
      </div>
    `
      )
      .join("");
  }

  async uploadAll() {
    if (!this.professorId) {
      await this.ensureAuth();
      if (!this.professorId) {
        this.toast("Professor não autenticado.", "error");
        return;
      }
    }

    const pendentes = this.fileQueue.filter((i) => i.status === "pendente");
    if (!pendentes.length) return;

    this.els.uploadAllBtn.disabled = true;

    for (const item of pendentes) {
      await this.uploadOne(item);
    }

    this.els.uploadAllBtn.disabled = false;
    this.fileQueue = [];
    this.updateQueueUI();
    await this.loadDocuments();
  }

  async uploadOne(item) {
    try {
      if (!this.professorId) throw new Error("Professor não autenticado.");

      item.status = "uploading";
      this.updateQueueUI();

      const clean = item.file.name.replace(/[^\w.\-() ]+/g, "_");
      const path = `${this.professorId}/${Date.now()}_${clean}`;

      // 1) Upload
      const { error: upErr } = await this.supa.storage
        .from(this.bucket)
        .upload(path, item.file, {
          contentType: item.file.type || "application/octet-stream",
        });

      if (upErr) throw upErr;

      // 2) Metadados
      const meta = {
        professor_id: this.professorId,
        path,
        nome_original: item.file.name,
        mime_type: item.file.type || null,
        tamanho_bytes: item.file.size || null,
        status: "uploaded",
      };

      const { error: dbErr } = await this.supa.from(this.table).insert(meta);

      if (dbErr) throw dbErr;

      // 3) Extração + embeddings
      item.status = "processing";
      this.updateQueueUI();

      const text = await this.tryExtractText(item.file);
      if (text) {
        await this.sendEmbeddings(path, text, item.file.name);
      }

      // 4) Finaliza
      await this.supa
        .from(this.table)
        .update({ status: "ready" })
        .eq("path", path);

      item.status = "ready";
      this.updateQueueUI();
    } catch (e) {
      console.error("❌ Upload falhou:", e);
      item.status = "error";
      this.updateQueueUI();
      this.toast(`Erro no upload: ${e.message || e}`, "error");
    }
  }

  async tryExtractText(file) {
    try {
      const mime = (file.type || "").toLowerCase();
      const name = (file.name || "").toLowerCase();

      const isText =
        mime.startsWith("text/") || /\.txt$/i.test(name) || /\.md$/i.test(name);

      const isPDF = mime.includes("pdf") || /\.pdf$/i.test(name);
      const isDOCX =
        mime.includes("word") ||
        mime.includes("docx") ||
        /\.docx?$/i.test(name);

      if (isText) return await file.text();
      if (isPDF) return await this._extrairTextoPDF(file);
      if (isDOCX) return await this._extrairTextoDOCX(file);

      return null;
    } catch (e) {
      console.warn("Falha ao extrair texto:", e);
      return null;
    }
  }

  async _extrairTextoPDF(file) {
    try {
      const arrayBuf = await file.arrayBuffer();

      const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;

      let texto = "";

      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const strings = content.items.map((i) => i.str).filter(Boolean);
        texto += strings.join(" ") + "\n";
      }

      return texto.trim();
    } catch (e) {
      console.warn("Falha ao extrair texto de PDF:", e);
      return null;
    }
  }

  async _extrairTextoDOCX(file) {
    try {
      const arrayBuf = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({
        arrayBuffer: arrayBuf,
      });

      return (result.value || "").trim();
    } catch (e) {
      console.warn("Falha ao extrair texto de DOCX:", e);
      return null;
    }
  }

  async sendEmbeddings(path, text, fileName) {
    try {
      if (!CONFIG.EMBED_URL) return;

      const chunkSize = 28000;
      const chunks = [];

      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
      }

      const payload = {
        professor_id: this.professorId,
        origem: "prof_biblioteca",
        chunks: chunks.map((c, idx) => ({
          texto: c,
          metadata: {
            titulo: fileName,
            caminho_arquivo: path,
            chunk_numero: idx + 1,
            total_chunks: chunks.length,
            data_upload: new Date().toISOString(),
          },
        })),
      };

      const res = await fetch(CONFIG.EMBED_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      const out = await res.json();
      console.log("📌 Embeddings enviados:", out);
    } catch (e) {
      console.warn("Embedding falhou:", e);
    }
  }

  /* ============================================================================
     BUSCAS / FILTROS / LISTAS
  ============================================================================ */
  async loadDocuments() {
    try {
      if (!this.professorId) return;

      const { data, error } = await this.supa
        .from(this.table)
        .select("*")
        .eq("professor_id", this.professorId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      this.docs = data || [];
      this.renderDocs(this.docs);
      this.updateStats();
    } catch (e) {
      console.error("Falha ao carregar documentos:", e);
      this.toast("Erro ao carregar documentos.", "error");
    }
  }

  renderDocs(list) {
    if (!this.els.docsGrid) return;

    if (!list?.length) {
      this.els.docsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <h3>Nenhum documento ainda</h3>
          <p>Faça upload para começar</p>
        </div>`;
      return;
    }

    this.els.docsGrid.innerHTML = list
      .map((doc) => {
        const titulo = doc.nome_original || doc.path.split("/").pop();
        return `
          <div class="document-card">
            <div class="document-type-icon">📄</div>
            <div class="document-title">${this.escapeHtml(titulo)}</div>
            <div class="document-excerpt">
              ${this.formatSize(doc.tamanho_bytes)} • ${doc.mime_type}
              ${this.statusBadge(doc.status)}
            </div>
            <div class="document-meta">
              <button onclick="bibliotecaProfessor.preview('${
                doc.path
              }')">👁️</button>
              <button onclick="bibliotecaProfessor.remove('${
                doc.path
              }')">🗑️</button>
            </div>
          </div>`;
      })
      .join("");
  }

  renderSemanticResults(list) {
    if (!this.els.docsGrid) return;

    if (!list?.length) {
      this.els.docsGrid.innerHTML = `
      <div class="empty-state">
        <h3>Nenhum resultado</h3>
        <p>Tente termos diferentes ou mais específicos</p>
      </div>
    `;
      return;
    }

    // Ordena pelo score
    list = [...list].sort(
      (a, b) => (b.score_final || 0) - (a.score_final || 0)
    );

    this.els.docsGrid.innerHTML = list
      .map((item) => {
        const titulo =
          item.metadata?.titulo ??
          item.documento_path?.split("/").pop() ??
          "(sem título)";

        const snippet = (item.chunk_texto || "").slice(0, 200);
        const score = item.score_final || 0;

        // Classifica o score
        let scoreClass = "low";
        let scoreLabel = "Baixa";

        if (score > 0.6) {
          scoreClass = "high";
          scoreLabel = "Alta";
        } else if (score > 0.3) {
          scoreClass = "medium";
          scoreLabel = "Média";
        }

        return `
        <div class="document-card semantic ${scoreClass}-score">
          <div class="document-type-icon">🧠</div>

          <div class="document-title">${this.escapeHtml(titulo)}</div>

          <div class="document-excerpt">
            ${this.escapeHtml(snippet)}...
            <div class="semantic-score ${scoreClass}">
             ${scoreLabel}: ${(score * 100).toFixed(0)}%
            </div>
          </div>

          <div class="document-meta">
            <button onclick="bibliotecaProfessor.preview('${
              item.documento_path
            }')">👁️ Ver</button>
          </div>
        </div>
      `;
      })
      .join("");
  }

  updateStats() {
    if (this.els.totalDocs) this.els.totalDocs.textContent = this.docs.length;

    if (this.els.totalSize) {
      const total = this.docs.reduce(
        (sum, d) => sum + (d.tamanho_bytes || 0),
        0
      );
      this.els.totalSize.textContent = this.formatSize(total);
    }
  }

  /* ============================================================================
     PREVIEW
  ============================================================================ */
  async preview(path) {
    try {
      if (!path) return;

      this.els.drawerOverlay?.classList.add("active");
      this.els.drawerPanel?.classList.add("active");

      const signed = await window.SupabaseClient.criarUrlAssinadaProfessor(
        path
      );
      if (!signed) throw new Error("Não foi possível criar URL assinada");

      const { data: fileMeta } = await this.supa
        .from(this.table)
        .select("*")
        .eq("path", path)
        .limit(1);

      const meta = fileMeta?.[0];
      const title = meta?.nome_original ?? path.split("/").pop();
      this.els.drawerTitle.textContent = title;

      const mime = (meta?.mime_type || "").toLowerCase();
      const isText =
        mime.startsWith("text/") ||
        /\.txt$/i.test(title) ||
        /\.md$/i.test(title);

      if (isText) {
        const resp = await fetch(signed);
        const txt = await resp.text();
        this.els.drawerBody.innerHTML = `<pre>${this.escapeHtml(txt)}</pre>`;
        return;
      }

      this.els.drawerBody.innerHTML = `
        <p>Pré-visualização indisponível.</p>
        <a href="${signed}" target="_blank">Abrir / Baixar</a>
      `;
    } catch (e) {
      console.error("Preview falhou:", e);
      this.els.drawerBody.innerHTML = "<p>Erro ao carregar preview.</p>";
    }
  }

  closePreviewDrawer() {
    this.els.drawerOverlay?.classList.remove("active");
    this.els.drawerPanel?.classList.remove("active");
    if (this.els.drawerBody) this.els.drawerBody.innerHTML = "";
  }

  /* ============================================================================
     REMOVER
  ============================================================================ */
  async remove(path) {
    if (!confirm("Tem certeza que deseja apagar este documento?")) return;

    const professorId = await SupabaseClient.getProfessorId();
    if (!professorId) {
      alert("Professor não autenticado.");
      return;
    }

    console.log("🗑️ Apagando documento:", path);

    const bucket = CONFIG.BUCKET_PROFESSOR || "newnerd_professores";

    // 1) Apaga da storage
    const { error: storageErr } = await SupabaseClient.client.storage
      .from(bucket)
      .remove([path]);

    if (storageErr) {
      console.error("❌ Erro ao apagar da storage:", storageErr);
      alert("Erro ao apagar arquivo da storage.");
      return;
    }

    // 2) Apaga da tabela arquivos_professor
    const { error: dbErr1 } = await SupabaseClient.client
      .from("arquivos_professor")
      .delete()
      .eq("caminho", path)
      .eq("professor_id", professorId);

    if (dbErr1) {
      console.error("❌ Erro ao apagar da tabela arquivos_professor:", dbErr1);
    }

    // 3) Apaga embeddings associados
    const { error: dbErr2 } = await SupabaseClient.client
      .from("professor_embeddings")
      .delete()
      .eq("metadata->>caminho_arquivo", path)
      .eq("professor_id", professorId);

    if (dbErr2) {
      console.error("❌ Erro ao apagar embeddings:", dbErr2);
    }

    // 4) Opcional — se existir: limpa tabela auxiliar
    await SupabaseClient.client
      .from("professor_embeddings_search")
      .delete()
      .eq("documento_path", path)
      .eq("professor_id", professorId);

    console.log("✅ Documento + embeddings apagados.");

    await this.loadDocuments(); // recarrega lista
    alert("Arquivo removido com sucesso.");
  }

  /* ============================================================================
     BUSCA SIMPLES / SEMÂNTICA
  ============================================================================ */
  handleSearch(query) {
    const q = (query || "").toLowerCase();
    const filtrados = this.docs.filter((d) =>
      (d.nome_original || "").toLowerCase().includes(q)
    );
    this.renderDocs(filtrados);
  }

  applyTypeFilter(type) {
    if (!type || type === "all") {
      this.renderDocs(this.docs);
      return;
    }

    const filtrados = this.docs.filter((d) => {
      const mime = (d.mime_type || "").toLowerCase();
      return mime.includes(type);
    });

    this.renderDocs(filtrados);
  }

  // ============================================================================
  // MÉTODO performSemanticSearch() - CORRIGIDO
  // Cole isso no seu biblioteca-professor.js, substituindo o método existente
  // ============================================================================

  // ============================================================================
  // MÉTODO performSemanticSearch() - CORRIGIDO
  // Cole isso no seu biblioteca-professor.js, substituindo o método existente
  // ============================================================================

  async performSemanticSearch() {
    try {
      const query = (this.els.semanticInput.value || "").trim();
      if (!query) {
        this.toast("Digite algo para buscar.", "warning");
        return;
      }

      // Validações
      if (!this.professorId) {
        this.toast("Professor não autenticado.", "error");
        return;
      }

      // Verifica documentos
      const { count: totalDocs } = await this.supa
        .from(this.table)
        .select("*", { count: "exact", head: true })
        .eq("professor_id", this.professorId);

      if (totalDocs === 0) {
        this.toast("Você ainda não tem documentos na biblioteca.", "info");
        return;
      }

      // Verifica embeddings
      const { count: totalEmbeddings } = await this.supa
        .from("professor_embeddings")
        .select("*", { count: "exact", head: true })
        .eq("professor_id", this.professorId)
        .not("embedding", "is", null);

      if (totalEmbeddings === 0) {
        this.toast(
          "Seus documentos ainda estão sendo processados. Aguarde alguns minutos.",
          "warning"
        );
        return;
      }

      // Mostra loading
      this.toast("Buscando com IA...", "info");

      // 🔧 BUSCA COM THRESHOLD MAIS BAIXO PARA GARANTIR RESULTADOS
      const resultados = await window.SupabaseClient.buscarSemanticaProfessor(
        query,
        this.professorId,
        {
          matchCount: 5,
          matchThreshold: 0.0, // 🔥 THRESHOLD ZERO = RETORNA OS MAIS PRÓXIMOS
        }
      );

      console.log("📊 Resultados da busca:", resultados);

      if (!resultados || resultados.length === 0) {
        this.toast(
          "Nenhum resultado encontrado. Tente termos diferentes.",
          "info"
        );
        this.renderDocs([]);
        return;
      }

      // 🔧 FILTRA APENAS OS COM SCORE RAZOÁVEL (> 0.3)
      const relevantes = resultados.filter((r) => (r.score_final || 0) > 0.3);

      if (relevantes.length === 0) {
        this.toast(
          `Encontrados ${resultados.length} resultados, mas com baixa relevância. Tente termos mais específicos.`,
          "warning"
        );
      } else {
        this.toast(
          `✅ Encontrados ${relevantes.length} resultados relevantes!`,
          "success"
        );
      }

      // Renderiza (mostra todos, mas destaca os relevantes)
      this.renderSemanticResults(resultados);
    } catch (e) {
      console.error("❌ Busca semântica falhou:", e);
      this.toast(`Erro na busca: ${e.message}`, "error");
    }
  }

  /* ============================================================================
     UTILITÁRIOS
  ============================================================================ */
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
  }

  escapeHtml(s) {
    return (s || "").replace(/[&<>"']/g, (m) => {
      return (
        {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m] || m
      );
    });
  }

  formatSize(bytes) {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  debounce(fn, delay = 300) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  toast(msg, type = "info") {
    const icons = {
      info: "ℹ️",
      success: "✅",
      error: "❌",
      warning: "⚠️",
    };
    alert(`${icons[type] || "ℹ️"} ${msg}`);
  }
}

/* ============================================================================
   BOOTSTRAP
=========================================================================== */
function initializeBiblioteca() {
  if (typeof window !== "undefined") {
    window.bibliotecaProfessor = new BibliotecaProfessor();
  }
}

// A biblioteca só inicia DEPOIS que a configuração estiver pronta.
document.addEventListener("configReady", initializeBiblioteca);

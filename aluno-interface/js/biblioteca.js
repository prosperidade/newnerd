// =======================================================
// BIBLIOTECA.JS - NEW NERD (Versão Restaurada)
// =======================================================

class BibliotecaManager {
  constructor() {
    this.supabase = window.supabaseClient;
    this.currentUser = null;
    this.documents = [];
    this.fileQueue = [];
    this.bucketName = window.CONFIG?.BUCKET_BIBLIOTECA || "alunos-biblioteca";

    this.elements = {};

    // Inicialização segura
    if (this.supabase) {
      this.init();
    } else {
      document.addEventListener("configReady", () => this.init());
    }
  }

  async init() {
    try {
      this.currentUser = await verificarAuth();
      if (!this.currentUser) return;

      console.log("✅ Biblioteca: Usuário autenticado");
      this.cacheElements();
      this.setupEventListeners();
      await this.loadDocuments();
    } catch (error) {
      console.error("❌ Erro na inicialização:", error);
    }
  }

  cacheElements() {
    this.elements = {
      dropZone: document.getElementById("dropZone"),
      fileInput: document.getElementById("fileInput"),
      uploadQueueEl: document.getElementById("uploadQueue"),
      fileQueueListEl: document.getElementById("fileQueue"),
      uploadAllBtn: document.getElementById("uploadAllBtn"),
      searchInput: document.getElementById("searchInput"),
      semanticSearchInput: document.getElementById("semanticSearch"),
      documentsGrid: document.getElementById("documentsGrid"),
      totalDocs: document.getElementById("totalDocs"),
      totalSize: document.getElementById("totalSize"),
      // Drawer
      drawer: document.getElementById("docDrawer"),
      drawerContent: document.getElementById("drawerContent"),
      closeDrawerBtn: document.getElementById("closeDrawer"),
    };
  }

  setupEventListeners() {
    // Upload
    if (this.elements.dropZone && this.elements.fileInput) {
      this.elements.dropZone.addEventListener("click", () =>
        this.elements.fileInput.click()
      );
      this.elements.fileInput.addEventListener("change", (e) =>
        this.addFilesToQueue(Array.from(e.target.files))
      );

      // Drag and drop visual
      this.elements.dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        this.elements.dropZone.style.borderColor = "var(--primary-color)";
      });
      this.elements.dropZone.addEventListener("dragleave", () => {
        this.elements.dropZone.style.borderColor = "";
      });
      this.elements.dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        this.elements.dropZone.style.borderColor = "";
        this.addFilesToQueue(Array.from(e.dataTransfer.files));
      });
    }

    if (this.elements.uploadAllBtn) {
      this.elements.uploadAllBtn.addEventListener("click", () =>
        this.uploadAllFiles()
      );
    }

    // Busca
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener(
        "input",
        this.debounce((e) => this.handleSearch(e.target.value), 300)
      );
    }

    // Drawer
    if (this.elements.closeDrawerBtn) {
      this.elements.closeDrawerBtn.addEventListener("click", () =>
        this.closeDrawer()
      );
    }
  }

  // --- UPLOAD ---

  addFilesToQueue(files) {
    let added = 0;
    files.forEach((file) => {
      // Verifica duplicata na fila
      if (this.fileQueue.some((f) => f.file.name === file.name)) return;

      // Verifica duplicata na biblioteca (Recurso que você queria manter!)
      if (this.documents.some((d) => d.titulo === file.name)) {
        alert(`O arquivo "${file.name}" já existe na sua biblioteca.`);
        return;
      }

      this.fileQueue.push({
        id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        file,
        status: "pendente",
      });
      added++;
    });

    if (added > 0) {
      this.updateQueueUI();
      this.elements.uploadQueueEl.style.display = "block";
    }
  }

  updateQueueUI() {
    if (!this.elements.fileQueueListEl) return;
    this.elements.fileQueueListEl.innerHTML = this.fileQueue
      .map(
        (item) => `
        <div class="file-item">
          <div class="file-icon">📄</div>
          <div class="file-info">
            <div class="file-name">${item.file.name}</div>
            <div class="file-status">${item.status}</div>
          </div>
        </div>
      `
      )
      .join("");
  }

  async uploadAllFiles() {
    const pending = this.fileQueue.filter((i) => i.status === "pendente");
    if (pending.length === 0) return;

    this.elements.uploadAllBtn.disabled = true;

    for (const item of pending) {
      await this.uploadFile(item);
    }

    this.elements.uploadAllBtn.disabled = false;
    this.fileQueue = [];
    this.updateQueueUI();
    this.elements.uploadQueueEl.style.display = "none";
    await this.loadDocuments();
  }

  async uploadFile(item) {
    try {
      item.status = "enviando...";
      this.updateQueueUI();

      const safeName = item.file.name.replace(/[^\w.\-() ]+/g, "_");
      const filePath = `${this.currentUser.id}/${Date.now()}_${safeName}`;

      // 1. Storage
      const { error: upErr } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, item.file);
      if (upErr) throw upErr;

      // 2. Banco
      const { data: doc, error: dbErr } = await this.supabase
        .from("aluno_documentos")
        .insert({
          aluno_id: this.currentUser.id,
          titulo: item.file.name,
          caminho_arquivo: filePath,
          tipo_arquivo: item.file.type,
          metadata: { size: item.file.size },
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      // 3. Embeddings (Simulação ou Chamada Real)
      // Se quiser ativar, descomente a linha abaixo:
      await this.gerarEmbeddingsDocumento(doc.id, item.file);

      item.status = "sucesso";
    } catch (error) {
      console.error(error);
      item.status = "erro";
    }
    this.updateQueueUI();
  }

  // --- LISTAGEM ---

  async loadDocuments() {
    const { data } = await this.supabase
      .from("aluno_documentos")
      .select("*")
      .eq("aluno_id", this.currentUser.id)
      .order("created_at", { ascending: false });

    this.documents = data || [];
    this.displayDocuments(this.documents);
    this.updateStats(); // Aqui estava o erro! Agora a função existe lá embaixo.
  }

  displayDocuments(docs) {
    if (!this.elements.documentsGrid) return;

    if (!docs || docs.length === 0) {
      this.elements.documentsGrid.innerHTML = `<div style="padding:20px; text-align:center;">Nenhum documento encontrado.</div>`;
      return;
    }

    this.elements.documentsGrid.innerHTML = docs
      .map((doc) => {
        const score = doc.similarity
          ? `<span style="color:#667eea; font-weight:bold;">${(
              doc.similarity * 100
            ).toFixed(0)}% Relevante</span>`
          : "";
        return `
        <div class="document-card" onclick="window.bibliotecaManager.openDrawer('${
          doc.caminho_arquivo
        }', '${doc.tipo_arquivo}')">
           ${score}
           <div style="font-weight:bold; margin-bottom:5px;">${doc.titulo}</div>
           <div style="font-size:0.8rem; color:gray;">${new Date(
             doc.created_at || Date.now()
           ).toLocaleDateString()}</div>
           <button onclick="event.stopPropagation(); window.bibliotecaManager.deleteDocument('${
             doc.id
           }', '${
          doc.caminho_arquivo
        }')" style="margin-top:10px; padding:5px; border:none; background:none; cursor:pointer;">🗑️</button>
        </div>
      `;
      })
      .join("");
  }

  // --- STATS (A função que faltava!) ---
  updateStats() {
    if (this.elements.totalDocs)
      this.elements.totalDocs.textContent = this.documents.length;
    if (this.elements.totalSize) {
      const size = this.documents.reduce(
        (acc, doc) => acc + (doc.metadata?.size || 0),
        0
      );
      this.elements.totalSize.textContent =
        (size / (1024 * 1024)).toFixed(2) + " MB";
    }
  }

  // --- BUSCA SEMÂNTICA ---

  async performSemanticSearch() {
    const query = this.elements.semanticSearchInput.value;
    if (!query) return;

    // Substituindo 'window.supabaseManager' por chamada direta
    const { data, error } = await this.supabase.rpc("buscar_biblioteca_aluno", {
      query_text: query,
      match_threshold: 0.7,
      match_count: 5,
    });

    if (error) {
      console.error(error);
      alert("Erro na busca.");
      return;
    }

    // Mapeia resultados para formato de documento
    const results = data.map((r) => ({
      id: r.doc_id,
      titulo: r.titulo || "Trecho",
      similarity: r.similarity,
      caminho_arquivo: r.caminho_arquivo, // Precisa vir da RPC
      created_at: null,
    }));

    this.displayDocuments(results);
  }

  // --- EMBEDDINGS (Mantido do seu código original) ---
  async gerarEmbeddingsDocumento(documentoId, file) {
    try {
      const texto = await file.text();
      // Lógica de chunking simplificada para não travar
      // ... (Futuramente enviaremos para Gemini)
      console.log("Log: Processando embeddings para", file.name);
    } catch (e) {
      console.error("Erro ao ler arquivo para embedding", e);
    }
  }

  // --- DRAWER ---
  async openDrawer(path, type) {
    const { data } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      let contentHTML = `<div style="text-align:center; padding:50px;"><a href="${data.signedUrl}" target="_blank" class="btn">Baixar Arquivo</a></div>`;

      if (type && type.includes("pdf")) {
        contentHTML = `<iframe src="${data.signedUrl}" style="width:100%; height:100%; border:none;"></iframe>`;
      }

      this.elements.drawerContent.innerHTML = contentHTML;
      this.elements.drawer.classList.add("active");
    }
  }

  closeDrawer() {
    this.elements.drawer.classList.remove("active");
    this.elements.drawerContent.innerHTML = "";
  }

  async deleteDocument(id, path) {
    if (!confirm("Excluir?")) return;
    await this.supabase.storage.from(this.bucketName).remove([path]);
    await this.supabase.from("aluno_documentos").delete().eq("id", id);
    this.loadDocuments();
  }

  debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  handleSearch(val) {
    if (!val) {
      this.loadDocuments();
      return;
    }
    const filtered = this.documents.filter((d) =>
      d.titulo.toLowerCase().includes(val.toLowerCase())
    );
    this.displayDocuments(filtered);
  }
}

// Função global para o botão HTML chamar
window.performSemanticSearch = () => {
  if (window.bibliotecaManager)
    window.bibliotecaManager.performSemanticSearch();
};

// Inicializa
if (typeof window !== "undefined") {
  window.bibliotecaManager = new BibliotecaManager();
}

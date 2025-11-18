// =======================================================
// BIBLIOTECA.JS - NEW NERD
// ✅ Integração com N8N localhost
// ✅ Upload + Processamento + Busca Semântica
// =======================================================

class BibliotecaManager {
  constructor() {
    // Usa o objeto global do CDN Supabase
    this.supabase = window.supabaseManager.supabaseClient;
    this.currentUser = null;
    this.documents = [];
    this.fileQueue = [];
    this.bucketName = CONFIG.BUCKET_BIBLIOTECA || "alunos-biblioteca";

    this.elements = {};
    this.init();
  }

  async init() {
    try {
      const {
        data: { user },
      } = await this.supabase.auth.getUser();

      if (!user) {
        console.warn("⚠️ Usuário não autenticado, redirecionando...");
        window.location.href = "login.html";
        return;
      }

      this.currentUser = user;
      console.log("✅ Usuário autenticado:", user.email);

      this.cacheElements();
      this.setupEventListeners();
      await this.loadDocuments();

      console.log("✅ Biblioteca inicializada com sucesso!");
    } catch (error) {
      console.error("❌ Erro na inicialização:", error);
      this.showNotification("Erro ao carregar a biblioteca", "error");
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
      filterTabs: document.querySelectorAll(".filter-tab"),
      totalDocs: document.getElementById("totalDocs"),
      totalSize: document.getElementById("totalSize"),
    };

    // Verificar elementos críticos
    const missingElements = Object.entries(this.elements)
      .filter(([key, el]) => !el && key !== "filterTabs")
      .map(([key]) => key);

    if (missingElements.length > 0) {
      console.warn("⚠️ Elementos HTML não encontrados:", missingElements);
    }
  }

  setupEventListeners() {
    // ✅ Drop Zone + File Input
    if (this.elements.dropZone && this.elements.fileInput) {
      this.elements.dropZone.addEventListener("click", () =>
        this.elements.fileInput.click()
      );

      this.elements.dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        this.elements.dropZone.classList.add("dragover");
      });

      this.elements.dropZone.addEventListener("dragleave", () => {
        this.elements.dropZone.classList.remove("dragover");
      });

      this.elements.dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        this.elements.dropZone.classList.remove("dragover");
        this.addFilesToQueue(Array.from(e.dataTransfer.files));
      });
    }

    if (this.elements.fileInput) {
      this.elements.fileInput.addEventListener("change", (e) =>
        this.addFilesToQueue(Array.from(e.target.files))
      );
    }

    // ✅ Botão Upload
    if (this.elements.uploadAllBtn) {
      this.elements.uploadAllBtn.addEventListener("click", () =>
        this.uploadAllFiles()
      );
    }

    // ✅ Busca Textual (simples)
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener(
        "input",
        this.debounce((e) => this.handleSearch(e.target.value), 300)
      );
    }

    // ✅ Filtro por Tipo
    if (this.elements.filterTabs?.length) {
      this.elements.filterTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          this.elements.filterTabs.forEach((t) => t.classList.remove("active"));
          tab.classList.add("active");
          const type = tab.getAttribute("data-type");
          this.applyTypeFilter(type);
        });
      });
    }
  }

  // ========================================
  // UPLOAD - ADICIONAR ARQUIVOS NA FILA
  // ========================================
  // (COLE ISTO DENTRO DE biblioteca.js, SUBSTITUINDO A FUNÇÃO addFilesToQueue)

  addFilesToQueue(files) {
    let ficheirosAdicionados = 0;

    files.forEach((file) => {
      // 1. Verifica se já está na FILA DE UPLOAD
      const jaNaFileQueue = this.fileQueue.some(
        (f) => f.file.name === file.name && f.file.size === file.size
      );

      // 2. Verifica se já existe na BIBLIOTECA (this.documents)
      // (Nota: Adaptado para as colunas do aluno: 'titulo' e 'metadata.size')
      const jaNaBiblioteca = this.documents.some(
        (doc) => doc.titulo === file.name && doc.metadata?.size === file.size
      );

      if (jaNaFileQueue) {
        // Já está na fila, não faz nada
        console.warn(`Ficheiro ${file.name} já está na fila.`);
      } else if (jaNaBiblioteca) {
        // Já existe na base de dados
        // (Nota: Adaptado para a função de 'toast' do aluno)
        this.showNotification(
          `O ficheiro "${file.name}" já existe na sua biblioteca.`,
          "warning"
        );
      } else {
        // É um ficheiro novo, adiciona à fila
        this.fileQueue.push({
          id: `file_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          file,
          status: "pendente",
        });
        ficheirosAdicionados++;
      }
    });

    // Só atualiza a interface se algo foi realmente adicionado
    if (ficheirosAdicionados > 0) {
      this.updateQueueUI();
      if (this.elements.uploadQueueEl) {
        this.elements.uploadQueueEl.style.display =
          this.fileQueue.length > 0 ? "block" : "none";
      }
    }
  }

  updateQueueUI() {
    if (!this.elements.fileQueueListEl) return;

    this.elements.fileQueueListEl.innerHTML = this.fileQueue
      .map(
        (item) => `
          <div class="file-item" data-id="${item.id}">
            <div class="file-icon">📄</div>
            <div class="file-info">
              <div class="file-name">${item.file.name}</div>
              <div class="file-meta">${this.formatFileSize(
                item.file.size
              )}</div>
            </div>
            <div class="file-status">
              <span class="status-badge ${this.getStatusClass(item.status)}">
                ${item.status}
              </span>
            </div>
          </div>
        `
      )
      .join("");
  }

  getStatusClass(status) {
    const statusMap = {
      pendente: "status-pending",
      "enviando...": "status-uploading",
      "processando...": "status-processing",
      sucesso: "status-success",
      erro: "status-error",
    };
    return statusMap[status] || "status-pending";
  }

  // ========================================
  // UPLOAD - FAZER UPLOAD DE TODOS
  // ========================================
  async uploadAllFiles() {
    const pendingFiles = this.fileQueue.filter(
      (item) => item.status === "pendente"
    );

    if (pendingFiles.length === 0) {
      this.showNotification("Nenhum arquivo pendente", "info");
      return;
    }

    if (this.elements.uploadAllBtn) {
      this.elements.uploadAllBtn.disabled = true;
    }

    console.log(`📤 Iniciando upload de ${pendingFiles.length} arquivo(s)...`);

    // Upload em paralelo
    await Promise.all(pendingFiles.map((item) => this.uploadFile(item)));

    if (this.elements.uploadAllBtn) {
      this.elements.uploadAllBtn.disabled = false;
    }

    // Limpar fila e recarregar documentos
    this.fileQueue = [];
    this.updateQueueUI();
    await this.loadDocuments();

    this.showNotification("✅ Upload concluído!", "success");
  }

  // ========================================
  // UPLOAD - ENVIAR ARQUIVO INDIVIDUAL
  // ========================================
  async uploadFile(item) {
    try {
      item.status = "enviando...";
      this.updateQueueUI();

      const safeName = item.file.name.replace(/[^\w.\-() ]+/g, "_");
      const filePath = `${this.currentUser.id}/${Date.now()}_${safeName}`;

      // ✅ ETAPA 1: Upload no Storage
      console.log(`📤 Enviando ${item.file.name} para o Storage...`);

      const { error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, item.file, {
          contentType: item.file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) throw uploadError;
      console.log(`✅ Upload no Storage concluído: ${filePath}`);

      // ✅ ETAPA 2: Inserir no banco de dados
      console.log(`💾 Inserindo registro no banco...`);

      const { data: docData, error: dbError } = await this.supabase
        .from("aluno_documentos")
        .insert({
          aluno_id: this.currentUser.id,
          titulo: item.file.name,
          caminho_arquivo: filePath,
          tipo_arquivo: item.file.type || "application/octet-stream",
          metadata: { size: item.file.size },
        })
        .select();

      console.log("🔍 Resposta do insert:");
      console.log("   Data:", docData);
      console.log("   Error:", dbError);

      if (dbError) {
        console.error(
          "❌ Erro ao inserir no banco:",
          JSON.stringify(dbError, null, 2)
        );
        throw dbError;
      }

      if (!docData || docData.length === 0) {
        console.error("❌ Insert não retornou dados!");
        throw new Error("Insert falhou - sem retorno");
      }

      const documento = docData[0];
      console.log(`✅ Registro criado no banco. ID: ${documento.id}`);

      // ✅ ETAPA 3: Gerar embeddings localmente
      item.status = "gerando embeddings...";
      this.updateQueueUI();

      console.log(`🧠 Gerando embeddings para documento ${documento.id}...`);
      await this.gerarEmbeddingsDocumento(documento.id, item.file);

      item.status = "sucesso";
      this.updateQueueUI();

      console.log(`✅ Documento ${item.file.name} processado com sucesso!`);
    } catch (error) {
      item.status = "erro";
      this.updateQueueUI();

      console.error(`❌ Falha no upload de ${item.file.name}:`, error);
      this.showNotification(`Erro: ${item.file.name}`, "error");
    }
  }

  // ========================================
  // WEBHOOK - CHAMAR PROCESSAMENTO N8N
  // ========================================
  async triggerProcessing(docId) {
    try {
      const webhookUrl = CONFIG.N8N_WEBHOOK_BIBLIOTECA_PROCESS;

      if (!webhookUrl) {
        console.error("❌ Webhook de processamento não configurado!");
        throw new Error("Webhook não configurado");
      }

      console.log(`🔄 Chamando webhook N8N: ${webhookUrl}`);
      console.log(
        `📦 Payload: doc_id=${docId}, aluno_id=${this.currentUser.id}`
      );

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          doc_id: docId,
          aluno_id: this.currentUser.id,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Webhook falhou: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      console.log("✅ Processamento iniciado no N8N:", result);

      return result;
    } catch (error) {
      console.error("❌ Erro ao chamar webhook:", error);
      throw error;
    }
  }

  // ========================================
  // DOCUMENTOS - CARREGAR LISTA
  // ========================================
  async loadDocuments() {
    try {
      console.log("📚 Carregando documentos...");

      const { data, error } = await this.supabase
        .from("aluno_documentos")
        .select("*")
        .eq("aluno_id", this.currentUser.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      this.documents = data || [];
      console.log(`✅ ${this.documents.length} documento(s) carregado(s)`);

      this.displayDocuments(this.documents);
      this.updateStats();
    } catch (error) {
      console.error("❌ Erro ao carregar documentos:", error);
      this.showNotification("Erro ao carregar documentos", "error");
    }
  }

  // ========================================
  // DOCUMENTOS - EXIBIR NA GRID
  // ========================================
  displayDocuments(docs) {
    if (!this.elements.documentsGrid) return;

    if (!docs || docs.length === 0) {
      this.elements.documentsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔭</div>
          <h3>Nenhum documento na biblioteca</h3>
          <p>Faça upload de seus materiais de estudo para começar</p>
        </div>`;
      return;
    }

    this.elements.documentsGrid.innerHTML = docs
      .map((doc) => {
        const created = doc.created_at
          ? new Date(doc.created_at).toLocaleDateString("pt-BR")
          : "";

        // ✅ Badge de processamento
        const isProcessing = doc.status === "processing";
        const processingBadge = isProcessing
          ? '<span class="badge badge-warning" style="display: block; margin-top: 10px;">⏳ Processando...</span>'
          : "";

        return `
          <div class="document-card" data-id="${doc.id}">
            <div class="document-type-icon">${this.getFileIcon(
              doc.tipo_arquivo
            )}</div>
            <div class="document-title" title="${doc.titulo || ""}">${
          doc.titulo || "(sem título)"
        }</div>
            ${processingBadge}
            <div class="document-meta">
              <span>${created}</span>
              <div class="document-actions">
                <button 
                  class="action-btn" 
                  onclick="bibliotecaManager.viewDocument('${doc.id}')"
                  ${isProcessing ? 'disabled style="opacity: 0.5;"' : ""}
                  title="Visualizar">
                  👁️
                </button>
                <button 
                  class="action-btn" 
                  onclick="bibliotecaManager.deleteDocument('${doc.id}')"
                  title="Deletar">
                  🗑️
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  getFileIcon(mimeType) {
    const mime = (mimeType || "").toLowerCase();

    if (mime.includes("pdf")) return "📄";
    if (mime.includes("word") || mime.includes("docx")) return "📝";
    if (mime.includes("text")) return "📃";
    if (mime.includes("csv")) return "📊";
    if (mime.includes("json")) return "🔧";
    if (mime.includes("audio")) return "🎵";
    if (mime.includes("video")) return "🎥";
    if (mime.includes("zip")) return "📦";

    return "📄";
  }

  // ========================================
  // BUSCA - TEXTUAL SIMPLES
  // ========================================
  async handleSearch(query) {
    if (!query || query.trim() === "") {
      this.displayDocuments(this.documents);
      return;
    }

    console.log(`🔍 Buscando: "${query}"`);

    // Busca simples por título
    const filtered = this.documents.filter((doc) => {
      const titulo = (doc.titulo || "").toLowerCase();
      const q = query.toLowerCase();
      return titulo.includes(q);
    });

    console.log(`✅ ${filtered.length} resultado(s) encontrado(s)`);
    this.displayDocuments(filtered);
  }

  // ========================================
  // FILTRO - POR TIPO DE ARQUIVO
  // ========================================
  applyTypeFilter(type) {
    if (!type || type === "all") {
      this.displayDocuments(this.documents);
      return;
    }

    console.log(`🔍 Filtrando por tipo: ${type}`);

    const filtered = this.documents.filter((doc) => {
      const mime = (doc.tipo_arquivo || "").toLowerCase();

      if (type === "pdf") return mime.includes("pdf");
      if (type === "docx")
        return mime.includes("word") || mime.includes("docx");
      if (type === "txt") return mime.includes("text/plain");
      if (type === "csv") return mime.includes("csv");
      if (type === "json") return mime.includes("json");
      if (type === "audio") return mime.startsWith("audio/");
      if (type === "video") return mime.startsWith("video/");

      return true;
    });

    console.log(`✅ ${filtered.length} documento(s) filtrado(s)`);
    this.displayDocuments(filtered);
  }

  // ========================================
  // BUSCA SEMÂNTICA - COM IA
  // ========================================
  async performSemanticSearch() {
    const query = this.elements.semanticSearchInput?.value?.trim();

    if (!query) {
      this.showNotification("Digite algo para buscar", "warning");
      return;
    }

    try {
      this.showNotification("Buscando com IA...", "info");

      const resultados = await window.supabaseManager.buscarBibliotecaSemantica(
        query,
        this.currentUser.id,
        { matchCount: 10 }
      );

      if (resultados.length === 0) {
        this.showNotification("Nenhum resultado encontrado", "info");
        this.displayDocuments([]);
        return;
      }

      const formatados = window.supabaseManager.formatarResultados(resultados);
      this.displayDocuments(formatados);

      this.showNotification(
        `Encontrados ${resultados.length} documentos!`,
        "success"
      );
    } catch (error) {
      console.error("Erro na busca semântica:", error);
      this.showNotification("Erro na busca inteligente", "error");
    }
  }

  // ========================================
  // BUSCA SEMÂNTICA - EXIBIR RESULTADOS
  // ========================================
  displaySearchResults(results) {
    if (!this.elements.documentsGrid) return;

    this.elements.documentsGrid.innerHTML = results
      .map((result) => {
        const score = (result.similarity * 100).toFixed(0);

        return `
          <div class="document-card" data-id="${result.doc_id}">
            <div class="document-type-icon">📄</div>
            <div class="document-title">${result.titulo || "(sem título)"}</div>
            <div class="document-excerpt" style="
              color: var(--text-secondary);
              font-size: 0.9rem;
              line-height: 1.4;
              margin: 10px 0;
              display: -webkit-box;
              -webkit-line-clamp: 3;
              -webkit-box-orient: vertical;
              overflow: hidden;
            ">${result.content || ""}</div>
            <div class="document-meta">
              <span style="font-weight: 600; color: #667eea;">
                Relevância: ${score}%
              </span>
              <div class="document-actions">
                <button 
                  class="action-btn" 
                  onclick="bibliotecaManager.viewDocument('${result.doc_id}')"
                  title="Visualizar">
                  👁️
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // ========================================
  // AÇÕES - VISUALIZAR DOCUMENTO
  // ========================================
  async viewDocument(docId) {
    const doc = this.documents.find((d) => d.id === docId);

    if (!doc) {
      console.error(`❌ Documento ${docId} não encontrado`);
      return;
    }

    try {
      console.log(`👁️ Visualizando documento: ${doc.titulo}`);

      // Gerar URL assinada (60 segundos)
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(doc.caminho_arquivo, 60);

      if (error || !data?.signedUrl) {
        throw error || new Error("URL assinada não gerada");
      }

      console.log(`✅ URL assinada gerada, abrindo documento...`);
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("❌ Erro ao visualizar documento:", error);
      this.showNotification("Erro ao abrir documento", "error");
    }
  }

  // ========================================
  // AÇÕES - DELETAR DOCUMENTO
  // ========================================
  async deleteDocument(docId) {
    if (!confirm("Deseja realmente deletar este documento?")) {
      return;
    }

    const docToDelete = this.documents.find((d) => d.id === docId);

    if (!docToDelete) {
      console.error(`❌ Documento ${docId} não encontrado`);
      return;
    }

    try {
      console.log(`🗑️ Deletando documento: ${docToDelete.titulo}`);

      // 1. Deletar do Storage
      const { error: stgErr } = await this.supabase.storage
        .from(this.bucketName)
        .remove([docToDelete.caminho_arquivo]);

      if (stgErr) throw stgErr;

      // 2. Deletar do banco (CASCADE deleta embeddings também)
      const { error: dbErr } = await this.supabase
        .from("aluno_documentos")
        .delete()
        .eq("id", docId);

      if (dbErr) throw dbErr;

      console.log(`✅ Documento deletado com sucesso`);
      this.showNotification("✅ Documento deletado!", "success");

      await this.loadDocuments();
    } catch (error) {
      console.error("❌ Erro ao deletar documento:", error);
      this.showNotification("Erro ao deletar documento", "error");
    }
  }

  // ========================================
  // UI - ATUALIZAR ESTATÍSTICAS
  // ========================================
  updateStats() {
    if (this.elements.totalDocs) {
      this.elements.totalDocs.textContent = this.documents.length;
    }

    if (this.elements.totalSize) {
      const totalSize = this.documents.reduce(
        (acc, doc) => acc + (doc.metadata?.size || 0),
        0
      );
      this.elements.totalSize.textContent = this.formatFileSize(totalSize);
    }
  }

  // ========================================
  // UTILITÁRIOS
  // ========================================
  formatFileSize(bytes) {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        func.apply(this, args);
      }, timeout);
    };
  }

  // (SUBSTITUA esta função no biblioteca.js)

  showNotification(message, type = "info") {
    const icons = {
      info: "ℹ️",
      success: "✅",
      error: "❌",
      warning: "⚠️",
    };
    const prefix = `${icons[type] || "ℹ️"}`;

    // 1. Loga no console (como já fazia)
    console.log(`${prefix} ${message}`);

    // 2. ADICIONA O ALERTA VISUAL
    alert(`${prefix} ${message}`);
  }
  // ========================================
  // SUBSTITUIR função gerarEmbeddingsDocumento em biblioteca.js (ALUNO)
  // ========================================
  async gerarEmbeddingsDocumento(documentoId, file) {
    try {
      const texto = await file.text();
      if (!texto || texto.trim().length === 0) {
        console.log("⚠️ Arquivo sem texto, pulando embeddings");
        return;
      }

      // Chunking simples (mantendo o seu fluxo)
      const MAX_CHARS_PER_CHUNK = 28000;
      const chunks = [];
      for (let i = 0; i < texto.length; i += MAX_CHARS_PER_CHUNK) {
        chunks.push(texto.substring(i, i + MAX_CHARS_PER_CHUNK));
      }

      // Monta payload para Edge Function
      const payload = {
        // usamos aluno_id como professor_id para particionar por usuário (tabela é genérica)
        professor_id: this.currentUser.id,
        origem: "aluno_biblioteca",
        origem_id: documentoId,
        chunks: chunks.map((c, idx) => ({
          texto: c,
          metadata: {
            titulo: file.name,
            documento_id: documentoId,
            aluno_id: this.currentUser.id,
            chunk_numero: idx + 1,
            total_chunks: chunks.length,
          },
        })),
      };

      // Chamada para a Edge Function (Authorization = ANON)
      const res = await fetch(CONFIG.EMBED_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Embed Edge falhou: ${res.status} ${t}`);
      }

      const out = await res.json(); // { ok: true, count: N }
      console.log("✅ Embeddings gravados via Edge:", out);
    } catch (error) {
      console.error("❌ Erro ao gerar embeddings:", error);
      throw error;
    }
  }
}
// ========================================
// INICIALIZAÇÃO
// ========================================
if (typeof window !== "undefined") {
  window.bibliotecaManager = null;

  // Aguardar DOM carregar
  document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 Inicializando Biblioteca Manager...");
    window.bibliotecaManager = new BibliotecaManager();
  });

  // Função global para busca semântica (chamada pelo botão)
  window.performSemanticSearch = () => {
    if (window.bibliotecaManager) {
      window.bibliotecaManager.performSemanticSearch();
    } else {
      console.error("❌ BibliotecaManager não inicializado");
    }
  };
}

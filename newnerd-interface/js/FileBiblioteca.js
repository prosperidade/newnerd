export const FileProcessor = {
  basename(filename = "") {
    try {
      return filename.split("/").pop();
    } catch {
      return filename;
    }
  },

  ext(filename = "") {
    const base = this.basename(filename);
    const idx = base.lastIndexOf(".");
    return idx >= 0 ? base.slice(idx + 1).toLowerCase() : "";
  },

  guessMimeByExtension(filename = "") {
    const ext = this.ext(filename);
    const map = {
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
      md: "text/markdown",
      csv: "text/csv",
      json: "application/json",
      zip: "application/zip",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      epub: "application/epub+zip",
      html: "text/html",
      mp3: "audio/mpeg",
      mp4: "video/mp4",
    };
    return map[ext] || "application/octet-stream";
  },

  async tryExtractText(file) {
    try {
      const name = file.name.toLowerCase();
      const type = (file.type || "").toLowerCase();

      // A) Texto Puro
      const textExtensions = [
        ".txt",
        ".md",
        ".csv",
        ".json",
        ".html",
        ".xml",
        ".js",
        ".css",
      ];
      const isTextType =
        type.startsWith("text/") ||
        type.includes("json") ||
        type.includes("csv");

      if (isTextType || textExtensions.some((ext) => name.endsWith(ext))) {
        console.log("📝 Lendo arquivo como texto plano...");
        return await file.text();
      }

      // B) DOCX (Word)
      if (name.endsWith(".docx") || type.includes("word")) {
        console.log("📝 Lendo DOCX via Mammoth...");
        return await this._extrairTextoDOCX(file);
      }

      // C) PDF (Backend)
      if (name.endsWith(".pdf") || type.includes("pdf")) {
        console.log("📄 PDF detectado: Delegando leitura para o servidor.");
        return null;
      }

      return null;
    } catch (e) {
      console.warn("Erro ao extrair texto localmente:", e);
      return null;
    }
  },

  async _extrairTextoDOCX(file) {
    return new Promise((resolve) => {
      if (typeof mammoth === "undefined") {
        console.warn("Mammoth não carregado.");
        resolve("");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        mammoth
          .extractRawText({ arrayBuffer: e.target.result })
          .then((res) => resolve((res.value || "").trim()))
          .catch((err) => {
            console.error("Erro Mammoth:", err);
            resolve("");
          });
      };
      reader.onerror = () => resolve("");
      reader.readAsArrayBuffer(file);
    });
  },
};

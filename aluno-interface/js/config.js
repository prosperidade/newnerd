// =======================================================
// CONFIG.JS - ALUNO (compatível com Deno Lint)
// =======================================================

// Ambiente (dev vs prod) sem depender de window
const HOST = typeof location !== "undefined" ? location.hostname : "";
const ENV = HOST === "localhost" || HOST === "127.0.0.1" ? "dev" : "prod";

// Lê config local de forma segura (sem window)
const LOCAL =
  typeof globalThis !== "undefined" && globalThis.LOCAL_CONFIG
    ? globalThis.LOCAL_CONFIG
    : null;

const CONFIG = {
  // Supabase (anon key pode estar no front)
  SUPABASE_URL: "https://cxizjrdlkhhegzpzzmgl.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",

  // OpenAI: só em dev; em prod mantenha null no front
  OPENAI_API_KEY: ENV === "dev" ? LOCAL?.OPENAI_API_KEY ?? null : null,

  // Buckets/Tabelas
  BUCKET_BIBLIOTECA: "alunos-biblioteca",

  // Webhooks (localhost só em dev)
  WEBHOOK_GERACAO:
    ENV === "dev"
      ? "http://localhost:5678/webhook/newnerd-openai"
      : "https://SEU_ENDPOINT_PROD/external/newnerd-openai",

  WEBHOOK_CORRECAO:
    ENV === "dev"
      ? "http://localhost:5678/webhook/newnerd-alunos-correcao"
      : "https://SEU_ENDPOINT_PROD/external/newnerd-alunos-correcao",

  // UI
  TIMEOUT_PADRAO: 30000,
};

// Exporta globalmente sem usar window
if (typeof globalThis !== "undefined") {
  globalThis.CONFIG = CONFIG;
}

// 🚀 Inicialização do Supabase (sem 'async' desnecessário)
(function init() {
  if (
    typeof globalThis === "undefined" ||
    typeof globalThis.supabase === "undefined"
  ) {
    console.warn(
      "⚠️ Biblioteca Supabase não encontrada. Verifique os scripts no HTML."
    );
    return;
  }

  console.log("🔌 Conectando ao Supabase (aluno)...");
  // cria cliente no escopo global de forma segura
  globalThis.supabaseClient = globalThis.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY
  );
  console.log("✅ Supabase conectado (aluno).");

  if (typeof document !== "undefined") {
    document.dispatchEvent(new Event("configReady"));
  }
})();

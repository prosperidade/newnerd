// ========================================
// CONFIG.JS - PROFESSOR (compatível com Deno Lint)
// ========================================
console.log("🔥 CONFIG.JS (professor) CARREGANDO...");

// Descobre ambiente sem depender de "window"
const HOST = typeof location !== "undefined" ? location.hostname : "";
const ENV = HOST === "localhost" || HOST === "127.0.0.1" ? "dev" : "prod";

// Lê config local com segurança
const LOCAL =
  typeof globalThis !== "undefined" && globalThis.LOCAL_CONFIG
    ? globalThis.LOCAL_CONFIG
    : null;

const LEGACY_DEV = {
  PROFESSOR_ID: "5531f4a4-656b-4565-98b0-cc66dd0ca0ef",
  TESTE_EMAIL: "teste@newnerd.com",
  TESTE_SENHA: "12345678",
};

const CONFIG = {
  ENV,

  GENERATE_FUNCTION_URL:
    "https://cxizjrdlkhhegzpzzmgl.supabase.co/functions/v1/generate-question",
  WEBHOOK_URL:
    "https://cxizjrdlkhhegzpzzmgl.supabase.co/functions/v1/generate-question",

  REQUEST_TIMEOUT: 60000,

  SUPABASE_URL: "https://cxizjrdlkhhegzpzzmgl.supabase.co",
  // anon key é pública por definição
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",

  // Em DEV pode vir do config.local.js; em PROD permanece null para não expor
  OPENAI_API_KEY: ENV === "dev" ? LOCAL?.OPENAI_API_KEY ?? null : null,

  // Dados de teste apenas no dev
  PROFESSOR_ID: ENV === "dev" ? LEGACY_DEV.PROFESSOR_ID : null,
  TESTE_EMAIL: ENV === "dev" ? LEGACY_DEV.TESTE_EMAIL : null,
  TESTE_SENHA: ENV === "dev" ? LEGACY_DEV.TESTE_SENHA : null,

  // Embeddings
  EMBED_URL: "https://cxizjrdlkhhegzpzzmgl.functions.supabase.co/embed",
  EMBED_MODE: "edge_first",

  // Tabelas / Buckets
  BUCKET_PROFESSOR: "newnerd_professores",
  TABLE_ARQUIVOS_PROF: "arquivos_professor",
  TABLE_PROFESSORES: "professores",

  // UI / LocalStorage
  STORAGE_KEY: "newnerd_historico",
  THEME_KEY: "newnerd_theme",
  MAX_HISTORY_ITEMS: 100,

  MESSAGES: {
    GENERATING: "Gerando questão com IA...",
    GENERATING_MULTIPLE: "Gerando {n} questões... Aguarde...",
    SUCCESS: "✅ Questão gerada com sucesso!",
    ERROR_GENERIC: "❌ Erro ao gerar questão. Tente novamente.",
    ERROR_TIMEOUT:
      "⏱️ Tempo esgotado. O servidor demorou muito para responder.",
    ERROR_NETWORK: "🌐 Erro de conexão.",
    ERROR_EMPTY: "❌ Resposta vazia do servidor.",
    COPIED: "✅ Copiado para área de transferência!",
    HISTORY_CLEARED: "🗑️ Histórico limpo com sucesso!",
  },
};

const QUESTION_TYPES = {
  multipla_escolha: "Múltipla Escolha",
  discursiva: "Discursiva",
  verdadeiro_falso: "Verdadeiro/Falso",
  associacao: "Associação",
  desconhecido: "Tipo Desconhecido",
};

const DISCIPLINAS = [
  "Matemática",
  "Português",
  "Biologia",
  "Química",
  "Física",
  "História",
  "Geografia",
  "Inglês",
  "Artes",
  "Educação Física",
  "Filosofia",
  "Sociologia",
];

const SERIES = [
  "6º ano",
  "7º ano",
  "8º ano",
  "9º ano",
  "1º EM",
  "2º EM",
  "3º EM",
];
const DIFICULDADES = ["fácil", "média", "difícil"];

// Exporta globais de forma segura (sem window)
if (typeof globalThis !== "undefined") {
  globalThis.CONFIG = CONFIG;
  globalThis.QUESTION_TYPES = QUESTION_TYPES;
  globalThis.DISCIPLINAS = DISCIPLINAS;
  globalThis.SERIES = SERIES;
  globalThis.DIFICULDADES = DIFICULDADES;
}

// Inicialização (sem async para evitar 'require-await')
function initializeConfigProfessor() {
  // Se o arquivo local carregou antes (pelo HTML), atualiza chave
  CONFIG.OPENAI_API_KEY = ENV === "dev" ? LOCAL?.OPENAI_API_KEY ?? null : null;

  // Cria cliente Supabase se a lib global existir
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.supabase !== "undefined"
  ) {
    try {
      globalThis.supabaseClient = globalThis.supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_ANON_KEY
      );
      console.log("✅ Supabase client inicializado (professor)!");
    } catch (e) {
      console.error("❌ Erro ao inicializar o Supabase client:", e);
    }
  } else {
    console.warn(
      "⚠️ Biblioteca Supabase não encontrada. Verifique os scripts no HTML."
    );
  }

  console.log("✅ CONFIG (professor) carregado:", CONFIG.WEBHOOK_URL);
  console.log("🔥 CONFIG.JS (professor) CARREGADO COMPLETAMENTE!");

  if (typeof document !== "undefined") {
    document.dispatchEvent(new Event("configReady"));
  }
}

initializeConfigProfessor();

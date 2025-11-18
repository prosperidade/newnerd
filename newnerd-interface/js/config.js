// ========================================
// CONFIGURAÇÕES DO MONITON / NEW NERD (PROFESSOR)
// ========================================

console.log("🔥 CONFIG.JS CARREGANDO...");

// Ambiente atual: "dev" = desenvolvimento, "prod" = produção
const ENV = "dev"; // <<< QUANDO FOR SUBIR PRA PRODUÇÃO, TROCAR PARA "prod"

// Bloco com dados LEGADOS de desenvolvimento.
// NÃO é pra usar isso em produção.
  PROFESSOR_ID: "5531f4a4-656b-4565-98b0-cc66dd0ca0ef",
  TESTE_EMAIL: "teste@moniton.com",
  TESTE_SENHA: "12345678",
};

const CONFIG = {
  ENV,

  // ===========================
  // FUNÇÕES / WEBHOOKS
  // ===========================
  GENERATE_FUNCTION_URL:
    "https://cxizjrdlkhhegzpzzmgl.supabase.co/functions/v1/generate-question",
  WEBHOOK_URL:
    "https://cxizjrdlkhhegzpzzmgl.supabase.co/functions/v1/generate-question", // compatibilidade

  REQUEST_TIMEOUT: 60000,

  // ===========================
  // SUPABASE
  // ===========================
  SUPABASE_URL: "https://cxizjrdlkhhegzpzzmgl.supabase.co",

  // ANON KEY pode ficar no front (é pública por definição)
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4aXpqcmRsa2hoZWd6cHp6bWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0Mzk0OTIsImV4cCI6MjA3NTAxNTQ5Mn0.BUbNOWdjfweTHHZsJfTzyaq_qVxWiHM41Ug7X4ozUow",

  // ===========================
  // CHAVES SENSÍVEIS (LEGADO)
  // ===========================
  // Em DEV ainda deixamos aqui pra compatibilidade.
  // Em PROD isso vira null pra garantir que nada use no navegador.
  OPENAI_API_KEY: ENV === "dev" ? LEGACY_DEV.OPENAI_API_KEY : null,

  // Identidade de teste (professor)
  PROFESSOR_ID: ENV === "dev" ? LEGACY_DEV.PROFESSOR_ID : null,
  TESTE_EMAIL: ENV === "dev" ? LEGACY_DEV.TESTE_EMAIL : null,
  TESTE_SENHA: ENV === "dev" ? LEGACY_DEV.TESTE_SENHA : null,

  // ===========================
  // EMBEDDINGS
  // ===========================
  // Preferir SEMPRE Edge Function em produção.
  EMBED_URL: "https://cxizjrdlkhhegzpzzmgl.functions.supabase.co/embed",

  // controla comportamento: "edge_first" tenta Edge; cai para "browser" se falhar.
  EMBED_MODE: "edge_first", // "edge_first" | "browser_only"

  // ===========================
  // TABELAS / BUCKETS DO PROFESSOR
  // ===========================
  BUCKET_PROFESSOR: "newnerd_professores",
  TABLE_ARQUIVOS_PROF: "arquivos_professor",
  TABLE_PROFESSORES: "professores",

  // ===========================
  // UI / LOCALSTORAGE
  // ===========================
  STORAGE_KEY: "moniton_historico",
  THEME_KEY: "moniton_theme",
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

console.log("✅ CONFIG carregado:", CONFIG.WEBHOOK_URL);

if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
  window.QUESTION_TYPES = QUESTION_TYPES;
  window.DISCIPLINAS = DISCIPLINAS;
  window.SERIES = SERIES;
  window.DIFICULDADES = DIFICULDADES;
  console.log("✅ Variáveis globais exportadas com sucesso!");
}

console.log("🔥 CONFIG.JS CARREGADO COMPLETAMENTE!");

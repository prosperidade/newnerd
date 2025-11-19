// ========================================
// CONFIGURAÇÕES DO NEW NERD (PROFESSOR)
// ========================================

console.log("🔥 CONFIG.JS CARREGANDO...");

// Ambiente atual: "dev" = desenvolvimento, "prod" = produção
const ENV = "dev"; // <<< QUANDO FOR SUBIR PRA PRODUÇÃO, TROCAR PARA "prod"

// =================================================================================
// CARREGAMENTO ASSÍNCRONO DE CONFIGURAÇÕES LOCAIS (APENAS EM DEV)
// Esta função tenta carregar um `config.local.js` do mesmo diretório.
// Se não encontrar, segue silenciosamente.
// =================================================================================
function loadLocalConfig() {
  if (ENV === "dev") {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "./config.local.js"; // Caminho local
      script.onload = () => {
        console.log("✅ config.local.js carregado com sucesso.");
        resolve();
      };
      script.onerror = () => {
        console.warn(
          "⚠️  config.local.js não encontrado. Chaves locais (ex: OpenAI) não serão carregadas. Isso é esperado em produção."
        );
        resolve(); // Resolve mesmo em caso de erro
      };
      document.head.appendChild(script);
    });
  }
  return Promise.resolve();
}

// Bloco com dados LEGADOS de desenvolvimento.
// NÃO é pra usar isso em produção.
const LEGACY_DEV = {
  PROFESSOR_ID: "5531f4a4-656b-4565-98b0-cc66dd0ca0ef",
  TESTE_EMAIL: "teste@newnerd.com",
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
  // Em DEV, tenta carregar do config.local.js.
  // Em PROD, é null para garantir que a chave nunca seja exposta no navegador.
  OPENAI_API_KEY:
    ENV === "dev"
      ? window.LOCAL_CONFIG?.OPENAI_API_KEY || null
      : null,

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

// =================================================================================
// INICIALIZAÇÃO ASSÍNCRONA
// Garantimos que o config local seja carregado ANTES de definirmos as configs
// globais que podem depender dele (como a OPENAI_API_KEY).
// =================================================================================
async function initializeConfig() {
  await loadLocalConfig(); // Espera a tentativa de carregamento do config local

  // As configurações são definidas APÓS a tentativa de carregamento
  const CONFIG = {
    ENV,

    // ... (restante das configurações que já estavam definidas)
    GENERATE_FUNCTION_URL:
      "https://cxizjrdlkhhegzpzzmgl.supabase.co/functions/v1/generate-question",
    WEBHOOK_URL:
      "https://cxizjrdlkhhegzpzzmgl.supabase.co/functions/v1/generate-question",
    REQUEST_TIMEOUT: 60000,
    SUPABASE_URL: "https://cxizjrdlkhhegzpzzmgl.supabase.co",
    SUPABASE_ANON_KEY:
      "eyJhbGciOiJIJ1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4aXpqcmRsa2hoZWd6cHp6bWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0Mzk0OTIsImV4cCI6MjA3NTAxNTQ5Mn0.BUbNOWdjfweTHHZsJfTzyaq_qVxWiHM41Ug7X4ozUow",

    // A chave da OpenAI agora busca `window.LOCAL_CONFIG` que foi carregado
    OPENAI_API_KEY:
      ENV === "dev" ? window.LOCAL_CONFIG?.OPENAI_API_KEY || null : null,

    PROFESSOR_ID: ENV === "dev" ? LEGACY_DEV.PROFESSOR_ID : null,
    TESTE_EMAIL: ENV === "dev" ? LEGACY_DEV.TESTE_EMAIL : null,
    TESTE_SENHA: ENV === "dev" ? LEGACY_DEV.TESTE_SENHA : null,

    EMBED_URL: "https://cxizjrdlkhhegzpzzmgl.functions.supabase.co/embed",
    EMBED_MODE: "edge_first",

    BUCKET_PROFESSOR: "newnerd_professores",
    TABLE_ARQUIVOS_PROF: "arquivos_professor",
    TABLE_PROFESSORES: "professores",

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

  // Exporta as variáveis globais
  if (typeof window !== "undefined") {
    window.CONFIG = CONFIG;
    window.QUESTION_TYPES = QUESTION_TYPES;
    window.DISCIPLINAS = DISCIPLINAS;
    window.SERIES = SERIES;
    window.DIFICULDADES = DIFICULDADES;
    console.log("✅ Variáveis globais exportadas com sucesso!");
  }

  console.log("✅ CONFIG carregado:", CONFIG.WEBHOOK_URL);
  console.log("🔥 CONFIG.JS CARREGADO COMPLETAMENTE!");

  // Dispara um evento customizado para notificar que a configuração está pronta
  document.dispatchEvent(new Event("configReady"));
}

// Inicia o processo
initializeConfig();

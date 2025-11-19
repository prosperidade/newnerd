console.log("🔐 prof-auth.js carregado");

let supa = null;
let isConfigReady = false;

// 1. A inicialização do Supabase agora depende da configuração
function initProfessorSupabase() {
  if (supa) return supa; // Já inicializado

  if (!isConfigReady || typeof window === "undefined" || !window.CONFIG || !window.supabase) {
    console.error("❌ Pré-requisitos para inicializar o Supabase (prof-auth) não atendidos.");
    return null;
  }

  supa = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY
  );

  console.log("✅ Supabase (prof-auth) inicializado.");
  return supa;
}

// 2. Ouvinte que ativa a inicialização
document.addEventListener("configReady", () => {
  isConfigReady = true;
  initProfessorSupabase(); // Inicializa assim que a config estiver pronta
});

// -----------------------
// Login do professor
// -----------------------
async function profLogin() {
  const client = initProfessorSupabase();
  if (!client) {
    alert("Erro interno: Supabase não inicializado.");
    return;
  }

  const emailEl = document.getElementById("email");
  const senhaEl = document.getElementById("senha");

  const email = emailEl?.value?.trim();
  const senha = senhaEl?.value?.trim();

  if (!email || !senha) {
    alert("Preencha e-mail e senha.");
    return;
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      console.error("❌ Erro no login do professor:", error);
      alert("Erro no login: " + error.message);
      return;
    }

    console.log("✅ Professor autenticado:", data.user);
    // depois do login, manda pra biblioteca do professor
    window.location.href = "biblioteca-professor.html";
  } catch (e) {
    console.error("❌ Exceção no login:", e);
    alert("Erro inesperado no login.");
  }
}

// -----------------------
// Verificar login nas páginas do professor
// -----------------------
async function verificarLoginProfessor() {
  const client = initProfessorSupabase();
  if (!client) {
    console.error("❌ Supabase não inicializado em verificarLoginProfessor.");
    return;
  }

  try {
    const { data } = await client.auth.getUser();
    const user = data?.user;

    if (user) {
      console.log("🔐 Professor logado:", user.id);
      return;
    }

    // Modo DEV: permite login fake
    if (CONFIG.ENV === "dev" && CONFIG.TESTE_EMAIL && CONFIG.TESTE_SENHA) {
      console.warn("⚠️ Modo DEV: usando login fake do professor.");
      const { error } = await client.auth.signInWithPassword({
        email: CONFIG.TESTE_EMAIL,
        password: CONFIG.TESTE_SENHA,
      });
      if (error) {
        console.error("❌ Login fake falhou:", error);
        alert("Erro no login de teste: " + error.message);
      } else {
        console.log("✅ Login fake dev bem-sucedido.");
      }
      return;
    }

    // Produção → manda pra tela de login do professor
    console.log("🔒 Sem sessão de professor. Redirecionando para prof-login.");
    window.location.href = "prof-login.html";
  } catch (e) {
    console.error("Erro ao verificar login do professor:", e);
  }
}

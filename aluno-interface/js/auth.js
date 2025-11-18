// ====================================================================
// AUTH.JS - LOGIN POR MATRÍCULA (via RPC) + SESSÃO
// Requer: config.js -> Supabase CDN -> auth.js
// ====================================================================

if (!window.supabase) {
  console.error("Supabase CDN não carregado. Verifique a ordem dos scripts.");
}

// --- LINHA REMOVIDA ---
// const supabaseClient = window.supabaseManager.supabaseClient;
//
// MOTIVO: A variável 'supabaseClient' já foi declarada globalmente
// por um script anterior (ex: supabase-manager.js).
// As funções abaixo irão automaticamente usar essa variável global.
// ---------------------

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", handleLoginComMatricula);
});

async function handleLoginComMatricula(e) {
  e.preventDefault();

  const matricula = document.getElementById("matricula")?.value?.trim();
  const senha = document.getElementById("senha")?.value ?? "";
  const errorEl = document.getElementById("error");
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.remove("active");
  }

  try {
    if (!matricula || !senha) {
      throw new Error("Preencha matrícula e senha.");
    }

    // 1) Obter email pela matrícula (RPC retorna TEXT)
    //    (Esta chamada agora usa o 'supabaseClient' global)
    const { data: email, error: rpcError } = await supabaseClient.rpc(
      "get_email_by_matricula",
      { matricula_param: matricula }
    );

    if (rpcError || !email) {
      throw new Error("Matrícula não encontrada.");
    }

    // 2) Login com email/senha
    //    (Esta chamada agora usa o 'supabaseClient' global)
    const { error: authError } = await supabaseClient.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (authError) throw authError;

    // 3) Redireciona para o painel
    window.location.href = "painel.html";
  } catch (err) {
    console.error("❌ Erro no login:", err);
    if (errorEl) {
      errorEl.textContent = "Matrícula ou senha incorretos.";
      errorEl.classList.add("active");
    }
  }
}

async function verificarAuth() {
  // (Esta chamada agora usa o 'supabaseClient' global)
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session.user; // usuário do Auth (id, email, etc.)
}

async function logout() {
  // (Esta chamada agora usa o 'supabaseClient' global)
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// Disponibiliza no escopo global para outras páginas (onclick/consumo)
window.verificarAuth = verificarAuth;
window.logout = logout;
window.handleLoginComMatricula = handleLoginComMatricula;
// --- FIM DO ARQUIVO auth.js ---

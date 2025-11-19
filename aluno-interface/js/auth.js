// aluno-interface/js/auth.js

if (!window.supabase) {
  console.error("Supabase CDN não carregado.");
}

// Variável global para perfil do aluno
let usuarioAtual = null;

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", handleLoginComMatricula);
});

// --- LOGIN ---
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
    if (!matricula || !senha) throw new Error("Preencha matrícula e senha.");

    // 1. Busca email pela matrícula (RPC do banco)
    const { data: email, error: rpcError } = await window.supabaseClient.rpc(
      "get_email_by_matricula",
      { matricula_param: matricula }
    );

    if (rpcError || !email) throw new Error("Matrícula não encontrada.");

    // 2. Login no Auth
    const { error: authError } =
      await window.supabaseClient.auth.signInWithPassword({
        email,
        password: senha,
      });
    if (authError) throw authError;

    window.location.href = "painel.html";
  } catch (err) {
    console.error("Erro login:", err);
    if (errorEl) {
      errorEl.textContent = "Dados incorretos.";
      errorEl.classList.add("active");
    }
  }
}

// --- VERIFICAÇÃO E PERFIL ---
async function verificarAuth() {
  const {
    data: { session },
  } = await window.supabaseClient.auth.getSession();

  if (!session) {
    // Se não tiver sessão e não estiver na tela de login, chuta pra fora
    if (!window.location.pathname.includes("login.html")) {
      window.location.href = "login.html";
    }
    return null;
  }

  // Se já carregamos o perfil antes, retorna ele (cache simples)
  if (usuarioAtual) return usuarioAtual;

  // Busca dados detalhados na tabela 'alunos'
  const { data: aluno, error } = await window.supabaseClient
    .from("alunos")
    .select("*")
    .eq("id", session.user.id) // O ID do Auth é o mesmo da tabela alunos
    .single();

  if (error || !aluno) {
    console.warn("Usuário logado sem cadastro na tabela de alunos.");
    return session.user; // Retorna ao menos o user do Auth
  }

  usuarioAtual = aluno;
  return aluno;
}

async function logout() {
  await window.supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// Exporta globalmente
window.verificarAuth = verificarAuth;
window.logout = logout;
window.handleLoginComMatricula = handleLoginComMatricula;

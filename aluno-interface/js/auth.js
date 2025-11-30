// js/auth.js - VERSÃO DE RECUPERAÇÃO (Lógica Simplificada)

async function verificarAuth() {
  // 1. Verifica se o Supabase foi carregado
  if (!window.supabaseClient) {
    console.error(
      "Supabase não carregou. Verifique sua internet ou o config.js"
    );
    return null;
  }

  // 2. Pega a sessão atual do usuário
  const {
    data: { session },
    error,
  } = await window.supabaseClient.auth.getSession();

  const onLoginPage = window.location.pathname.includes("login.html");

  if (error || !session) {
    if (!onLoginPage) {
      window.location.href = "login.html";
    }
    return null;
  }

  // 3. Confirma se a sessão pertence a um aluno válido
  try {
    const { data: aluno, error: alunoError } = await window.supabaseClient
      .from("alunos")
      .select("*")
      .or(
        `auth_user_id.eq.${session.user.id},email.eq.${session.user.email}`
      )
      .maybeSingle();

    if (alunoError) {
      console.error("Erro ao buscar aluno:", alunoError.message);
    }

    if (!aluno) {
      console.warn(
        "Sessão não corresponde a um aluno. Encerrando sessão e redirecionando."
      );
      await window.supabaseClient.auth.signOut();
      if (!onLoginPage) window.location.href = "login.html";
      return null;
    }

    window.alunoAtivo = aluno;
    return aluno;
  } catch (lookupErr) {
    console.error("Falha ao validar aluno:", lookupErr);
    if (!onLoginPage) window.location.href = "login.html";
    return null;
  }
}

// Função simples de Logout
async function logout() {
  await window.supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// Inicializa verificadores globais
window.verificarAuth = verificarAuth;
window.logout = logout;

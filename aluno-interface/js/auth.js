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

  if (error || !session) {
    // Se não tem sessão e não está no login, manda pro login
    if (!window.location.pathname.includes("login.html")) {
      window.location.href = "login.html";
    }
    return null;
  }

  // 3. Retorna os dados básicos do usuário (vincular tabelas depois)
  // Isso garante que o sistema não trave se o perfil 'alunos' estiver incompleto
  return {
    id: session.user.id,
    email: session.user.email,
    // Tenta pegar metadados se existirem, senão usa o email como nome
    nome: session.user.user_metadata?.nome || session.user.email,
  };
}

// Função simples de Logout
async function logout() {
  await window.supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// Inicializa verificadores globais
window.verificarAuth = verificarAuth;
window.logout = logout;

// js/painel-professor.js

document.addEventListener("DOMContentLoaded", async () => {
  await verificarAuthProfessor();
});

async function verificarAuthProfessor() {
  // Espera o Supabase carregar
  if (!window.supabaseClient) {
    setTimeout(verificarAuthProfessor, 100);
    return;
  }

  // Pega sessão
  const {
    data: { session },
    error,
  } = await window.supabaseClient.auth.getSession();

  if (error || !session) {
    console.warn("Sem sessão. Redirecionando para login.");
    // window.location.href = "login-professor.html"; // Crie este arquivo depois se precisar
    // Por enquanto, alerta:
    alert("Faça login primeiro.");
    return;
  }

  // Carrega dados do professor
  try {
    const { data: professor } = await window.supabaseClient
      .from("professores")
      .select("*")
      .or(`auth_user_id.eq.${session.user.id},email.eq.${session.user.email}`)
      .maybeSingle();

    if (professor) {
      const nome = professor.nome.split(" ")[0];
      document.getElementById("profNome").textContent = nome;
      document.getElementById("saudacao").textContent = `Olá, Prof. ${nome}!`;

      // Carrega contagem de questões
      const { count } = await window.supabaseClient
        .from("questoes_geradas")
        .select("*", { count: "exact", head: true })
        .eq("professor_id", professor.id);

      if (count) document.getElementById("statQuestoes").textContent = count;
    } else {
      // Se logou mas não é professor, avisa
      console.warn("Usuário não é professor.");
    }
  } catch (err) {
    console.error(err);
  }
}

async function logout() {
  await window.supabaseClient.auth.signOut();
  window.location.href = "login.html"; // Ou onde preferir
}

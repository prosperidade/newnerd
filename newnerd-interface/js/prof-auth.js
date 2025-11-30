console.log("🔐 prof-auth.js (professor) carregado");

let professorCheckInFlight = null;

function isOnProfessorLogin() {
  return window.location.pathname.includes("prof-login.html");
}

async function fetchProfessorProfile() {
  const client = globalThis.supabaseClient;
  if (!client) {
    console.error("❌ Supabase client indisponível para buscar professor.");
    return null;
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  if (!session) return null;

  const { data: professor, error } = await client
    .from("professores")
    .select("*")
    .or(
      `auth_user_id.eq.${session.user.id},email.eq.${session.user.email}`
    )
    .maybeSingle();

  if (error) {
    console.error("❌ Erro ao buscar professor:", error.message);
    return null;
  }

  return professor || null;
}

async function ensureProfessorAuth() {
  if (professorCheckInFlight) return professorCheckInFlight;

  professorCheckInFlight = (async () => {
    const client = globalThis.supabaseClient;
    if (!client) {
      console.error("❌ Supabase não inicializado para professor.");
      return null;
    }

    const {
      data: { session },
    } = await client.auth.getSession();

    if (!session) {
      if (!isOnProfessorLogin()) {
        window.location.href = "prof-login.html";
      }
      return null;
    }

    const professor = await fetchProfessorProfile();

    if (!professor) {
      console.warn(
        "Sessão não corresponde a um professor válido. Fazendo logout..."
      );
      await client.auth.signOut();
      if (!isOnProfessorLogin()) window.location.href = "prof-login.html";
      return null;
    }

    globalThis.currentProfessor = professor;
    console.log("👨‍🏫 Professor autenticado:", professor.email || professor.id);
    return professor;
  })();

  try {
    return await professorCheckInFlight;
  } finally {
    professorCheckInFlight = null;
  }
}

document.addEventListener("configReady", () => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureProfessorAuth, {
      once: true,
    });
  } else {
    ensureProfessorAuth();
  }
});

window.ensureProfessorAuth = ensureProfessorAuth;
window.fetchProfessorProfile = fetchProfessorProfile;

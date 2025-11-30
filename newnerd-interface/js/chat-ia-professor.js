// js/chat-ia-professor.js

let user, sessaoAtual, supabase;
let inicializando = false;

// Tenta iniciar assim que possível
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => tentarIniciar(0));
} else {
  tentarIniciar(0);
}

// Também escuta o evento do config.js
document.addEventListener("configReady", () => tentarIniciar(0));

async function tentarIniciar(tentativa = 0) {
  if (inicializando || (supabase && user && sessaoAtual)) return;
  inicializando = true;

  console.log(`🔄 Inicializando Chat Professor (Tentativa ${tentativa})...`);

  // 1) Supabase global
  if (window.supabaseClient) supabase = window.supabaseClient;
  if (!supabase && window.supabase && window.CONFIG) {
    // fallback se necessário (igual ao aluno)
    supabase = window.supabase.createClient(
      window.CONFIG.SUPABASE_URL,
      window.CONFIG.SUPABASE_ANON_KEY
    );
    window.supabaseClient = supabase;
  }

  if (!supabase) {
    console.warn("⏳ Supabase ainda não está pronto. Aguardando...");
    inicializando = false;
    if (tentativa < 5) {
      setTimeout(() => tentarIniciar(tentativa + 1), 1000);
    } else {
      console.error("❌ Supabase não encontrado após várias tentativas.");
    }
    return;
  }

  // 2) Auth (verifica Professor)
  user = await verificarAuthProfessorChat();
  if (!user) {
    console.log("👤 Aguardando login de professor...");
    inicializando = false;
    return;
  }

  // 3) Sessão
  console.log("✅ Professor autenticado. Carregando sessão...");
  await iniciarSessao();

  // 4) UI
  configurarEventosUI();
  inicializando = false;
}

async function verificarAuthProfessorChat() {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: prof } = await supabase
    .from("professores")
    .select("id, nome, email, auth_user_id")
    .or(`auth_user_id.eq.${session.user.id},email.eq.${session.user.email}`)
    .maybeSingle();

  if (prof) {
    return { ...session.user, nome: prof.nome, professor_id: prof.id };
  }
  return null;
}

function configurarEventosUI() {
  const input = document.getElementById("inputMsg");
  const btn = document.querySelector(".btn");

  if (input) {
    // limpar listeners antigos
    const novo = input.cloneNode(true);
    input.parentNode.replaceChild(novo, input);
    novo.addEventListener("keypress", (e) => {
      if (e.key === "Enter") enviarMensagem();
    });
    setTimeout(() => novo.focus(), 300);
  }

  if (btn) {
    btn.onclick = null;
    btn.addEventListener("click", enviarMensagem);
  }
}

async function iniciarSessao() {
  try {
    let { data: sessao } = await supabase
      .from("chat_sessoes")
      .select("*")
      .eq("usuario_id", user.id)
      .eq("usuario_tipo", "professor")
      .eq("ativa", true)
      .single();

    if (!sessao) {
      const { data, error } = await supabase
        .from("chat_sessoes")
        .insert({
          usuario_id: user.id,
          usuario_tipo: "professor",
          contexto: { papel: "assistente_pedagogico" },
        })
        .select()
        .single();
      if (error) throw error;
      sessao = data;
    }

    sessaoAtual = sessao.id;
    await carregarHistorico();
  } catch (error) {
    console.error("Erro ao iniciar sessão:", error);
  }
}

async function carregarHistorico() {
  if (!sessaoAtual) return;

  const { data } = await supabase
    .from("chat_mensagens")
    .select("*")
    .eq("sessao_id", sessaoAtual)
    .order("created_at", { ascending: true });

  const container = document.getElementById("mensagens");
  container.innerHTML = "";

  if (!data || data.length === 0) {
    adicionarMensagemUI(
      `👋 Olá, Prof. ${
        user.nome ? user.nome.split(" ")[0] : ""
      }! Sou seu assistente pedagógico.`,
      "ia"
    );
  } else {
    (data || []).forEach((msg) =>
      adicionarMensagemUI(msg.conteudo, msg.remetente)
    );
  }
}

window.enviarMensagem = async function () {
  const input = document.getElementById("inputMsg");
  if (!input) return;

  const texto = input.value.trim();
  if (!texto) return;

  if (!supabase || !sessaoAtual) {
    await tentarIniciar();
    if (!sessaoAtual) return alert("Aguarde a conexão...");
  }

  input.value = "";
  adicionarMensagemUI(texto, "usuario");
  mostrarDigitando();

  try {
    // 1) salva usuário
    await supabase.from("chat_mensagens").insert({
      sessao_id: sessaoAtual,
      remetente: "usuario",
      conteudo: texto,
    });

    // 2) chama IA via Edge Function (MESMA LÓGICA DO ALUNO)
    const respostaTexto = await chamarIAProfessor(texto);

    removerDigitando();
    adicionarMensagemUI(respostaTexto, "ia");

    // 3) salva IA
    await supabase.from("chat_mensagens").insert({
      sessao_id: sessaoAtual,
      remetente: "ia",
      conteudo: respostaTexto,
    });
  } catch (erro) {
    console.error(erro);
    removerDigitando();
    adicionarMensagemUI("Erro ao processar.", "ia");
  }
};
async function chamarIAProfessor(mensagem) {
  // histórico curto
  const { data: historico } = await supabase
    .from("chat_mensagens")
    .select("remetente, conteudo")
    .eq("sessao_id", sessaoAtual)
    .order("created_at", { ascending: false })
    .limit(6);

  const mensagensAPI = (historico || []).reverse().map((h) => ({
    role: h.remetente === "usuario" ? "user" : "assistant",
    content: h.conteudo,
  }));

  mensagensAPI.push({ role: "user", content: mensagem });

  // 1) Tenta invoke (com JWT do professor)
  try {
    const { data, error } = await supabase.functions.invoke("chat-ia", {
      body: {
        mensagens: mensagensAPI,
        contexto: { papel: "assistente_pedagogico" },
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.texto;
  } catch (e) {
    console.warn("invoke falhou; tentando fetch direto…", e);
  }

  // 2) Fallback: fetch direto (requer --no-verify-jwt no deploy)
  const url = `${window.CONFIG.SUPABASE_URL}/functions/v1/chat-ia`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${window.CONFIG.SUPABASE_ANON_KEY}`,
      apikey: window.CONFIG.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      mensagens: mensagensAPI,
      contexto: { papel: "assistente_pedagogico" },
    }),
  });

  if (!resp.ok) {
    const errTxt = await resp.text().catch(() => "");
    throw new Error(`Edge ${resp.status}: ${errTxt || resp.statusText}`);
  }

  const data = await resp.json();
  if (data?.error) throw new Error(data.error);
  return data.texto;
}

function adicionarMensagemUI(texto, remetente) {
  const container = document.getElementById("mensagens");
  const div = document.createElement("div");
  div.className = `msg ${remetente}`;
  if (typeof marked !== "undefined" && remetente === "ia") {
    div.innerHTML = marked.parse(texto);
  } else {
    div.textContent = texto;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function mostrarDigitando() {
  const container = document.getElementById("mensagens");
  const div = document.createElement("div");
  div.className = "msg ia digitando";
  div.innerHTML = "💭 ...";
  div.id = "digitando";
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removerDigitando() {
  document.getElementById("digitando")?.remove();
}

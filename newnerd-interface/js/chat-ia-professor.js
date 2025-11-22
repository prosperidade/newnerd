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

  // 1. Tenta pegar o Supabase Global
  if (window.supabaseClient) {
    supabase = window.supabaseClient;
  }

  // SE NÃO ACHOU O SUPABASE:
  if (!supabase) {
    console.warn("⏳ Supabase ainda não está pronto. Aguardando...");
    inicializando = false;

    // Tenta de novo em 1 segundo (max 5 tentativas)
    if (tentativa < 5) {
      setTimeout(() => tentarIniciar(tentativa + 1), 1000);
    } else {
      console.error("❌ Supabase não encontrado após várias tentativas.");
    }
    return;
  }

  // 2. Auth (Verifica se é Professor)
  user = await verificarAuthProfessorChat();
  if (!user) {
    console.log("👤 Aguardando login de professor...");
    inicializando = false;
    return;
  }

  // 3. Sessão
  console.log("✅ Professor autenticado. Carregando sessão...");
  await iniciarSessao();

  // 4. UI
  configurarEventosUI();
  inicializando = false;
}

// Auth Específica
async function verificarAuthProfessorChat() {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: prof } = await supabase
    .from("professores")
    .select("id, nome")
    .eq("email", session.user.email)
    .single();

  if (prof) {
    return { ...session.user, nome: prof.nome, professor_id: prof.id };
  }
  return null;
}

function configurarEventosUI() {
  const input = document.getElementById("inputMsg");
  const btn = document.getElementById("btnEnviar");

  if (input) {
    // Clone para remover listeners antigos
    const novoInput = input.cloneNode(true);
    input.parentNode.replaceChild(novoInput, input);

    novoInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") enviarMensagem();
    });
    // Foco automático
    setTimeout(() => novoInput.focus(), 500);
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
    (data || []).forEach((msg) => {
      adicionarMensagemUI(msg.conteudo, msg.remetente);
    });
  }
}

// Enviar Mensagem Global
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
    // 1. Salva User
    await supabase.from("chat_mensagens").insert({
      sessao_id: sessaoAtual,
      remetente: "usuario",
      conteudo: texto,
    });

    // 2. Chama IA
    const respostaTexto = await chamarIAProfessor(texto);

    removerDigitando();
    adicionarMensagemUI(respostaTexto, "ia");

    // 3. Salva IA
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
  const localKey =
    (window.LOCAL_CONFIG && window.LOCAL_CONFIG.OPENAI_API_KEY) ||
    (window.CONFIG && window.CONFIG.OPENAI_API_KEY);

  if (!localKey) return "⚠️ Chave API não configurada.";

  // Histórico curto
  const { data: historico } = await supabase
    .from("chat_mensagens")
    .select("remetente, conteudo")
    .eq("sessao_id", sessaoAtual)
    .order("created_at", { ascending: false })
    .limit(6);

  let mensagensAPI = (historico || []).reverse().map((h) => ({
    role: h.remetente === "usuario" ? "user" : "assistant",
    content: h.conteudo,
  }));

  mensagensAPI.unshift({
    role: "system",
    content:
      "Você é um assistente pedagógico para professores. Seja formal e útil.",
  });

  mensagensAPI.push({ role: "user", content: mensagem });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: mensagensAPI,
      temperature: 0.7,
    }),
  });

  if (!response.ok) throw new Error("Erro OpenAI");
  const data = await response.json();
  return data.choices[0].message.content;
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

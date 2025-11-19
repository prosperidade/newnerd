let user, sessaoAtual, supabase;

// Tenta iniciar assim que possível
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", tentarIniciar);
} else {
  tentarIniciar();
}

document.addEventListener("configReady", tentarIniciar);

async function tentarIniciar() {
  // Se já iniciou, não faz nada
  if (supabase && user && sessaoAtual) return;

  console.log("🔄 Inicializando chat...");

  // 1. Recupera/Cria o Supabase
  if (window.supabaseClient) {
    supabase = window.supabaseClient;
  } else if (window.supabase && window.CONFIG) {
    console.log("⚠️ Fallback: Criando Supabase manualmente...");
    supabase = window.supabase.createClient(
      window.CONFIG.SUPABASE_URL,
      window.CONFIG.SUPABASE_ANON_KEY
    );
    window.supabaseClient = supabase;
  }

  if (!supabase) return; // Ainda não carregou libs

  // 2. Auth
  user = await verificarAuth();
  if (!user) {
    console.log("👤 Aguardando login do usuário...");
    return;
  }

  // 3. Sessão e Histórico
  console.log("✅ Usuário autenticado. Carregando sessão...");
  await iniciarSessao();

  // 4. Configurar Botões (Importante!)
  configurarEventosUI();
}

function configurarEventosUI() {
  const input = document.getElementById("inputMsg");
  const btn = document.querySelector("button.btn"); // Pega o botão de enviar

  if (input) {
    // Remove clones anteriores para evitar duplo envio
    const novoInput = input.cloneNode(true);
    input.parentNode.replaceChild(novoInput, input);

    novoInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") enviarMensagem();
    });

    // Foca no input
    novoInput.focus();
  }

  if (btn) {
    // Remove onclick do HTML e usa JS
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
      .eq("ativa", true)
      .single();

    if (!sessao) {
      const { data, error } = await supabase
        .from("chat_sessoes")
        .insert({
          usuario_id: user.id,
          usuario_tipo: "aluno",
          contexto: { papel: "tutor_estudos" },
        })
        .select()
        .single();

      if (error) throw error;
      sessao = data;
    }

    sessaoAtual = sessao.id;
    console.log("🆔 Sessão atual:", sessaoAtual);
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

  // === AQUI VOLTA A MENSAGEM DE BOAS VINDAS ===
  if (!data || data.length === 0) {
    adicionarMensagemUI(
      "👋 Olá! Sou seu assistente de estudos New Nerd. Como posso ajudar?",
      "ia"
    );
  } else {
    (data || []).forEach((msg) => {
      adicionarMensagemUI(msg.conteudo, msg.remetente);
    });
  }
}

// Torna a função global para caso o HTML ainda tenha onclick
window.enviarMensagem = async function () {
  console.log("📩 Tentando enviar mensagem...");

  const input = document.getElementById("inputMsg");
  if (!input) return;

  const texto = input.value.trim();
  if (!texto) {
    console.log("⚠️ Texto vazio.");
    return;
  }

  if (!supabase || !sessaoAtual) {
    console.error("❌ Erro Crítico: Supabase ou Sessão perdidos.");
    await tentarIniciar(); // Tenta recuperar
    if (!sessaoAtual) {
      alert("Erro de conexão. Atualize a página.");
      return;
    }
  }

  // UI
  input.value = "";
  adicionarMensagemUI(texto, "usuario");
  mostrarDigitando();

  try {
    // 1. Salva User no Supabase
    console.log("💾 Salvando mensagem do usuário...");
    const { error: erroSalvar } = await supabase.from("chat_mensagens").insert({
      sessao_id: sessaoAtual,
      remetente: "usuario",
      conteudo: texto,
    });
    if (erroSalvar) console.error("Erro ao salvar msg user:", erroSalvar);

    // 2. Chama IA
    console.log("🤖 Chamando OpenAI...");
    const respostaTexto = await chamarIAModeDev(texto);

    removerDigitando();
    adicionarMensagemUI(respostaTexto, "ia");

    // 3. Salva IA no Supabase
    console.log("💾 Salvando resposta da IA...");
    await supabase.from("chat_mensagens").insert({
      sessao_id: sessaoAtual,
      remetente: "ia",
      conteudo: respostaTexto,
    });
  } catch (erro) {
    console.error("❌ ERRO NO PROCESSO:", erro);
    removerDigitando();
    adicionarMensagemUI(`Erro: ${erro.message}`, "ia");
  }
};

async function chamarIAModeDev(mensagem) {
  // Busca a chave (tenta local, depois config global)
  const localKey =
    (window.LOCAL_CONFIG && window.LOCAL_CONFIG.OPENAI_API_KEY) ||
    (window.CONFIG && window.CONFIG.OPENAI_API_KEY);

  if (!localKey) {
    throw new Error("Chave API não configurada no config.local.js");
  }

  // Histórico para contexto
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
    content: "Você é o New Nerd, um tutor socrático. Use Markdown.",
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

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(`OpenAI: ${errData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function adicionarMensagemUI(texto, remetente) {
  const container = document.getElementById("mensagens");
  if (!container) return;

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

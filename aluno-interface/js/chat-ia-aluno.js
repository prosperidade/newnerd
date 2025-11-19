let user, sessaoAtual, supabase;

function initializeChat() {
  document.addEventListener("DOMContentLoaded", async () => {
    user = await verificarAuth();
    if (!user) return;

    supabase = window.supabaseClient;
    await iniciarSessao();

    document.getElementById("inputMsg").addEventListener("keypress", (e) => {
      if (e.key === "Enter") enviarMensagem();
    });
  });
}

document.addEventListener("configReady", initializeChat);

async function iniciarSessao() {
  // Buscar ou criar sessão ativa
  let { data: sessao } = await supabase
    .from("chat_sessoes")
    .select("*")
    .eq("usuario_id", user.id)
    .eq("ativa", true)
    .single();

  if (!sessao) {
    const { data } = await supabase
      .from("chat_sessoes")
      .insert({
        usuario_id: user.id,
        usuario_tipo: "aluno",
        contexto: { papel: "tutor_estudos" },
      })
      .select()
      .single();
    sessao = data;
  }

  sessaoAtual = sessao.id;
  await carregarHistorico();
}

async function carregarHistorico() {
  const { data } = await supabase
    .from("chat_mensagens")
    .select("*")
    .eq("sessao_id", sessaoAtual)
    .order("created_at", { ascending: true });

  const container = document.getElementById("mensagens");
  (data || []).forEach((msg) => {
    adicionarMensagemUI(msg.conteudo, msg.remetente);
  });
}

async function enviarMensagem() {
  const input = document.getElementById("inputMsg");
  const texto = input.value.trim();
  if (!texto) return;

  input.value = "";
  adicionarMensagemUI(texto, "usuario");

  // Salvar mensagem do usuário
  await supabase.from("chat_mensagens").insert({
    sessao_id: sessaoAtual,
    remetente: "usuario",
    conteudo: texto,
  });

  // Chamar IA
  mostrarDigitando();
  const resposta = await chamarIA(texto);
  removerDigitando();

  adicionarMensagemUI(resposta.texto, "ia");

  // Salvar resposta da IA
  await supabase.from("chat_mensagens").insert({
    sessao_id: sessaoAtual,
    remetente: "ia",
    conteudo: resposta.texto,
    tokens_usados: resposta.tokens || 0,
    custo_estimado: resposta.custo || 0,
  });
}

async function chamarIA(mensagem) {
  // Buscar histórico para contexto
  const { data: historico } = await supabase
    .from("chat_mensagens")
    .select("remetente, conteudo")
    .eq("sessao_id", sessaoAtual)
    .order("created_at", { ascending: true })
    .limit(10);

  const mensagens = (historico || []).map((h) => ({
    role: h.remetente === "usuario" ? "user" : "assistant",
    content: h.conteudo,
  }));

  mensagens.push({ role: "user", content: mensagem });

  // Chamar Edge Function
  const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/chat-ia`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      mensagens,
      contexto: "tutor_estudos_aluno",
    }),
  });

  return await response.json();
}

function adicionarMensagemUI(texto, remetente) {
  const container = document.getElementById("mensagens");
  const div = document.createElement("div");
  div.className = `msg ${remetente}`;
  div.textContent = texto;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function mostrarDigitando() {
  const container = document.getElementById("mensagens");
  const div = document.createElement("div");
  div.className = "msg ia digitando";
  div.innerHTML = "💭 Pensando...";
  div.id = "digitando";
  container.appendChild(div);
}

function removerDigitando() {
  document.getElementById("digitando")?.remove();
}

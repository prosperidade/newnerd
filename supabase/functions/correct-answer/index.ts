// supabase/functions/correct-answer/index.ts
// CORREÇÃO INTELIGENTE V5 (Híbrida + Contexto de Alternativas)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("Chave OpenAI não configurada.");

    // AGORA RECEBEMOS 'alternativas' e 'afirmacoes' TAMBÉM
    const {
      questao,
      resposta_aluno,
      gabarito_oficial,
      tipo,
      alternativas,
      afirmacoes,
    } = await req.json();

    if (!questao || !resposta_aluno) throw new Error("Dados incompletos.");

    const tipoNorm = (tipo || "").toLowerCase();
    const isObjetiva =
      tipoNorm.includes("multipla") ||
      tipoNorm.includes("verdadeiro") ||
      tipoNorm.includes("associacao");

    console.log(
      `📝 Corrigindo: ${tipo} (${isObjetiva ? "Objetiva" : "Discursiva"})`
    );

    let prompt = "";

    // Monta contexto extra se houver
    let contextoExtra = "";
    if (alternativas)
      contextoExtra += `\nOPÇÕES DISPONÍVEIS: ${JSON.stringify(alternativas)}`;
    if (afirmacoes)
      contextoExtra += `\nITENS V/F: ${JSON.stringify(afirmacoes)}`;

    // --- ESTRATÉGIA 1: OBJETIVAS ---
    if (isObjetiva) {
      prompt = `
          Você é um corretor de provas objetivas.
          
          DADOS:
          - Questão: "${questao}"
          - Gabarito Oficial: "${gabarito_oficial}"
          - Resposta do Aluno: "${resposta_aluno}"
          ${contextoExtra}
          
          TAREFA CRÍTICA:
          Verifique se a opção escolhida corresponde ao gabarito.
          - Se o aluno respondeu com o TEXTO da opção, veja nas "OPÇÕES DISPONÍVEIS" qual letra é. Se bater com o gabarito, é 10.
          - Se for V/F, compare a lógica.
          
          RETORNE JSON:
          {
            "nota": (10 se acertou, 0 se errou),
            "correta": (true ou false),
            "feedback": "Breve explicação.",
            "pontos_melhoria": "Dica rápida."
          }
        `;
    }

    // --- ESTRATÉGIA 2: DISCURSIVAS ---
    else {
      prompt = `
          Você é um professor corretor RIGOROSO.
          
          CONTEXTO:
          - Pergunta: "${questao}"
          - Gabarito: "${gabarito_oficial}"
          
          RESPOSTA DO ALUNO:
          "${resposta_aluno}"
          
          REGRAS DE NOTA ZERO (0):
          1. Respostas "teste", "ola", "não sei", "." = NOTA 0.
          2. Fuga total do tema = NOTA 0.
          
          TAREFA:
          Avalie de 0 a 10.
          
          RETORNE JSON:
          {
            "nota": (0 a 10),
            "correta": (true se nota >= 6),
            "feedback": "Explicação.",
            "pontos_melhoria": "O que faltou."
          }
        `;
    }

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.0, // Zero criatividade = Máxima precisão
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) throw new Error(`Erro OpenAI: ${await aiRes.text()}`);

    const aiData = await aiRes.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Erro Correção:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

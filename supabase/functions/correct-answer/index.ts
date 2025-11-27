// supabase/functions/correct-answer/index.ts
// CORREÇÃO INTELIGENTE V3 (Híbrida: Objetiva vs Discursiva)

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

    const { questao, resposta_aluno, gabarito_oficial, tipo } =
      await req.json();

    if (!questao || !resposta_aluno) throw new Error("Dados incompletos.");

    // Normaliza o tipo para evitar erros de digitação (ex: multipla_escolha vs Multipla Escolha)
    const tipoNorm = (tipo || "").toLowerCase();
    const isObjetiva =
      tipoNorm.includes("multipla") ||
      tipoNorm.includes("verdadeiro") ||
      tipoNorm.includes("associacao");

    console.log(
      `📝 Corrigindo: ${tipo} (${isObjetiva ? "Objetiva" : "Discursiva"})`
    );

    let prompt = "";

    // --- ESTRATÉGIA 1: QUESTÕES OBJETIVAS (Múltipla Escolha / VF) ---
    if (isObjetiva) {
      prompt = `
          Você é um corretor de provas objetivas.
          
          DADOS:
          - Questão: "${questao}"
          - Gabarito Oficial: "${gabarito_oficial}"
          - Resposta do Aluno: "${resposta_aluno}"
          
          TAREFA:
          Verifique se a opção escolhida pelo aluno corresponde ao gabarito.
          - Se o sentido for o mesmo (ex: Aluno escolheu "B" e Gabarito é "B) Texto"), considere CORRETO.
          - Se for Verdadeiro/Falso, verifique a lógica.
          
          RETORNE JSON:
          {
            "nota": (10 se acertou, 0 se errou),
            "correta": (true ou false),
            "feedback": "Breve explicação de por que está certo ou qual era a certa se errou.",
            "pontos_melhoria": "Tópico para revisar se errou, ou 'Parabéns' se acertou."
          }
        `;
    }

    // --- ESTRATÉGIA 2: QUESTÕES DISCURSIVAS (Rigoroso) ---
    else {
      prompt = `
          Você é um professor corretor RIGOROSO.
          
          CONTEXTO:
          - Pergunta: "${questao}"
          - Gabarito/Expectativa: "${gabarito_oficial}"
          
          RESPOSTA DO ALUNO:
          "${resposta_aluno}"
          
          REGRAS DE NOTA ZERO (0):
          1. Respostas como "teste", "ola", "não sei", "." = NOTA 0.
          2. Fuga total do tema = NOTA 0.
          
          TAREFA:
          Avalie a resposta de 0 a 10.
          
          RETORNE JSON:
          {
            "nota": (Número 0 a 10),
            "correta": (true se nota >= 6),
            "feedback": "Explicação do erro ou acerto.",
            "pontos_melhoria": "O que faltou na resposta."
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
        temperature: 0.1, // Baixa criatividade para ser preciso
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

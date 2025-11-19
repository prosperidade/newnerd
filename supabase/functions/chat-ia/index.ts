import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY")!;

serve(async (req) => {
  const { mensagens, contexto } = await req.json();

  const systemPrompt =
    contexto === "tutor_estudos_aluno"
      ? "Atue como um Tutor Socrático. Sua missão é guiar o aluno à resposta, nunca entregá-la diretamente. Use perguntas, analogias e exemplos para estimular o raciocínio. Seja paciente, encorajador e mantenha uma linguagem simples e acessível. Se o aluno estiver totalmente perdido, ofereça uma dica pequena ou uma forma diferente de pensar sobre o problema, mas sempre termine com uma pergunta que o faça pensar."
      : "Você é um assistente pedagógico para professores. Ajude com planejamento, sugestões de atividades e estratégias de ensino.";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...mensagens],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  const data = await response.json();

  return new Response(
    JSON.stringify({
      texto: data.choices[0].message.content,
      tokens: data.usage.total_tokens,
      custo: data.usage.total_tokens * 0.0000015,
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
});

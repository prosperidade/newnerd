// supabase/functions/chat-ia/index.ts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");

const FIXED_ALLOWED_ORIGINS = new Set<string>([
  // coloque aqui seus domínios de PRODUÇÃO quando tiver (https://app.seudominio.com, etc)
  // "https://app.seudominio.com",
]);

const DEV_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (FIXED_ALLOWED_ORIGINS.has(origin)) return true;
    // Em desenvolvimento, aceita qualquer porta para localhost/127.0.0.1
    if (DEV_HOSTS.has(u.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const allow = isAllowedOrigin(origin) ? origin! : "";

  // Ecoa os headers pedidos no preflight (essencial p/ evitar reprovação)
  const requested =
    req.headers.get("access-control-request-headers") ??
    "authorization,content-type,apikey,x-client-info";

  return {
    "Access-Control-Allow-Origin": allow, // precisa ser o origin exato quando há Authorization
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": requested,
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

serve(async (req) => {
  const headers = {
    "Content-Type": "application/json",
    ...buildCorsHeaders(req),
  };
  const origin = req.headers.get("origin");

  // Preflight
  if (req.method === "OPTIONS") {
    // Se a origem não for permitida, responde 204 sem CORS → o browser bloqueia
    if (!isAllowedOrigin(origin)) return new Response(null, { status: 204 });
    return new Response(null, { status: 200, headers });
  }

  // Método inválido
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers,
    });
  }

  // Origem não permitida
  if (!isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: "Origin não permitida" }), {
      status: 403,
      headers,
    });
  }

  try {
    if (!OPENAI_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não configurada" }),
        {
          status: 500,
          headers,
        }
      );
    }

    const { mensagens = [], contexto = {} } = await req.json();

    const systemPrompt =
      contexto?.papel === "tutor_estudos"
        ? "Atue como um Tutor Socrático. Sua missão é guiar o aluno à resposta, nunca entregá-la diretamente. Use perguntas, analogias e exemplos para estimular o raciocínio. Seja paciente e encorajador; se o aluno estiver perdido, ofereça uma dica pequena e termine com uma pergunta."
        : "Você é um assistente pedagógico para professores. Ajude com planejamento, atividades e estratégias de ensino.";

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
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

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`OpenAI: ${r.status} ${txt}`);
    }

    const data = await r.json();
    const texto = data?.choices?.[0]?.message?.content ?? "";
    const tokens = data?.usage?.total_tokens ?? 0;

    return new Response(JSON.stringify({ texto, tokens }), {
      status: 200,
      headers,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: String(error?.message ?? error) }),
      {
        status: 500,
        headers,
      }
    );
  }
});

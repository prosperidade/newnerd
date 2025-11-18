// @ts-nocheck
/// <reference lib="deno.ns" />
/// <reference lib="dom" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// =====================================================
// Edge Function: /embed - CORRIGIDA
// ✅ Validação robusta de embeddings
// ✅ Logs detalhados para debug
// ✅ Tratamento de erros melhorado
// =====================================================

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "text-embedding-3-small"; // 1536 dims

const ALLOWED_ORIGINS = new Set<string>([
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost",
  "*",
]);

function corsHeaders(origin: string | null) {
  const o =
    origin && (ALLOWED_ORIGINS.has("*") || ALLOWED_ORIGINS.has(origin))
      ? origin
      : "*";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-client-info, apikey",
    "Access-Control-Max-Age": "86400",
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  try {
    if (!OPENAI_API_KEY || !SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(
        JSON.stringify({
          error:
            "OPENAI_API_KEY / SUPABASE_URL / SERVICE_ROLE não configurados",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          },
        }
      );
    }

    const body = await req.json();
    console.log("📦 Body recebido:", JSON.stringify(body, null, 2));

    // Normaliza entrada
    const professor_id = body?.professor_id || body?.owner_id || null;
    const origem = body?.origem ?? body?.owner_type ?? "prof_biblioteca";
    const origem_id = body?.origem_id ?? body?.documento_id ?? null;

    let chunks: Array<{ texto: string; metadata?: any }> = [];

    if (Array.isArray(body?.chunks) && body.chunks.length > 0) {
      // Formato (A) - array de chunks
      chunks = body.chunks
        .map((c: any) => ({
          texto: String(c?.texto ?? "").slice(0, 12000),
          metadata: c?.metadata ?? {},
        }))
        .filter((c: any) => c.texto && c.texto.trim().length > 0);
    } else if (
      typeof body?.content === "string" &&
      body.content.trim().length > 0
    ) {
      // Formato (B) - texto único
      chunks = [
        {
          texto: String(body.content).slice(0, 12000),
          metadata: body?.metadata ?? {},
        },
      ];
    }

    console.log("📝 Chunks processados:", chunks.length);

    // 🔧 CORREÇÃO: Validação mais rigorosa
    if (!professor_id) {
      return new Response(
        JSON.stringify({
          error: "Campo obrigatório: professor_id",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          },
        }
      );
    }

    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Nenhum texto válido para gerar embeddings. Forneça chunks[] ou content.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          },
        }
      );
    }

    // 1) Gera embeddings
    console.log("🧠 Gerando embeddings para", chunks.length, "chunk(s)...");
    const inputs = chunks.map((c) => c.texto);

    const oai = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL, input: inputs }),
    });

    if (!oai.ok) {
      const details = await oai.text();
      console.error("❌ Erro OpenAI:", details);
      return new Response(JSON.stringify({ error: "Erro OpenAI", details }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const { data } = await oai.json();

    if (!data?.length) {
      console.error("❌ Nenhum embedding retornado pela OpenAI");
      return new Response(
        JSON.stringify({ error: "Nenhum embedding retornado" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          },
        }
      );
    }

    console.log("✅ Embeddings gerados:", data.length);
    console.log(
      "📊 Dimensões do primeiro embedding:",
      data[0].embedding.length
    );

    // 🔧 CORREÇÃO: Validação do embedding
    for (let i = 0; i < data.length; i++) {
      if (!data[i].embedding || !Array.isArray(data[i].embedding)) {
        console.error("❌ Embedding inválido no índice", i);
        return new Response(
          JSON.stringify({ error: `Embedding inválido no índice ${i}` }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders(origin),
            },
          }
        );
      }
    }

    // 2) Prepara linhas para insert
    const rows = chunks.map((c, i) => ({
      professor_id,
      origem,
      origem_id,
      chunk_texto: c.texto,
      embedding: data[i].embedding, // pgvector aceita array direto
      metadata: {
        ...c.metadata,
        embedding_model: MODEL,
        embedding_dims: data[i].embedding.length,
        generated_at: new Date().toISOString(),
      },
    }));

    console.log("💾 Inserindo", rows.length, "linha(s) no Supabase...");

    // 3) Insert no Supabase
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/professor_embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(rows),
    });

    if (!resp.ok) {
      const details = await resp.text();
      console.error("❌ Erro Supabase:", details);
      return new Response(JSON.stringify({ error: "Erro Supabase", details }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const inserted = await resp.json();
    console.log("✅ Linhas inseridas:", inserted?.length ?? 0);

    // 🔧 CORREÇÃO: Retorna IDs dos embeddings criados
    return new Response(
      JSON.stringify({
        ok: true,
        count: inserted?.length ?? 0,
        embeddings_ids: inserted?.map((row: any) => row.id) ?? [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      }
    );
  } catch (e) {
    console.error("❌ Erro geral:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
});

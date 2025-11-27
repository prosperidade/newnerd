// supabase/functions/semantic-search/index.ts
// BUSCA SEMÂNTICA HÍBRIDA V5 (Aluno & Professor)

// deno-lint-ignore-file
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE");

    if (!SUPABASE_URL || !SERVICE_ROLE || !GOOGLE_API_KEY)
      throw new Error("Chaves ausentes.");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Ler Dados (Incluindo flag is_student)
    const {
      query,
      professor_id,
      student_id,
      is_student,
      match_count,
      match_threshold,
    } = await req.json();

    if (!query) throw new Error("Query vazia.");

    // Define ID do usuário atual
    const userId = is_student ? student_id : professor_id;
    console.log(
      `🔍 Buscando (${is_student ? "ALUNO" : "PROFESSOR"}): "${query}"`
    );

    // 2. Embedding da Pergunta (Google Gemini)
    const googleRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: query }] },
        }),
      }
    );

    if (!googleRes.ok)
      throw new Error(`Erro Google: ${await googleRes.text()}`);
    const googleData = await googleRes.json();
    const queryEmbedding = googleData.embedding?.values;
    if (!queryEmbedding) throw new Error("Vetor não gerado.");

    // 3. ROTEAMENTO DE BUSCA (Aluno ou Professor?)
    let rpcName = "";
    let rpcParams: any = {
      query_embedding: queryEmbedding,
      match_threshold: match_threshold || 0.3,
      match_count: match_count || 10,
    };

    if (is_student) {
      rpcName = "match_aluno_embeddings"; // Função SQL do Aluno
      rpcParams.p_aluno_id = userId; // Filtro de aluno
    } else {
      rpcName = "match_embeddings"; // Função SQL do Professor
      // A função original do professor não filtrava ID, filtrava no JS,
      // mas aqui mantemos o padrão original.
    }

    const { data: results, error: rpcError } = await supabase.rpc(
      rpcName,
      rpcParams
    );

    if (rpcError) throw new Error(`Erro RPC (${rpcName}): ${rpcError.message}`);

    console.log(`✅ Resultados: ${results?.length || 0}`);

    return new Response(JSON.stringify({ results: results || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("❌ Erro:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

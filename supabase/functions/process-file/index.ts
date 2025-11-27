// supabase/functions/process-file/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log("🚀 Function process-file started!");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const googleKey = Deno.env.get("GOOGLE_API_KEY");

    if (!supabaseUrl || !supabaseKey || !googleKey) {
      throw new Error(
        "Missing SUPABASE_URL / SERVICE_ROLE_KEY / GOOGLE_API_KEY"
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const bodyText = await req.text();
    if (!bodyText) throw new Error("Empty request body.");

    const { document_id, table_name, bucket_name } = JSON.parse(bodyText);
    if (!document_id || !table_name || !bucket_name) {
      throw new Error(
        "Missing required fields: document_id, table_name, bucket_name"
      );
    }

    console.log(
      `📄 Processing Doc ${document_id} @ ${table_name}/${bucket_name}`
    );

    // 1) Documento
    const { data: doc, error: dbErr } = await supabase
      .from(table_name)
      .select("*")
      .eq("id", document_id)
      .single();
    if (dbErr || !doc) throw new Error(`Document not found: ${dbErr?.message}`);

    const path = doc.caminho || doc.caminho_arquivo || doc.path || null;

    if (!path) throw new Error("File path missing in database record.");

    // 2) Download
    const { data: fileData, error: dlErr } = await supabase.storage
      .from(bucket_name)
      .download(path);
    if (dlErr) throw new Error(`Storage download error: ${dlErr.message}`);

    // 3) Extração simples (texto puro)
    const textContent = await fileData.text();
    const cleanText = textContent.slice(0, 8000).replace(/\s+/g, " ").trim();

    if (cleanText.length < 10) {
      console.log("⚠️ Text too short. Marking ready/ignored.");
      const updates: Record<string, unknown> = {};
      // em professor marcamos status: ready
      if (table_name === "arquivos_professor") {
        updates.status = "ready";
      }
      // em tabelas de aluno você poderia ter status_processamento
      // if (table_name === "arquivos_aluno") { updates.status_processamento = "ignored"; }
      await supabase.from(table_name).update(updates).eq("id", document_id);
      return new Response(
        JSON.stringify({ success: true, message: "Ignored (short text)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) Embedding com Google
    console.log("🧠 Calling Google (text-embedding-004)...");
    const embeddingResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: cleanText }] },
        }),
      }
    );
    if (!embeddingResp.ok) {
      const errTxt = await embeddingResp.text();
      throw new Error(`Google API Error: ${errTxt}`);
    }
    const embeddingData = await embeddingResp.json();
    const vector = embeddingData.embedding.values; // 768 dims

    // 5) Atualiza a linha (apenas colunas que existem em arquivos_professor)
    const updates: Record<string, unknown> = {
      embedding: vector,
      texto_extraido: cleanText,
    };
    if (table_name === "arquivos_professor") {
      updates.status = "ready";
    }
    await supabase.from(table_name).update(updates).eq("id", document_id);

    console.log("✅ process-file OK");
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("❌ process-file ERROR:", err?.message || err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

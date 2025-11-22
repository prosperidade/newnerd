// supabase/functions/process-file/index.ts (or embed/index.ts)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log("🚀 Function process-file (Google Gemini) started!");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
        "Missing environment variables (SUPABASE_URL, SERVICE_ROLE_KEY, GOOGLE_API_KEY)."
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

    console.log(`📄 Processing Doc ID: ${document_id} in ${table_name}`);

    // 1. Get Document Metadata
    const { data: doc, error: dbErr } = await supabase
      .from(table_name)
      .select("*")
      .eq("id", document_id)
      .single();

    if (dbErr || !doc) throw new Error(`Document not found: ${dbErr?.message}`);

    const path = doc.caminho_arquivo || doc.caminho;
    if (!path) throw new Error("File path missing in database record.");

    // 2. Download File
    const { data: fileData, error: dlErr } = await supabase.storage
      .from(bucket_name)
      .download(path);

    if (dlErr) throw new Error(`Storage download error: ${dlErr.message}`);

    // 3. Extract Text (Simple extraction for now)
    const textContent = await fileData.text();
    // Limit to 8000 chars to be safe with limits, remove extra spaces
    const cleanText = textContent.slice(0, 8000).replace(/\s+/g, " ").trim();

    if (cleanText.length < 10) {
      console.log("⚠️ Text too short. Skipping embedding.");
      await supabase
        .from(table_name)
        .update({
          status_processamento: "ignored", // Aluno
          status: "ready", // Professor
        })
        .eq("id", document_id);

      return new Response(
        JSON.stringify({ success: true, message: "Ignored (short text)" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Generate Embedding (Google Gemini)
    console.log("🧠 Calling Google Gemini API...");
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
    const vector = embeddingData.embedding.values; // 768 dimensions

    // 5. Save to Database
    console.log("💾 Saving vector...");
    const updateData = {
      embedding: vector,
      texto_extraido: cleanText,
      status_processamento: "completed", // Aluno status
      status: "ready", // Professor status
    };

    const { error: updateErr } = await supabase
      .from(table_name)
      .update(updateData)
      .eq("id", document_id);

    if (updateErr)
      throw new Error(`Database update error: ${updateErr.message}`);

    console.log("✅ Success!");
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const msg = err.message || String(err);
    console.error("❌ FATAL ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

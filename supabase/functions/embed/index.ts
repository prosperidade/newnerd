// supabase/functions/embed/index.ts
// PROCESSADOR HÍBRIDO (Aceita PDF para baixar OU Texto pronto)

// deno-lint-ignore-file
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import pdf from "npm:pdf-parse@1.1.1";
import { Buffer } from "node:buffer";

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

    // 1. Receber Payload (Agora aceita 'text' opcional)
    const { record, text: manualText } = await req.json();

    if (!record || !record.name) {
      return new Response(JSON.stringify({ message: "Sem nome de arquivo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`📄 Processando: ${record.name}`);

    let textToEmbed = "";

    // 2. DECISÃO: Usar texto enviado OU baixar PDF?
    if (manualText && manualText.length > 0) {
      console.log("📝 Usando texto enviado pelo Frontend (Word/Txt)...");
      textToEmbed = manualText;
    } else if (record.name.toLowerCase().endsWith(".pdf")) {
      console.log("📥 Baixando PDF para extração...");
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("newnerd_professores")
        .download(record.name);

      if (downloadError)
        throw new Error(`Erro download: ${downloadError.message}`);

      try {
        const arrayBuffer = await fileData.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);
        const pdfData = await pdf(pdfBuffer);
        textToEmbed = pdfData.text;
      } catch (e: any) {
        throw new Error(`Erro parsing PDF: ${e.message}`);
      }
    } else {
      // Se não é PDF e não mandou texto
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "Formato não suportado pelo servidor (e sem texto enviado)",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Limpeza e Corte
    textToEmbed = textToEmbed.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    const textChunk = textToEmbed.substring(0, 8000);

    if (!textChunk || textChunk.length < 5)
      throw new Error("Texto vazio ou insuficiente.");

    // 4. Embedding (Google)
    console.log("🤖 Gerando embedding...");
    const googleRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: textChunk }] },
        }),
      }
    );

    if (!googleRes.ok) {
      const txt = await googleRes.text();
      throw new Error(`Erro Google (${googleRes.status}): ${txt}`);
    }

    const googleData = await googleRes.json();
    const embedding = googleData.embedding?.values;

    if (!embedding) throw new Error("Google não retornou vetor.");

    // 5. Salvar
    console.log("💾 Salvando...");
    const { error: rpcError } = await supabase.rpc(
      "insert_professor_embedding",
      {
        p_professor_id: record.owner || record.professor_id,
        p_documento_path: record.name,
        p_chunk_texto: textChunk,
        p_metadata: { titulo: record.name },
        p_embedding: embedding,
      }
    );

    if (rpcError) {
      const { error: updateError } = await supabase
        .from("arquivos_professor")
        .update({ texto_extraido: textChunk, embedding: embedding })
        .eq("caminho", record.name);
      if (updateError)
        throw new Error(`Erro update DB: ${updateError.message}`);
    }

    console.log("✅ Sucesso!");
    return new Response(JSON.stringify({ success: true }), {
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

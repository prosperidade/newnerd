// supabase/functions/embed/index.ts
// PROCESSADOR HÍBRIDO V7 (Suporte Total: Aluno & Professor + Upload Direto de Texto)

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

    // 1. Receber Payload
    const { record, text: manualText } = await req.json();

    if (!record || !record.name) {
      return new Response(JSON.stringify({ message: "Sem nome de arquivo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- ROTEAMENTO INTELIGENTE (ALUNO vs PROFESSOR) ---
    const isStudent = !!record.is_student; // Flag enviada pelo JS do aluno
    const ownerId = record.owner || record.aluno_id || record.professor_id;
    const bucketName = isStudent ? "alunos-biblioteca" : "newnerd_professores";

    console.log(
      `📄 Processando (${isStudent ? "ALUNO" : "PROFESSOR"}): ${record.name}`
    );

    let textToEmbed = "";

    // 2. Obter Texto (Manual ou Download PDF)
    if (manualText && manualText.length > 0) {
      console.log("📝 Texto recebido diretamente...");
      textToEmbed = manualText;
    } else if (record.name.toLowerCase().endsWith(".pdf")) {
      console.log(`📥 Baixando PDF do bucket ${bucketName}...`);

      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(record.name);

      if (downloadError)
        throw new Error(
          `Erro download (${bucketName}): ${downloadError.message}`
        );

      try {
        const arrayBuffer = await fileData.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);
        const pdfData = await pdf(pdfBuffer);
        textToEmbed = pdfData.text;
      } catch (e: any) {
        throw new Error(`Erro parsing PDF: ${e.message}`);
      }
    } else {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "Formato requer texto manual",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Limpeza
    textToEmbed = textToEmbed.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    const textChunk = textToEmbed.substring(0, 8000);

    if (!textChunk || textChunk.length < 5) throw new Error("Texto vazio.");

    // 4. Embedding (Google)
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

    if (!googleRes.ok)
      throw new Error(`Erro Google: ${await googleRes.text()}`);
    const googleData = await googleRes.json();
    const embedding = googleData.embedding?.values;
    if (!embedding) throw new Error("Vetor não gerado.");

    // 5. Salvar no Banco (ROTEAMENTO DE RPC)
    console.log("💾 Salvando no banco...");

    let rpcError;

    if (isStudent) {
      // --- FLUXO ALUNO ---
      const result = await supabase.rpc("insert_aluno_embedding", {
        p_aluno_id: ownerId,
        p_documento_path: record.name,
        p_chunk_texto: textChunk,
        p_metadata: { titulo: record.name },
        p_embedding: embedding,
      });
      rpcError = result.error;
    } else {
      // --- FLUXO PROFESSOR ---
      const result = await supabase.rpc("insert_professor_embedding", {
        p_professor_id: ownerId,
        p_documento_path: record.name,
        p_chunk_texto: textChunk,
        p_metadata: { titulo: record.name },
        p_embedding: embedding,
      });
      rpcError = result.error;
    }

    if (rpcError) throw new Error(`Erro RPC: ${rpcError.message}`);

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

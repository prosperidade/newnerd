// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE");

if (!OPENAI_API_KEY || !SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("Faltando variáveis de ambiente essenciais.");
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, x-client-info, apikey",
    "Access-Control-Max-Age": "86400",
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS")
    return new Response("ok", { status: 200, headers: corsHeaders(origin) });

  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });

  try {
    const body = await req.json();
    const tipo = (
      body.tipo_questao ||
      body.tipo ||
      "multipla_escolha"
    ).toLowerCase();
    const tema = body.tema || body.mensagem || "";
    const disciplina = body.disciplina || "geral";
    const serie = body.serie || "auto";
    const dificuldade = body.dificuldade || "média";
    const professor_id = body.professor_id || null;
    const quantidade = body.quantidade ?? 1;

    if (!tema)
      return new Response(
        JSON.stringify({ error: "Campo obrigatório: tema" }),
        {
          status: 400,
          headers: corsHeaders(origin),
        }
      );

    const seed = body.seed || Math.floor(Math.random() * 1e9);
    const variacao = body.variacao || crypto.randomUUID().slice(0, 8);

    const estilos = [
      "formule a questão em um cenário cotidiano",
      "use linguagem prática e objetiva",
      "contextualize com uma situação real",
      "inicie com uma pergunta reflexiva",
      "aborde de forma interdisciplinar",
      "apresente dados ou exemplos numéricos",
      "utilize um problema de aplicação",
      "varie o tempo verbal da instrução",
      "use analogias para ilustrar o conceito",
      "reformule o enunciado com estrutura indireta",
    ];

    const estilo = estilos[seed % estilos.length];
    const prefixoVariacao = "Variação " + variacao + " | Estilo: " + estilo;

    let promptEspecifico = "";

    if (tipo === "discursiva") {
      promptEspecifico =
        "IMPORTANTE para questões discursivas:\n" +
        "1. Gere um enunciado claro e contextualizado\n" +
        "2. Gere uma resposta_esperada COMPLETA com 3-5 parágrafos que sirva como modelo de resposta\n" +
        "3. Gere critérios de avaliação detalhados\n\n" +
        "Formato JSON OBRIGATÓRIO:\n" +
        "{\n" +
        '  "enunciado": "texto da questão",\n' +
        '  "resposta_esperada": "RESPOSTA MODELO COMPLETA EM 3-5 PARÁGRAFOS. Deve ser um exemplo real de uma boa resposta que aborda todos os aspectos solicitados no enunciado, com argumentação completa, exemplos concretos e conclusão.",\n' +
        '  "criterios_avaliacao": [\n' +
        '    {"aspecto": "Compreensão", "descricao": "Domínio do conteúdo", "peso": 40},\n' +
        '    {"aspecto": "Argumentação", "descricao": "Coerência e clareza", "peso": 30},\n' +
        '    {"aspecto": "Exemplos", "descricao": "Aplicações práticas", "peso": 30}\n' +
        "  ],\n" +
        '  "tipo_questao": "discursiva",\n' +
        '  "disciplina": "' +
        disciplina +
        '",\n' +
        '  "serie": "' +
        serie +
        '",\n' +
        '  "dificuldade": "' +
        dificuldade +
        '"\n' +
        "}";
    } else if (tipo === "multipla_escolha") {
      promptEspecifico =
        "Formato JSON OBRIGATÓRIO para múltipla escolha:\n" +
        "{\n" +
        '  "enunciado": "texto da questão",\n' +
        '  "alternativas": [\n' +
        '    {"letra": "A", "texto": "..."},\n' +
        '    {"letra": "B", "texto": "..."},\n' +
        '    {"letra": "C", "texto": "..."},\n' +
        '    {"letra": "D", "texto": "..."}\n' +
        "  ],\n" +
        '  "gabarito": "A",\n' +
        '  "justificativa_gabarito": "Explicação detalhada de por que A é a resposta correta",\n' +
        '  "tipo_questao": "multipla_escolha",\n' +
        '  "disciplina": "' +
        disciplina +
        '",\n' +
        '  "serie": "' +
        serie +
        '",\n' +
        '  "dificuldade": "' +
        dificuldade +
        '"\n' +
        "}";
    } else if (tipo === "verdadeiro_falso") {
      promptEspecifico =
        "Formato JSON OBRIGATÓRIO para verdadeiro/falso:\n" +
        "{\n" +
        '  "enunciado": "Analise as afirmações abaixo:",\n' +
        '  "afirmacoes": [\n' +
        '    {"texto": "Afirmação 1", "valor": true},\n' +
        '    {"texto": "Afirmação 2", "valor": false},\n' +
        '    {"texto": "Afirmação 3", "valor": true}\n' +
        "  ],\n" +
        '  "tipo_questao": "verdadeiro_falso",\n' +
        '  "disciplina": "' +
        disciplina +
        '",\n' +
        '  "serie": "' +
        serie +
        '",\n' +
        '  "dificuldade": "' +
        dificuldade +
        '"\n' +
        "}";
    }

    const prompt =
      prefixoVariacao +
      "\n\n" +
      "Você é um gerador de questões didáticas originais para professores.\n" +
      "Retorne somente JSON válido, sem markdown, sem backticks.\n\n" +
      "Gere " +
      quantidade +
      " " +
      (quantidade > 1 ? "questões" : "questão") +
      ' do tipo "' +
      tipo +
      '" sobre o tema "' +
      tema +
      '".\n' +
      "Disciplina: " +
      disciplina +
      ", Série: " +
      serie +
      ", Dificuldade: " +
      dificuldade +
      ".\n\n" +
      promptEspecifico +
      "\n\n" +
      "REGRAS CRÍTICAS:\n" +
      "- Se tipo for discursiva, a resposta_esperada DEVE ter 3-5 parágrafos COMPLETOS\n" +
      '- NUNCA use apenas "Texto coeso com 3-5 parágrafos" - isso é inválido\n' +
      "- A resposta_esperada deve ser um EXEMPLO REAL de uma boa resposta\n" +
      "- Retorne apenas JSON válido, sem markdown\n" +
      "- Para " +
      (quantidade > 1
        ? "múltiplas questões, retorne array"
        : "uma questão, retorne objeto");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.65,
        top_p: 0.9,
        frequency_penalty: 0.2,
        presence_penalty: 0.15,
        messages: [
          {
            role: "system",
            content:
              "Você é um gerador de questões educacionais. Retorne apenas JSON válido. Para questões discursivas, SEMPRE gere uma resposta_esperada completa em 3-5 parágrafos, NUNCA use texto genérico como Texto coeso.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: "Erro OpenAI", err }), {
        status: 502,
        headers: corsHeaders(origin),
      });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";
    let questoes = [];
    try {
      const parsed = JSON.parse(text);
      questoes = Array.isArray(parsed)
        ? parsed
        : parsed.questoes
        ? parsed.questoes
        : [parsed];
    } catch {
      return new Response(
        JSON.stringify({ error: "Resposta inválida", raw: text }),
        {
          status: 500,
          headers: corsHeaders(origin),
        }
      );
    }

    const tokens_usados = data.usage?.total_tokens || 0;
    const custo_estimado = tokens_usados * 0.0000015;

    questoes = questoes.map((q) => ({
      ...q,
      tokens_usados,
      custo_estimado,
      api_usada: "openai",
    }));

    if (professor_id) {
      console.log(
        "Salvando " + questoes.length + " questão(ões) no Supabase..."
      );

      const rowsQuestoes = questoes.map((q) => ({
        id: crypto.randomUUID(),
        professor_id,
        enunciado: q.enunciado,
        tipo_questao: q.tipo_questao || tipo,
        disciplina: q.disciplina || disciplina,
        serie: q.serie || serie,
        dificuldade: q.dificuldade || dificuldade,
        alternativas: q.alternativas || null,
        resposta_esperada: q.resposta_esperada || null,
        afirmacoes: q.afirmacoes || null,
        coluna_a: q.coluna_a || null,
        coluna_b: q.coluna_b || null,
        criterios_avaliacao: q.criterios_avaliacao || null,
        gabarito: q.gabarito || null,
        justificativa_gabarito: q.justificativa_gabarito || null,
        api_usada: "openai",
        tokens_usados,
        custo_estimado,
        created_at: new Date().toISOString(),
      }));

      const insertQuestoes = fetch(SUPABASE_URL + "/rest/v1/questoes_geradas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SERVICE_ROLE,
          Authorization: "Bearer " + SERVICE_ROLE,
          Prefer: "return=representation",
        },
        body: JSON.stringify(rowsQuestoes),
      });

      const insertEmbeddings = fetch(
        SUPABASE_URL + "/rest/v1/professor_embeddings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SERVICE_ROLE,
            Authorization: "Bearer " + SERVICE_ROLE,
            Prefer: "return=representation",
          },
          body: JSON.stringify(
            rowsQuestoes.map((r) => ({
              professor_id: r.professor_id,
              origem: "questoes_geradas",
              origem_id: r.id,
              chunk_texto: r.enunciado,
              embedding: null,
              metadata: {
                tipo_questao: r.tipo_questao,
                disciplina: r.disciplina,
                serie: r.serie,
                dificuldade: r.dificuldade,
              },
            }))
          ),
        }
      );

      const [resQuestoes, resEmbeddings] = await Promise.all([
        insertQuestoes,
        insertEmbeddings,
      ]);

      console.log("Salvamento concluído:", {
        questoes_status: resQuestoes.status,
        embeddings_status: resEmbeddings.status,
      });
    } else {
      console.warn("Nenhum professor_id informado, salvamento ignorado.");
    }

    return new Response(JSON.stringify({ questoes }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (e) {
    console.error("ERRO NA FUNÇÃO:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
});

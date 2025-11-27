// deno-lint-ignore-file no-explicit-any
// Edge Function: generate-question (anti-repetição de aberturas)
// - Variedade forte de enunciados (ban de chavões + reescrita pós-processamento)
// - Formatos ME / Discursiva / V/F / Associação
// - OBJETO quando quantidade=1 e ARRAY quando >1 (em { questoes })
// - Compatível com legado (V/F: correta->valor; Associação: id->numero/letra)
// - Dedup por enunciado; reescrita de enunciados repetidos/banidos
// - Mantém campos (tokens_usados, custo_estimado, api_usada, created_at)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE");

if (!OPENAI_API_KEY || !SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("Faltando variáveis de ambiente essenciais.");
}

const _supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

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

/** Utils de diversidade **/
const BANNED_OPENINGS = [
  "durante uma aula",
  "em uma aula",
  "durante a aula",
  "em sala de aula",
  "no contexto de",
  "imagine que",
  "considere o seguinte",
  "pense que",
  "suponha que",
].map((s) => s.toLowerCase());

function firstWords(s: string, k = 6) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .slice(0, k)
    .join(" ")
    .toLowerCase();
}

function hasBannedOpening(s: string) {
  const low = String(s || "")
    .trim()
    .toLowerCase();
  return BANNED_OPENINGS.some((b) => low.startsWith(b));
}

/** Chamada OpenAI genérica */
async function callOpenAI(messages: any[], opts: Partial<any> = {}) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + OPENAI_API_KEY,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.6,
      top_p: 0.9,
      ...opts,
      messages,
    }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/** Reescreve enunciados repetidos ou com abertura banida */
async function rewriteEnunciados(enunciados: string[], tema: string) {
  // Formato E/S: lista de strings → lista de strings
  const prompt = {
    role: "user",
    content: JSON.stringify({
      instrucoes:
        "Reescreva cada enunciado mantendo o mesmo sentido e nível, sem chavões, sem começar com 'Durante uma aula', 'Em uma aula', 'No contexto de', 'Imagine que', 'Considere o seguinte', etc. Use linguagem natural e contextual do cotidiano brasileiro. Cada enunciado deve ter no máximo ~3 linhas. Retorne um array de strings, MESMA ordem de entrada.",
      tema,
      enunciados,
    }),
  };
  const sys = {
    role: "system",
    content:
      "Você reescreve enunciados evitando repetições de abertura. Responda SOMENTE com JSON de um array de strings.",
  };
  const text = await callOpenAI([sys, prompt], {
    response_format: { type: "json_object" as const },
    temperature: 0.7,
    presence_penalty: 0.4,
    frequency_penalty: 0.6,
  });
  let out: any;
  try {
    out = JSON.parse(text);
  } catch {
    // fallback: se vier plano, tenta parsear como array
    try {
      out = JSON.parse(text.trim());
    } catch {
      // última tentativa: devolve os originais
      return enunciados;
    }
  }
  const arr = Array.isArray(out) ? out : out.enunciados || out.result || [];
  return Array.isArray(arr) && arr.length === enunciados.length
    ? arr
    : enunciados;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  try {
    const body = await req.json();

    const tipo = String(
      (body.tipo_questao || body.tipo || "multipla_escolha") as string
    ).toLowerCase();
    const tema: string = body.tema || body.mensagem || "";
    const disciplina: string = body.disciplina || "detectar";
    const serie: string = body.serie || "auto";
    const dificuldade: string = body.dificuldade || "média";
    const professor_id: string | null = body.professor_id || null;
    const quantidade: number = Number(body.quantidade ?? 1);

    if (!tema) {
      return new Response(
        JSON.stringify({ error: "Campo obrigatório: tema" }),
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    // ===========================
    // PROMPTS — Cabeçalho comum
    // ===========================
    const cabecalho = `
Você é um especialista em educação do Ensino Básico no Brasil.
Responda SOMENTE com JSON válido (sem markdown, sem comentários, sem texto fora do JSON).

QUALIDADE E DIVERSIDADE (OBRIGATÓRIAS):
- VARIE o começo dos enunciados. NÃO use chavões.
- EVITE aberturas banidas: "Durante uma aula", "Em uma aula", "No contexto de", "Imagine que", "Considere o seguinte", "Pense que", "Suponha que".
- Enunciados contextualizados e objetivos, até ~3 linhas.
- Não reutilize trechos grandes (≤ 8 palavras repetidas).
- Varie cenários, nomes, números e datas entre as questões.
- Linguagem alinhada à série indicada.
- Se quantidade = 1 → OBJETO; se quantidade > 1 → ARRAY.
`.trim();

    // ===========================
    // PROMPTS — Por tipo
    // ===========================
    const promptME = `
Crie questão(ões) de MÚLTIPLA ESCOLHA sobre o tema "${tema}" na disciplina "${disciplina}" (ou detectar).
Série: ${serie}. Dificuldade: ${dificuldade}.

Requisitos:
- Enunciado contextualizado (2–3 frases curtas, até ~3 linhas), com começo variado e natural (sem chavões).
- 5 alternativas (A–E), plausíveis, apenas UMA correta.
- Justificativa explica por que a correta é correta e as demais não.

Modelo de JSON por questão:
{
  "enunciado": "texto do enunciado (até ~3 linhas, contextualizado, sem chavões)",
  "alternativas": [
    {"letra": "A", "texto": "opção A"},
    {"letra": "B", "texto": "opção B"},
    {"letra": "C", "texto": "opção C"},
    {"letra": "D", "texto": "opção D"},
    {"letra": "E", "texto": "opção E"}
  ],
  "gabarito": "A|B|C|D|E",
  "justificativa_gabarito": "explicação objetiva, 3–6 frases",
  "tipo_questao": "multipla_escolha",
  "disciplina": "${disciplina}",
  "serie": "${serie}",
  "dificuldade": "${dificuldade}"
}`.trim();

    const promptDISC = `
Crie questão(ões) DISCURSIVA(S) sobre o tema "${tema}" na disciplina "${disciplina}" (ou detectar).
Série: ${serie}. Dificuldade: ${dificuldade}.

Requisitos:
- Enunciado pede análise/reflexão aplicada (evitar “Explique o que é …”), começo variado (sem chavões).
- "resposta_esperada": 3–5 parágrafos coesos e objetivos.

Modelo de JSON por questão:
{
  "enunciado": "pergunta contextualizada e específica (até ~3 linhas, sem chavões)",
  "resposta_esperada": "3–5 parágrafos coesos, com exemplos/aplicações quando fizer sentido",
  "criterios_avaliacao": [
    {"aspecto":"Compreensão","descricao":"Domina conceitos centrais","peso":40},
    {"aspecto":"Argumentação","descricao":"Argumentos consistentes e organizados","peso":30},
    {"aspecto":"Exemplos","descricao":"Exemplos/aplicações relevantes","peso":30}
  ],
  "tipo_questao": "discursiva",
  "disciplina": "${disciplina}",
  "serie": "${serie}",
  "dificuldade": "${dificuldade}"
}`.trim();

    const promptVF = `
Crie questão(ões) de VERDADEIRO/FALSO sobre "${tema}" na disciplina "${disciplina}" (ou detectar).
Série: ${serie}. Dificuldade: ${dificuldade}.

Requisitos:
- Enunciado contextualizado (sem chavões; começo variado).
- Exatamente 5 afirmações, claras e não triviais, misturando verdadeiras e falsas.
- "justificativa_gabarito": 3–6 frases em texto corrido (sem listar 1..5), explicando os porquês.

Modelo de JSON por questão:
{
  "enunciado": "frase contextualizada (até ~3 linhas) solicitando julgar 5 afirmações, sem chavões",
  "afirmacoes": [
    {"texto": "afirmação 1", "valor": true},
    {"texto": "afirmação 2", "valor": false},
    {"texto": "afirmação 3", "valor": true},
    {"texto": "afirmação 4", "valor": false},
    {"texto": "afirmação 5", "valor": true}
  ],
  "justificativa_gabarito": "3–6 frases explicando os porquês",
  "tipo_questao": "verdadeiro_falso",
  "disciplina": "${disciplina}",
  "serie": "${serie}",
  "dificuldade": "${dificuldade}"
}`.trim();

    const promptASSOC = `
Crie questão(ões) de ASSOCIAÇÃO sobre "${tema}" na disciplina "${disciplina}" (ou detectar).
Série: ${serie}. Dificuldade: ${dificuldade}.

Requisitos:
- Enunciado contextualizado (sem chavões), começo variado.
- Coluna A: 4 itens numerados (1–4) do mesmo tipo.
- Coluna B: 4 descrições com letras (A–D), claras e não ambíguas.
- "gabarito": estilo "1-A, 2-C, 3-B, 4-D".
- "justificativa_gabarito": 2–4 frases resumindo a lógica das associações.

Modelo de JSON por questão:
{
  "enunciado": "instrução contextualizada (até ~3 linhas, sem chavões)",
  "coluna_a": [
    {"numero":1, "texto":"item A1"},
    {"numero":2, "texto":"item A2"},
    {"numero":3, "texto":"item A3"},
    {"numero":4, "texto":"item A4"}
  ],
  "coluna_b": [
    {"letra":"A", "texto":"descrição B-A"},
    {"letra":"B", "texto":"descrição B-B"},
    {"letra":"C", "texto":"descrição B-C"},
    {"letra":"D", "texto":"descrição B-D"}
  ],
  "gabarito": "1-A, 2-C, 3-B, 4-D",
  "justificativa_gabarito": "2–4 frases explicando o critério geral",
  "tipo_questao": "associacao",
  "disciplina": "${disciplina}",
  "serie": "${serie}",
  "dificuldade": "${dificuldade}"
}`.trim();

    const blocoTipo = (t: string) => {
      if (t === "associacao") return promptASSOC;
      if (t === "verdadeiro_falso") return promptVF;
      if (t === "discursiva") return promptDISC;
      return promptME;
    };

    const prompt = `
${cabecalho}

QUANTIDADE SOLICITADA: ${quantidade}
TIPO: ${tipo}
TEMA: "${tema}"
DISCIPLINA: ${disciplina}
SÉRIE: ${serie}
DIFICULDADE: ${dificuldade}

${blocoTipo(tipo)}
`.trim();

    // ===========================
    // Chamada OpenAI (1ª passada)
    // ===========================
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature:
          tipo === "associacao"
            ? 0.5
            : tipo === "verdadeiro_falso"
            ? 0.55
            : tipo === "discursiva"
            ? 0.7
            : 0.65,
        top_p: 0.9,
        frequency_penalty: 0.6, // reforça antirrepetição
        presence_penalty: 0.35,
        messages: [
          {
            role: "system",
            content:
              "Você gera questões didáticas ORIGINAIS para professores do Ensino Básico. Retorne SOMENTE JSON válido, sem markdown e sem texto extra.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        stop: ["```", "</json>"],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "";

    // Parse seguro
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("Erro ao ler JSON da IA: " + text);
    }

    // Ajuste formato conforme "quantidade"
    let questoesRaw: any[] = [];
    if (quantidade > 1) {
      questoesRaw = Array.isArray(parsed) ? parsed : parsed.questoes ?? [];
      if (!Array.isArray(questoesRaw)) {
        throw new Error("Esperado ARRAY quando quantidade > 1.");
      }
    } else {
      const obj = Array.isArray(parsed) ? parsed[0] : parsed.questoes ?? parsed;
      if (!obj || typeof obj !== "object") {
        throw new Error("Esperado OBJETO quando quantidade = 1.");
      }
      questoesRaw = [obj];
    }

    // Normalizações
    questoesRaw = questoesRaw.map((q: any, _idx: number) => {
      const out: any = { ...q };

      out.tipo_questao = (
        out.tipo_questao ||
        tipo ||
        "multipla_escolha"
      ).toLowerCase();
      out.disciplina = out.disciplina || disciplina;
      out.serie = out.serie || serie;
      out.dificuldade = out.dificuldade || dificuldade;

      if (
        out.tipo_questao === "verdadeiro_falso" &&
        Array.isArray(out.afirmacoes)
      ) {
        out.afirmacoes = out.afirmacoes.map((a: any) => ({
          texto: a.texto,
          valor: typeof a.valor === "boolean" ? a.valor : !!a.correta,
        }));
        out.justificativa_gabarito =
          out.justificativa_gabarito || out.justificativa || "";
      }

      if (out.tipo_questao === "associacao") {
        if (Array.isArray(out.coluna_a)) {
          out.coluna_a = out.coluna_a.map((i: any, iIdx: number) => ({
            numero:
              typeof i.numero !== "undefined"
                ? i.numero
                : typeof i.id !== "undefined"
                ? i.id
                : iIdx + 1,
            texto: i.texto,
          }));
        }
        if (Array.isArray(out.coluna_b)) {
          const letras = ["A", "B", "C", "D", "E", "F"];
          out.coluna_b = out.coluna_b.map((i: any, iIdx: number) => ({
            letra: i.letra || i.id || letras[iIdx] || "A",
            texto: i.texto,
          }));
        }
      }

      if (
        out.tipo_questao === "multipla_escolha" &&
        Array.isArray(out.alternativas)
      ) {
        out.alternativas = out.alternativas.slice(0, 5);
      }

      if (!out.enunciado) {
        out.enunciado =
          out.tipo_questao === "verdadeiro_falso"
            ? `Julgue as afirmações sobre ${tema}`.trim()
            : out.tipo_questao === "associacao"
            ? `Associe as colunas sobre ${tema}`.trim()
            : `Questão sobre ${tema}`;
      }

      return out;
    });

    // Deduplicação (exata) por enunciado
    const seen = new Set<string>();
    const norm = (s: string) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    let questoes = questoesRaw.filter((q) => {
      const key = norm(q.enunciado);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ===========================
    // Anti-repetição de abertura (pós-processamento)
    // ===========================
    // Marca repetidos por prefixo 6-palavras OU com abertura banida
    const prefixCount = new Map<string, number>();
    questoes.forEach((q) => {
      const p = firstWords(q.enunciado, 6);
      prefixCount.set(p, (prefixCount.get(p) || 0) + 1);
    });

    const needRewriteIdx: number[] = [];
    questoes.forEach((q, idx) => {
      const p = firstWords(q.enunciado, 6);
      if ((prefixCount.get(p) || 0) > 1 || hasBannedOpening(q.enunciado)) {
        needRewriteIdx.push(idx);
      }
    });

    if (needRewriteIdx.length > 0) {
      const toFix = needRewriteIdx.map((i) => questoes[i].enunciado);
      const rewritten = await rewriteEnunciados(toFix, tema);
      needRewriteIdx.forEach((i, k) => {
        questoes[i].enunciado = rewritten[k] || questoes[i].enunciado;
      });
    }

    // Anotações finais
    const tokens_usados = data.usage?.total_tokens || 0;
    const custo_estimado = tokens_usados * 0.0000015;

    questoes = questoes.map((q: any) => ({
      ...q,
      tokens_usados,
      custo_estimado,
      api_usada: "openai",
      created_at: new Date().toISOString(),
    }));

    const payload = quantidade === 1 ? questoes[0] : questoes;

    return new Response(JSON.stringify({ questoes: payload }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Erro desconhecido" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      }
    );
  }
});

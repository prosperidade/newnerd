// ====================================================================
// DIAGNOSTICO.JS - v3 (corrigido)
// - Usa window.supabase (CDN) + supabaseClient (de auth.js)
// - Busca perfil do aluno na tabela 'alunos' (por email)
// - Geração adaptativa de itens (IA com fallback local)
// - Salva diagnóstico via supabaseClient (RLS)
// - Upload opcional para bucket privado 'alunos-biblioteca'
// ====================================================================

// ===== Helpers básicos =====
const el = (id) => document.getElementById(id);
const q = (sel) => document.querySelector(sel);
const qa = (sel) => Array.from(document.querySelectorAll(sel));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// ===== Estado global =====
let aluno = null; // registro na tabela 'alunos'
let PRESET = "efi";
let startTime = Date.now();
let timerInterval;
let uploadedFiles = [];
let dadosDiagnostico = null;

// Pontuações
let memScore = 0,
  flexScore = 0,
  speedScore = 0,
  logicScore = 0,
  cptScore = 0;
let confMem = 0,
  confFlex = 0,
  confSpeed = 0,
  confLogic = 0;
let litLevel = "A",
  litIndex = 0,
  litScore = 0,
  litAnswered = false;
let matLevel = "A",
  matIndex = 0,
  matScore = 0,
  matAnswered = false;

// Estados dos testes
let flexStarted = false,
  flexChangesDone = 0,
  flexChangesTodo = 1;
let goNoGoRequired = false,
  goNoGoOk = false;
let speedStart = 0,
  speedReaction = 0;
let cptRunning = false,
  cptStimIdx = 0,
  cptHits = 0,
  cptFalse = 0;
let cptRt = [],
  cptStimuli = [],
  cptTarget = "X",
  cptPressArmed = false;
let cptOnset = 0,
  cptRespWindowMs = 500;
let radarChart = null;

// ===== PRESETS =====
const PRESETS = {
  efi: {
    label: "EF I (1ª—4ª)",
    memSeq: [3, 6, 2, 1],
    flexChanges: 1,
    speedBands: [700, 1200],
    logic: { seq: "1 — 2 — 4 — 8 — ?", options: [12, 10, 16, 6], correct: 16 },
    cpt: { targets: ["X"], n: 40, isi: [600, 900] },
    lit: {
      A: [
        {
          stem: "O gato subiu no telhado. Título mais apropriado:",
          opts: [
            "Animais em perigo",
            "O gato curioso",
            "Tempestade",
            "Cachorro perdido",
          ],
          ans: 1,
        },
        {
          stem: "Pedro viu arco-íris após chuva. O que inferir?",
          opts: ["Era noite", "Parou de chover", "Fez frio", "Era inverno"],
          ans: 1,
        },
      ],
      B: [
        {
          stem: '"Ana abriu livro e sorriu". O que explica?',
          opts: [
            "Ficou triste",
            "Gostou do que leu",
            "Estava cansada",
            "Perdeu livro",
          ],
          ans: 1,
        },
        {
          stem: '"Rio serpenteia". Serpenteia significa:',
          opts: [
            "Corre em curvas",
            "Corre reto",
            "Para de correr",
            "Sobe montanha",
          ],
          ans: 0,
        },
      ],
      C: [
        {
          stem: "Objetivo de legenda:",
          opts: ["Narrar", "Explicar brevemente", "Convencer", "Contar piada"],
          ans: 1,
        },
        {
          stem: "Ideia principal de parágrafo:",
          opts: [
            "Sempre 1ª linha",
            "Pode estar em qualquer parte",
            "Sempre última",
            "Só no título",
          ],
          ans: 1,
        },
      ],
    },
    mat: {
      A: [
        { stem: "7 + 5 =", opts: ["11", "12", "13", "14"], ans: 1 },
        { stem: "9 − 4 =", opts: ["3", "4", "5", "6"], ans: 2 },
      ],
      B: [
        { stem: "Metade de 18 =", opts: ["9", "8", "6", "12"], ans: 0 },
        { stem: "2 × 7 =", opts: ["12", "13", "14", "15"], ans: 2 },
      ],
      C: [
        {
          stem: "Perímetro retângulo 3×5:",
          opts: ["8", "15", "16", "10"],
          ans: 2,
        },
        {
          stem: "12 balas para 3 crianças, cada um recebe:",
          opts: ["3", "4", "6", "12"],
          ans: 1,
        },
      ],
    },
  },
  efii: {
    label: "EF II (5ª—8ª)",
    memSeq: [7, 3, 9, 1, 5, 8],
    flexChanges: 2,
    speedBands: [500, 900],
    logic: {
      seq: "2 — 5 — 11 — 23 — ?",
      options: [35, 47, 29, 31],
      correct: 47,
    },
    cpt: { targets: ["X"], n: 50, isi: [500, 800] },
    lit: {
      A: [
        {
          stem: '"Clima ameno" significa:',
          opts: ["Chuvoso", "Agradável", "Frio", "Tempestuoso"],
          ans: 1,
        },
      ],
      B: [
        {
          stem: "Reportagem foca:",
          opts: ["Opinião", "Relatar fatos", "Ficção", "Poesia"],
          ans: 1,
        },
      ],
      C: [
        {
          stem: "Ideia principal parágrafo:",
          opts: ["Sempre 1ª", "Qualquer parte", "Sempre última", "Só título"],
          ans: 1,
        },
      ],
    },
    mat: {
      A: [{ stem: "3/4 de 20 =", opts: ["5", "10", "15", "12"], ans: 2 }],
      B: [{ stem: "2x+6=18, x=", opts: ["3", "6", "9", "12"], ans: 1 }],
      C: [{ stem: "y=2x+1, x=3, y=", opts: ["5", "6", "7", "8"], ans: 2 }],
    },
  },
  em: {
    label: "EM (1º—3º)",
    memSeq: [9, 4, 7, 2, 6, 3, 8],
    flexChanges: 2,
    speedBands: [400, 800],
    logic: {
      seq: "3 — 9 — 27 — ? — 243",
      options: [54, 72, 81, 108],
      correct: 81,
    },
    cpt: { targets: ["X"], n: 60, isi: [450, 700] },
    lit: {
      A: [
        {
          stem: 'Em texto científico, "hipótese":',
          opts: ["Opinião", "Suposição testável", "Conclusão", "Resumo"],
          ans: 1,
        },
      ],
      B: [
        {
          stem: "Editorial busca:",
          opts: [
            "Entreter",
            "Instruir",
            "Opinar/influenciar",
            "Relatar neutro",
          ],
          ans: 2,
        },
      ],
      C: [
        {
          stem: "Falácia é:",
          opts: ["Argumento válido", "Erro raciocínio", "Resumo", "Hipótese"],
          ans: 1,
        },
      ],
    },
    mat: {
      A: [
        {
          stem: "f(x)=2x+1 é:",
          opts: ["Quadrática", "Linear", "Exponencial", "Constante"],
          ans: 1,
        },
      ],
      B: [{ stem: "Derivada x²=", opts: ["2x", "x", "x³", "2"], ans: 0 }],
      C: [
        {
          stem: "Exponencial cresce quando a>",
          opts: ["0", "1", "-1", "-2"],
          ans: 1,
        },
      ],
    },
  },
  grad: {
    label: "Graduação",
    memSeq: [12, 7, 9, 4, 6, 10, 3, 8],
    flexChanges: 3,
    speedBands: [350, 700],
    logic: {
      seq: "4 — 7 — 13 — 25 — ?",
      options: [43, 49, 37, 53],
      correct: 49,
    },
    cpt: { targets: ["X"], n: 70, isi: [400, 650] },
    lit: {
      A: [
        {
          stem: 'Revisão, "lacuna":',
          opts: ["Resumo", "Falta estudos", "Erro método", "Conclusão fraca"],
          ans: 1,
        },
      ],
      B: [
        {
          stem: "Argumento dedutivo validade:",
          opts: ["Verdade premissas", "Forma lógica", "Amostra", "Autoridade"],
          ans: 1,
        },
      ],
      C: [
        {
          stem: "Viés confirmação:",
          opts: [
            "Buscar contrários",
            "Buscar que confirmam",
            "Erro aleatório",
            "Falha medição",
          ],
          ans: 1,
        },
      ],
    },
    mat: {
      A: [
        {
          stem: "P(A)=0,3 P(B)=0,5 indep → P(A∩B)=",
          opts: ["0,15", "0,2", "0,8", "0,3"],
          ans: 0,
        },
      ],
      B: [
        { stem: "∫2x dx=", opts: ["x²+C", "2x²+C", "x+C", "x²/2+C"], ans: 0 },
      ],
      C: [
        {
          stem: "Teste t compara",
          opts: ["Médias", "Variâncias", "Medianas", "Proporções"],
          ans: 0,
        },
      ],
    },
  },
};

// ===== NORMS (cortes) =====
const NORMS = {
  efi: {
    cognitive: { cuts: [20, 36], max: 50 },
    reading: { cuts: [1, 2], max: 3 },
    math: { cuts: [1, 2], max: 3 },
  },
  efii: {
    cognitive: { cuts: [22, 37], max: 50 },
    reading: { cuts: [1, 2], max: 3 },
    math: { cuts: [1, 2], max: 3 },
  },
  em: {
    cognitive: { cuts: [24, 38], max: 50 },
    reading: { cuts: [1, 2], max: 3 },
    math: { cuts: [1, 2], max: 3 },
  },
  grad: {
    cognitive: { cuts: [26, 40], max: 50 },
    reading: { cuts: [1, 2], max: 3 },
    math: { cuts: [1, 2], max: 3 },
  },
};

function classify(score, cfg) {
  const [c1, c2] = cfg.cuts;
  let level, badgeClass, pmin, pmax, baseMin, baseMax;
  if (score <= c1) {
    level = "Atenção";
    badgeClass = "badge-atencao";
    pmin = 5;
    pmax = 25;
    baseMin = 0;
    baseMax = c1;
  } else if (score <= c2) {
    level = "Adequado";
    badgeClass = "badge-adequado";
    pmin = 26;
    pmax = 75;
    baseMin = c1 + 1;
    baseMax = c2;
  } else {
    level = "Avançado";
    badgeClass = "badge-avancado";
    pmin = 76;
    pmax = 97;
    baseMin = c2 + 1;
    baseMax = cfg.max;
  }
  let pct = pmin;
  if (baseMax > baseMin) {
    const rel = (score - baseMin) / (baseMax - baseMin);
    pct = Math.round(pmin + rel * (pmax - pmin));
  }
  return { level, badgeClass, percentile: clamp(pct, 1, 99) };
}

// ===== Timer/UX/Progresso =====
function startTimer() {
  timerInterval = setInterval(() => {
    const t = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(t / 60)).padStart(2, "0");
    const s = String(t % 60).padStart(2, "0");
    el("timer").textContent = `Tempo: ${m}:${s}`;
  }, 1000);
}

function attachOptionUX() {
  qa("label.option").forEach((l) => {
    l.addEventListener("click", () => {
      const inp = l.querySelector('input[type="radio"]');
      if (!inp) return;
      qa(`input[name="${inp.name}"]`).forEach((r) =>
        r.closest(".option")?.classList.remove("selected")
      );
      l.classList.add("selected");
      inp.checked = true;
    });
  });
}

function updateProgress() {
  const total = 15;
  const answered =
    (memScore > 0 ? 1 : 0) +
    (flexScore > 0 ? 1 : 0) +
    (speedScore > 0 ? 1 : 0) +
    (logicScore > 0 ? 1 : 0) +
    (cptScore > 0 ? 1 : 0) +
    (litAnswered ? 1 : 0) +
    (matAnswered ? 1 : 0) +
    qa('input[name="motivation"]:checked').length +
    qa('input[name="mindset"]:checked').length +
    qa('input[name="anxiety"]:checked').length +
    qa('input[name="efficacy"]:checked').length +
    qa('input[name="persistence"]:checked').length;

  const pct = Math.min(100, Math.round((answered / total) * 100));
  el("progress").style.width = pct + "%";
}

// ===== Memória =====
function memCorrectSum() {
  return PRESETS[PRESET].memSeq
    .filter((n) => n % 2 === 0)
    .reduce((a, b) => a + b, 0);
}
function handleMemoryCheck() {
  const ans = parseInt(el("mem-answer").value);
  confMem = clamp(parseInt(el("mem-conf").value) || 0, 0, 100);
  const correct = memCorrectSum();
  const feedback = el("mem-feedback");
  if (ans === correct) {
    memScore = 10;
    feedback.textContent = "✅ Correto!";
    feedback.className = "feedback success";
  } else {
    memScore = 4;
    feedback.textContent = "❌ Correto: " + correct;
    feedback.className = "feedback error";
  }
  feedback.classList.remove("hidden");
  updateProgress();
}

// ===== Flexibilidade + Go/No-Go =====
function handleFlexClick() {
  const btn = el("flex-btn");
  const feedback = el("flex-feedback");
  if (!flexStarted) {
    flexStarted = true;
    feedback.textContent = "Aguarde as mudanças...";
    feedback.className = "feedback";
    feedback.classList.remove("hidden");
    setTimeout(() => advanceFlexRule(btn), 700 + Math.random() * 700);
  } else {
    confFlex = clamp(parseInt(el("flex-conf").value) || 0, 0, 100);
    if (goNoGoRequired) {
      goNoGoOk = false;
      flexScore = 4;
      feedback.textContent = "❌ Inibição falhou (clicou no vermelho)";
      feedback.className = "feedback error";
    } else {
      flexScore = 10;
      feedback.textContent = "✅ Flexibilidade OK!";
      feedback.className = "feedback success";
    }
    feedback.classList.remove("hidden");
    updateProgress();
  }
}
function advanceFlexRule(btn) {
  flexChangesDone++;
  if (flexChangesDone < flexChangesTodo) {
    btn.textContent = btn.textContent === "Azul" ? "Vermelho" : "Azul";
    btn.style.background = btn.textContent === "Azul" ? "#0ea5e9" : "#ef4444";
    setTimeout(() => advanceFlexRule(btn), 700 + Math.random() * 700);
  } else {
    btn.textContent = "Vermelho";
    btn.style.background = "#ef4444";
    goNoGoRequired = true;
    goNoGoOk = true;
    setTimeout(() => {
      if (goNoGoRequired && goNoGoOk) {
        flexScore = 10;
        const feedback = el("flex-feedback");
        feedback.textContent = "✅ Inibição OK (não clicou)";
        feedback.className = "feedback success";
        feedback.classList.remove("hidden");
        updateProgress();
      }
      goNoGoRequired = false;
    }, 1500);
  }
}

// ===== Velocidade =====
function scheduleSpeedBox() {
  const box = el("speed-box");
  box.style.background = "#6b7280";
  speedStart = 0;
  speedReaction = 0;
  setTimeout(() => {
    box.style.background = "#10b981";
    speedStart = performance.now();
  }, 1000 + Math.random() * 1000);
}
function handleSpeedClick() {
  if (speedStart > 0 && speedReaction === 0) {
    speedReaction = Math.floor(performance.now() - speedStart);
    const feedback = el("speed-feedback");
    feedback.textContent = `⏱️ Tempo: ${speedReaction} ms`;
    feedback.className = "feedback";
    feedback.classList.remove("hidden");
    confSpeed = clamp(parseInt(el("speed-conf").value) || 0, 0, 100);
    const [good, ok] = PRESETS[PRESET].speedBands;
    speedScore = speedReaction < good ? 10 : speedReaction < ok ? 8 : 5;
    updateProgress();
    scheduleSpeedBox();
  }
}

// ===== CPT =====
function makeStimuli() {
  const cfg = PRESETS[PRESET].cpt;
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const arr = [];
  for (let i = 0; i < cfg.n; i++) {
    arr.push(
      Math.random() < 0.25
        ? cptTarget
        : letters[Math.floor(Math.random() * letters.length)]
    );
  }
  return arr;
}
function registerCPTResponse() {
  if (!cptRunning || !cptPressArmed) return;
  const now = performance.now();
  const rt = now - cptOnset;
  const curChar = cptStimuli[cptStimIdx - 1];
  if (curChar === cptTarget) {
    cptHits++;
    cptRt.push(rt);
  } else {
    cptFalse++;
  }
  cptPressArmed = false;
  const charElement = document.querySelector(".cpt-char");
  if (charElement) {
    charElement.classList.add("clicked");
    setTimeout(() => charElement.classList.remove("clicked"), 300);
  }
}
function stepCPT() {
  if (!cptRunning || cptStimIdx >= cptStimuli.length) {
    finishCPT();
    return;
  }
  const stream = el("cpt-stream");
  stream.innerHTML = "";
  const char = cptStimuli[cptStimIdx];
  const span = document.createElement("div");
  span.className = "cpt-char";
  span.textContent = char;
  span.onclick = registerCPTResponse;
  stream.appendChild(span);
  cptPressArmed = true;
  cptOnset = performance.now();
  cptStimIdx++;
  setTimeout(() => {
    cptPressArmed = false;
    const [lo, hi] = PRESETS[PRESET].cpt.isi;
    setTimeout(stepCPT, lo + Math.random() * (hi - lo));
  }, cptRespWindowMs);
}
function startCPT() {
  if (cptRunning) return;
  cptStimuli = makeStimuli();
  cptRunning = true;
  cptStimIdx = 0;
  cptHits = 0;
  cptFalse = 0;
  cptRt = [];
  stepCPT();
}
function finishCPT() {
  cptRunning = false;
  const totalTargets = cptStimuli.filter((s) => s === cptTarget).length || 1;
  const acc = (cptHits / totalTargets) * 100;
  const rtMean = cptRt.length
    ? Math.round(cptRt.reduce((a, b) => a + b, 0) / cptRt.length)
    : 0;
  cptScore = Math.max(
    3,
    Math.min(10, Math.round(acc / 10 - cptFalse * 0.25 - rtMean / 900))
  );
  const feedback = el("cpt-feedback");
  feedback.textContent = `Precisão: ${acc.toFixed(
    0
  )}% · Falsos: ${cptFalse} · TR: ${rtMean}ms`;
  feedback.className = "feedback";
  feedback.classList.remove("hidden");
  updateProgress();
}

// ===== Lógica =====
function handleLogicChange(ev) {
  confLogic = clamp(parseInt(el("logic-conf").value) || 0, 0, 100);
  const v = parseInt(ev.target.value);
  const correct = PRESETS[PRESET].logic.correct;
  const feedback = el("logic-feedback");
  if (v === correct) {
    logicScore = 10;
    feedback.textContent = "✅ Correto!";
    feedback.className = "feedback success";
  } else {
    logicScore = 4;
    feedback.textContent = "❌ Pense no padrão";
    feedback.className = "feedback error";
  }
  feedback.classList.remove("hidden");
  updateProgress();
}

// ==================== Geração de questões (IA + fallback) ====================
const WEBHOOK_GERAR_QUESTAO =
  "http://localhost:5678/webhook/newnerd-gerar-questao-diagnostico";

async function gerarQuestaoIA(area, nivel, faixa, seed = null) {
  try {
    const payload = { area, nivel, faixa };
    if (seed) payload.seed = seed;
    const response = await fetch(WEBHOOK_GERAR_QUESTAO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Erro ao gerar questão com IA");
    const questao = await response.json();
    if (
      !questao?.stem ||
      !Array.isArray(questao?.opts) ||
      typeof questao?.ans !== "number"
    )
      throw new Error("Formato de questão inválido");
    return questao;
  } catch (err) {
    console.error("IA indisponível:", err);
    return null;
  }
}

// Fallback local
function pickItem(area, level) {
  const bank = PRESETS[PRESET][area]?.[level];
  if (!bank || bank.length === 0)
    return { stem: "—", opts: ["A", "B", "C", "D"], ans: 0 };
  return bank[Math.floor(Math.random() * bank.length)];
}

// Leitura
async function buildLitItem() {
  const wrap = el("lit-opts");
  const feedbackEl = el("lit-feedback");
  const nextBtn = el("lit-next");
  wrap.innerHTML =
    '<div style="text-align:center; padding:20px;">⏳ Gerando questão…</div>';
  nextBtn.disabled = true;
  feedbackEl.classList.add("hidden");

  const timestamp = Date.now();
  const qIA = await gerarQuestaoIA("lit", litLevel, PRESET, timestamp);
  const item = qIA
    ? { stem: qIA.stem, opts: qIA.opts, ans: qIA.ans }
    : pickItem("lit", litLevel);

  el("lit-stem").textContent = item.stem;
  wrap.innerHTML = "";
  item.opts.forEach((t, i) => {
    const lab = document.createElement("label");
    lab.className = "option";
    lab.innerHTML = `
      <input type="radio" name="lit" value="${i}">
      <span class="radio-custom"></span>
      <span class="option-label">${t}</span>`;
    wrap.appendChild(lab);
  });
  attachOptionUX();
  nextBtn.disabled = false;

  nextBtn.onclick = () => {
    const sel = q('input[name="lit"]:checked');
    if (!sel) return alert("Escolha uma opção");
    const chosen = parseInt(sel.value);
    const feedback = el("lit-feedback");
    if (chosen === item.ans) {
      litScore++;
      feedback.textContent = "✅ Correto!";
      feedback.className = "feedback success";
      if (litLevel === "A") litLevel = "B";
      else if (litLevel === "B") litLevel = "C";
    } else {
      feedback.textContent = "❌ Incorreto";
      feedback.className = "feedback error";
    }
    feedback.classList.remove("hidden");
    litIndex++;
    el("lit-progress").textContent = `Item ${litIndex}/3`;
    if (litIndex < 3) setTimeout(buildLitItem, 500);
    else {
      litAnswered = true;
      nextBtn.disabled = true;
      updateProgress();
    }
  };
}

// Matemática
async function buildMatItem() {
  const wrap = el("mat-opts");
  const feedbackEl = el("mat-feedback");
  const nextBtn = el("mat-next");
  wrap.innerHTML =
    '<div style="text-align:center; padding:20px;">⏳ Gerando questão…</div>';
  nextBtn.disabled = true;
  feedbackEl.classList.add("hidden");

  const timestamp = Date.now();
  const qIA = await gerarQuestaoIA("mat", matLevel, PRESET, timestamp);
  const item = qIA
    ? { stem: qIA.stem, opts: qIA.opts, ans: qIA.ans }
    : pickItem("mat", matLevel);

  el("mat-stem").textContent = item.stem;
  wrap.innerHTML = "";
  item.opts.forEach((t, i) => {
    const lab = document.createElement("label");
    lab.className = "option";
    lab.innerHTML = `
      <input type="radio" name="mat" value="${i}">
      <span class="radio-custom"></span>
      <span class="option-label">${t}</span>`;
    wrap.appendChild(lab);
  });
  attachOptionUX();
  nextBtn.disabled = false;

  nextBtn.onclick = () => {
    const sel = q('input[name="mat"]:checked');
    if (!sel) return alert("Escolha uma opção");
    const chosen = parseInt(sel.value);
    const feedback = el("mat-feedback");
    if (chosen === item.ans) {
      matScore++;
      feedback.textContent = "✅ Correto!";
      feedback.className = "feedback success";
      if (matLevel === "A") matLevel = "B";
      else if (matLevel === "B") matLevel = "C";
    } else {
      feedback.textContent = "❌ Incorreto";
      feedback.className = "feedback error";
    }
    feedback.classList.remove("hidden");
    matIndex++;
    el("mat-progress").textContent = `Item ${matIndex}/3`;
    if (matIndex < 3) setTimeout(buildMatItem, 500);
    else {
      matAnswered = true;
      nextBtn.disabled = true;
      updateProgress();
    }
  };
}

// ===== Socioemocional / Metacognição =====
function socioScore() {
  const checked = (name) => q(`input[name="${name}"]:checked`)?.value ?? null;
  const eff = checked("efficacy");
  const per = checked("persistence");
  const anx = checked("anxiety");
  return (
    (eff === "high" ? 4 : 1) +
    (per === "retry" ? 4 : 1) +
    (anx === "low" ? 4 : anx === "medium" ? 2 : 1)
  );
}

function metacogCalibration() {
  const pts = [memScore, flexScore, speedScore, logicScore, cptScore];
  const conf = [
    confMem,
    confFlex,
    confSpeed,
    confLogic,
    (confMem + confFlex + confSpeed + confLogic) / 4 || 50,
  ].map((c) => c / 10);
  let dif = 0,
    n = 0;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i] > 0) {
      dif += Math.abs(pts[i] - conf[i]);
      n++;
    }
  }
  const calib = Math.max(0, 100 - (dif * (100 / (n * 10)) * 100) / 100);
  return isFinite(calib) ? Math.min(100, Math.round(calib)) : 0;
}
function metaQualityLabel(p) {
  if (p >= 75) return { t: "Subconfiante?", c: "badge-adequado" };
  if (p >= 45 && p <= 65) return { t: "Bem calibrado", c: "badge-avancado" };
  return { t: "Superconfiante?", c: "badge-atencao" };
}

// ===== Gerar diagnóstico =====
async function generateDiagnosis() {
  const required = [
    "motivation",
    "mindset",
    "anxiety",
    "efficacy",
    "persistence",
  ];
  const ok = required.every((n) => q(`input[name="${n}"]:checked`));
  if (
    !ok ||
    memScore === 0 ||
    flexScore === 0 ||
    speedScore === 0 ||
    logicScore === 0 ||
    cptScore === 0 ||
    !litAnswered ||
    !matAnswered
  ) {
    alert("Complete todos os testes: cognitivo, sondagens e socioemocional.");
    return;
  }

  const cogTotal = memScore + flexScore + speedScore + logicScore + cptScore;
  const socio = socioScore();
  const meta = metacogCalibration();
  const metaQ = metaQualityLabel(meta);

  const ncfg = NORMS[PRESET];
  const cogClass = classify(cogTotal, ncfg.cognitive);
  const litClass = classify(litScore, ncfg.reading);
  const matClass = classify(matScore, ncfg.math);

  dadosDiagnostico = {
    preset: PRESET,
    memScore,
    flexScore,
    speedScore,
    logicScore,
    cptScore,
    cogTotal,
    socio,
    meta,
    litScore,
    matScore,
    norms: { cog: cogClass, lit: litClass, mat: matClass },
  };

  // Render
  el("cog-score").textContent = cogTotal;
  el("socio-score").textContent = socio;
  el("meta-score").textContent = meta + "%";
  const mq = el("meta-qual");
  mq.textContent = metaQ.t;
  mq.className = "badge " + metaQ.c;
  el("lit-score").textContent = litScore;
  el("mat-score").textContent = matScore;
  el(
    "cog-norm"
  ).innerHTML = `<span class="badge ${cogClass.badgeClass}">${cogClass.level}</span> · P${cogClass.percentile}`;
  el(
    "lit-norm"
  ).innerHTML = `<span class="badge ${litClass.badgeClass}">${litClass.level}</span> · P${litClass.percentile}`;
  el(
    "mat-norm"
  ).innerHTML = `<span class="badge ${matClass.badgeClass}">${matClass.level}</span> · P${matClass.percentile}`;

  // Radar
  const socioN = Math.round((socio / 12) * 10);
  const metaN = Math.round(meta / 10);
  const ctx = el("radar-canvas").getContext("2d");
  if (radarChart) radarChart.destroy();
  radarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: [
        "Memória",
        "Flexibilidade",
        "Velocidade",
        "Atenção",
        "Socioemocional",
        "Metacognição",
      ],
      datasets: [
        {
          label: "Pontuação",
          data: [memScore, flexScore, speedScore, cptScore, socioN, metaN],
          backgroundColor: "rgba(102,126,234,0.3)",
          borderColor: "#667eea",
          pointBackgroundColor: "#667eea",
          pointBorderColor: "#fff",
          pointRadius: 5,
        },
      ],
    },
    options: {
      scales: { r: { min: 0, max: 10, ticks: { stepSize: 2 } } },
      plugins: { legend: { display: false } },
    },
  });

  // Recomendações simples
  const recs = [];
  if (memScore < 7) recs.push(["🧠 Memória", "Chunking e exemplos concretos"]);
  if (flexScore < 7)
    recs.push(["🔄 Flexibilidade", "Resolver por duas rotas diferentes"]);
  if (speedScore < 7)
    recs.push(["⚡ Velocidade", "Sprints cronometrados de 2-3 min"]);
  if (cptScore < 7) recs.push(["🎯 Atenção", "Pomodoro e reduzir distrações"]);
  if (logicScore < 7) recs.push(["🧩 Lógica", "Treinar padrões e progressões"]);
  if (litScore <= 1) recs.push(["📖 Leitura", "Fluência + vocabulário básico"]);
  if (matScore <= 1)
    recs.push(["🔢 Matemática", "Fatos básicos com representação visual"]);
  el("recommendations").innerHTML = recs
    .map(
      ([t, c]) =>
        `<div class="strategy-item" style="background:#f8f9fa;padding:12px;border-radius:8px;border-left:4px solid #667eea;">
      <strong>${t}</strong><br>${c}</div>`
    )
    .join("");

  await salvarDiagnostico(dadosDiagnostico);

  el("results-panel").classList.remove("hidden");
  el("results-panel").scrollIntoView({ behavior: "smooth" });
}

// ===== Salvar no banco (via supabase-js) =====
async function salvarDiagnostico(dados) {
  try {
    const payload = {
      aluno_id: aluno.id,
      preset: dados.preset,
      mem_score: dados.memScore,
      flex_score: dados.flexScore,
      speed_score: dados.speedScore,
      logic_score: dados.logicScore,
      cpt_score: dados.cptScore,
      cog_total: dados.cogTotal,
      socio_score: dados.socio,
      meta_score: dados.meta,
      lit_score: dados.litScore,
      mat_score: dados.matScore,
      resultados: dados.norms,
      arquivos_biblioteca: uploadedFiles.length ? uploadedFiles : null,
    };
    const { error } = await supabaseClient
      .from("diagnosticos_alunos")
      .insert(payload);
    if (error) console.error("Erro ao salvar diagnóstico:", error);
  } catch (err) {
    console.error("Erro ao salvar:", err);
  }
}

// ===== Upload p/ bucket privado 'alunos-biblioteca' (opcional) =====
async function uploadFiles() {
  const fileInput = el("file-upload");
  const files = fileInput?.files || [];
  const feedbackEl = el("upload-feedback");
  const listEl = el("uploaded-files-list");
  if (!feedbackEl || !listEl) return; // elementos não existem no HTML -> ignora

  feedbackEl.classList.add("hidden");

  if (!aluno?.id) {
    feedbackEl.textContent = "Erro: Aluno não autenticado.";
    feedbackEl.className = "feedback error";
    feedbackEl.classList.remove("hidden");
    return;
  }
  if (files.length === 0) {
    feedbackEl.textContent = "Selecione pelo menos um arquivo.";
    feedbackEl.className = "feedback error";
    feedbackEl.classList.remove("hidden");
    return;
  }

  const btn = el("upload-btn");
  if (btn) btn.disabled = true;
  feedbackEl.textContent = `⏳ Enviando ${files.length} arquivo(s) ...`;
  feedbackEl.className = "feedback";
  feedbackEl.classList.remove("hidden");

  let okCount = 0;
  for (const file of files) {
    const safe = file.name.replace(/[^\w.\-() ]+/g, "_").replace(/\s+/g, "_");
    const path = `${aluno.id}/${Date.now()}_${safe}`;
    try {
      const { error } = await supabaseClient.storage
        .from("alunos-biblioteca")
        .upload(path, file, { upsert: true });
      if (!error) {
        uploadedFiles.push(`alunos-biblioteca/${path}`);
        okCount++;
        listEl.innerHTML += `<p style="color:#087f5b;">✅ ${file.name}</p>`;
      } else {
        console.error("Falha upload:", error);
        listEl.innerHTML += `<p style="color:#c92a2a;">❌ Falha: ${file.name}</p>`;
      }
    } catch (e) {
      console.error("Erro de rede:", e);
      listEl.innerHTML += `<p style="color:#c92a2a;">❌ Erro de rede: ${file.name}</p>`;
    }
  }

  if (btn) btn.disabled = false;
  if (okCount > 0) {
    feedbackEl.textContent = `✅ ${okCount} arquivo(s) enviado(s)!`;
    feedbackEl.className = "feedback success";
  } else {
    feedbackEl.textContent = "❌ Nenhuma transferência concluída.";
    feedbackEl.className = "feedback error";
  }
}

// ===== PDF (técnico/simplificado) =====
function gerarConquistas(d) {
  const out = [];
  if (d.cogTotal >= 35)
    out.push({ emoji: "🧠", texto: "Excelente desempenho cognitivo!" });
  if (d.meta >= 45 && d.meta <= 75)
    out.push({ emoji: "🎯", texto: "Você conhece bem suas capacidades!" });
  if (d.socio >= 9)
    out.push({ emoji: "💪", texto: "Ótimo controle emocional!" });
  if (d.litScore === 3) out.push({ emoji: "📖", texto: "Leitura excelente!" });
  if (d.matScore === 3)
    out.push({ emoji: "🔢", texto: "Matemática impecável!" });
  if (d.memScore >= 8) out.push({ emoji: "🧩", texto: "Memória poderosa!" });
  if (d.cptScore >= 8)
    out.push({ emoji: "🎯", texto: "Concentração de ninja!" });
  if (out.length === 0)
    out.push({ emoji: "⭐", texto: "Você completou o diagnóstico!" });
  return out;
}
function gerarDesafios(d) {
  const out = [];
  if (d.memScore < 7)
    out.push({
      emoji: "🧩",
      texto: "Praticar exercícios de memória diariamente",
    });
  if (d.flexScore < 7)
    out.push({ emoji: "🔄", texto: "Resolver problemas de formas diferentes" });
  if (d.speedScore < 7)
    out.push({ emoji: "⚡", texto: "Fazer exercícios cronometrados" });
  if (d.cptScore < 7)
    out.push({ emoji: "⏱️", texto: "Treinar foco com técnica Pomodoro" });
  if (d.logicScore < 7)
    out.push({ emoji: "🧠", texto: "Praticar jogos de lógica" });
  if (d.litScore < 2)
    out.push({ emoji: "📚", texto: "Ler 15 minutos por dia" });
  if (d.matScore < 2)
    out.push({
      emoji: "✏️",
      texto: "Resolver 5 exercícios de matemática por dia",
    });
  if (out.length === 0)
    out.push({ emoji: "🚀", texto: "Continue evoluindo sempre!" });
  return out;
}

function gerarInterpretacao(d) {
  const out = [];
  if (d.norms.cog.level === "Atenção")
    out.push({
      titulo: "Desempenho Cognitivo",
      texto:
        "O desempenho cognitivo indica necessidade de apoio adicional. Recomenda-se atenção especial às estratégias de aprendizagem e possível avaliação complementar para identificar dificuldades específicas.",
    });
  else if (d.norms.cog.level === "Adequado")
    out.push({
      titulo: "Desempenho Cognitivo",
      texto:
        "O desempenho cognitivo está dentro do esperado para a faixa etária. O aluno demonstra capacidades adequadas de processamento de informações e resolução de problemas.",
    });
  else
    out.push({
      titulo: "Desempenho Cognitivo",
      texto:
        "O desempenho cognitivo é superior à média. O aluno demonstra habilidades cognitivas avançadas, podendo se beneficiar de atividades de enriquecimento curricular.",
    });

  if (d.meta < 45)
    out.push({
      titulo: "Metacognição",
      texto:
        "Tendência à superconfiança. O aluno pode superestimar suas capacidades, o que pode levar a falhas no planejamento de estudos. Trabalhar autoavaliação realista.",
    });
  else if (d.meta > 75)
    out.push({
      titulo: "Metacognição",
      texto:
        "Possível subconfiança. O aluno pode subestimar suas capacidades reais. Importante trabalhar autoestima acadêmica e reconhecimento de competências.",
    });
  else
    out.push({
      titulo: "Metacognição",
      texto:
        "Boa calibração metacognitiva. O aluno demonstra conhecimento adequado sobre suas próprias capacidades, o que favorece o planejamento eficaz de estudos.",
    });

  if (d.socio < 6)
    out.push({
      titulo: "Perfil Socioemocional",
      texto:
        "Aspectos socioemocionais que podem estar interferindo no desempenho acadêmico. Recomenda-se trabalhar ansiedade, autoeficácia e persistência através de intervenções específicas.",
    });
  else if (d.socio >= 9)
    out.push({
      titulo: "Perfil Socioemocional",
      texto:
        "Excelente perfil socioemocional. O aluno demonstra boa autoeficácia, persistência adequada e controle de ansiedade, fatores protetivos para o aprendizado.",
    });

  return out;
}
function gerarRecomendacoesTecnicas(d) {
  const r = [];
  if (d.memScore < 7)
    r.push({
      area: "Memória de Trabalho",
      acao: "Implementar técnicas de chunking... prática espaçada.",
    });
  if (d.flexScore < 7)
    r.push({
      area: "Flexibilidade Cognitiva",
      acao: "Atividades com mudança de estratégia e brainstorming.",
    });
  if (d.speedScore < 7)
    r.push({
      area: "Velocidade de Processamento",
      acao: "Exercícios cronometrados, fluência, sem pressão excessiva.",
    });
  if (d.cptScore < 7)
    r.push({
      area: "Atenção Sustentada",
      acao: "Pomodoro, ambiente sem distração, mindfulness.",
    });
  if (d.logicScore < 7)
    r.push({
      area: "Raciocínio Lógico",
      acao: "Padrões/sequências, jogos de estratégia, metacognição.",
    });
  if (d.socio < 6)
    r.push({
      area: "Aspectos Socioemocionais",
      acao: "Mindset de crescimento, regulação emocional, metas incrementais.",
    });
  if (d.litScore <= 1)
    r.push({
      area: "Leitura",
      acao: "Fluência, vocabulário, estratégias de compreensão, leitura compartilhada.",
    });
  if (d.matScore <= 1)
    r.push({
      area: "Matemática",
      acao: "Fatos básicos com materiais concretos, problemas contextualizados.",
    });
  return r;
}

// PDF Simplificado/Técnico
async function gerarPDF() {
  if (!dadosDiagnostico) return alert("⚠️ Gere o diagnóstico primeiro.");
  const versaoTecnica = confirm(
    "Gerar RELATÓRIO TÉCNICO?\nOK = Técnico | Cancelar = Simplificado"
  );
  if (versaoTecnica) return gerarPDFTecnico();
  return gerarPDFSimplificado();
}
async function gerarPDFTecnico() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");
  const alunoNome = el("alunoNome").textContent;
  const dataAtual = new Date().toLocaleDateString("pt-BR");
  let y = 20;

  pdf.setFillColor(102, 126, 234);
  pdf.rect(0, 0, 210, 60, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  pdf.text("RELATÓRIO TÉCNICO", 105, 25, { align: "center" });
  pdf.setFontSize(18);
  pdf.text("Diagnóstico Pedagógico", 105, 35, { align: "center" });
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Aluno: ${alunoNome}`, 105, 45, { align: "center" });
  pdf.text(`Data: ${dataAtual}`, 105, 52, { align: "center" });
  y = 75;
  pdf.setTextColor(0, 0, 0);

  // Resumo
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(102, 126, 234);
  pdf.text("1. SUMÁRIO EXECUTIVO", 20, y);
  y += 10;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(0, 0, 0);
  const d = dadosDiagnostico;
  const resumo = [
    `• Cognitivo: ${d.cogTotal}/50 (${d.norms.cog.level} - P${d.norms.cog.percentile})`,
    `• Socioemocional: ${d.socio}/12`,
    `• Metacognição: ${d.meta}% (${metaQualityLabel(d.meta).t})`,
    `• Leitura: ${d.litScore}/3 (${d.norms.lit.level})`,
    `• Matemática: ${d.matScore}/3 (${d.norms.mat.level})`,
  ];
  resumo.forEach((ln) => {
    pdf.text(ln, 25, y);
    y += 7;
  });
  y += 5;

  // Analítico
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(102, 126, 234);
  pdf.text("2. ANÁLISE COGNITIVA DETALHADA", 20, y);
  y += 10;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(0, 0, 0);
  const comps = [
    { nome: "Memória de Trabalho", score: d.memScore },
    { nome: "Flexibilidade Cognitiva", score: d.flexScore },
    { nome: "Velocidade de Processamento", score: d.speedScore },
    { nome: "Raciocínio Lógico", score: d.logicScore },
    { nome: "Atenção Sustentada (CPT)", score: d.cptScore },
  ];
  comps.forEach((c) => {
    if (y > 250) {
      pdf.addPage();
      y = 30;
    }
    pdf.setFont("helvetica", "bold");
    pdf.text(`${c.nome}: ${c.score}/10`, 25, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    const nivel =
      c.score >= 8
        ? "Superior"
        : c.score >= 6
        ? "Adequado"
        : "Necessita atenção";
    pdf.text(`Nível: ${nivel}`, 30, y);
    y += 8;
  });
  y += 5;

  // Interpretação
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(102, 126, 234);
  pdf.text("3. INTERPRETAÇÃO CLÍNICA", 20, y);
  y += 10;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(0, 0, 0);
  const interps = gerarInterpretacao(d);
  interps.forEach((it) => {
    if (y > 250) {
      pdf.addPage();
      y = 30;
    }
    pdf.setFont("helvetica", "bold");
    pdf.text(`${it.titulo}:`, 25, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(it.texto, 160);
    lines.forEach((ln) => {
      if (y > 270) {
        pdf.addPage();
        y = 30;
      }
      pdf.text(ln, 25, y);
      y += 5;
    });
    y += 5;
  });

  // Recomendações
  if (y > 200) {
    pdf.addPage();
    y = 30;
  }
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(102, 126, 234);
  pdf.text("4. RECOMENDAÇÕES PEDAGÓGICAS", 20, y);
  y += 10;
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(0, 0, 0);
  const recs = gerarRecomendacoesTecnicas(d);
  recs.forEach((r, i) => {
    if (y > 240) {
      pdf.addPage();
      y = 30;
    }
    pdf.setFont("helvetica", "bold");
    pdf.text(`${i + 1}. ${r.area}`, 25, y);
    y += 6;
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(r.acao, 160);
    lines.forEach((ln) => {
      if (y > 270) {
        pdf.addPage();
        y = 30;
      }
      pdf.text(ln, 25, y);
      y += 5;
    });
    y += 5;
  });

  // Rodapé
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Página ${i} de ${totalPages}`, 105, 287, { align: "center" });
    pdf.text("NERD - Sistema de Diagnóstico Pedagógico", 105, 292, {
      align: "center",
    });
  }
  pdf.save(`Relatorio_Tecnico_${alunoNome.replace(/\s+/g, "_")}.pdf`);
}

async function gerarPDFSimplificado() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");
  const alunoNome = el("alunoNome").textContent;
  const dataAtual = new Date().toLocaleDateString("pt-BR");
  let y = 20;

  pdf.setFillColor(102, 126, 234);
  pdf.rect(0, 0, 210, 80, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(32);
  pdf.setFont("helvetica", "bold");
  pdf.text("MEU PERFIL", 105, 35, { align: "center" });
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "normal");
  pdf.text(`${alunoNome}`, 105, 50, { align: "center" });
  pdf.text(`${dataAtual}`, 105, 60, { align: "center" });
  y = 100;
  pdf.setTextColor(0, 0, 0);

  // Pontos fortes
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(76, 175, 80);
  pdf.text("*** MEUS PONTOS FORTES ***", 20, y);
  y += 12;
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(0, 0, 0);

  const d = dadosDiagnostico;
  const fortes = [];
  if (d.memScore >= 7) fortes.push("> Boa memória");
  if (d.flexScore >= 7)
    fortes.push("> Flexível para pensar de formas diferentes");
  if (d.speedScore >= 7) fortes.push("> Rápido para processar informações");
  if (d.cptScore >= 7) fortes.push("> Boa concentração");
  if (d.logicScore >= 7) fortes.push("> Bom raciocínio lógico");
  if (d.litScore >= 2) fortes.push("> Boa leitura");
  if (d.matScore >= 2) fortes.push("> Bom em matemática");
  if (fortes.length === 0)
    fortes.push("> Você tem potencial para crescer em todas as áreas!");

  fortes.forEach((t) => {
    if (y > 260) {
      pdf.addPage();
      y = 30;
    }
    pdf.setFillColor(232, 245, 233);
    pdf.roundedRect(20, y - 8, 170, 12, 3, 3, "F");
    pdf.text(t, 25, y);
    y += 15;
  });

  // Conquistas
  y += 10;
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 152, 0);
  pdf.text("*** CONQUISTAS DESBLOQUEADAS ***", 20, y);
  y += 12;
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(0, 0, 0);

  gerarConquistas(d).forEach((c) => {
    if (y > 260) {
      pdf.addPage();
      y = 30;
    }
    pdf.setFillColor(255, 243, 224);
    pdf.roundedRect(20, y - 8, 170, 12, 3, 3, "F");
    pdf.text(`[+] ${c.texto}`, 25, y);
    y += 15;
  });

  // Desafios
  y += 10;
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(245, 124, 0);
  pdf.text("*** PRÓXIMOS DESAFIOS ***", 20, y);
  y += 12;
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(0, 0, 0);

  gerarDesafios(d).forEach((c) => {
    if (y > 260) {
      pdf.addPage();
      y = 30;
    }
    pdf.setFillColor(255, 243, 224);
    pdf.roundedRect(20, y - 8, 170, 12, 3, 3, "F");
    pdf.text(`[ ] ${c.texto}`, 25, y);
    y += 15;
  });

  // Mensagem
  pdf.addPage();
  pdf.setFillColor(102, 126, 234);
  pdf.rect(0, 0, 210, 297, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  pdf.text("VOCÊ É CAPAZ!", 105, 120, { align: "center" });
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "normal");
  const msg = pdf.splitTextToSize(
    "Continue estudando, praticando e acreditando no seu potencial. Cada erro é uma oportunidade de aprender!",
    160
  );
  let my = 140;
  msg.forEach((ln) => {
    pdf.text(ln, 105, my, { align: "center" });
    my += 8;
  });

  pdf.save(`Meu_Perfil_${alunoNome.replace(/\s+/g, "_")}.pdf`);
}

// ===== Aplicar preset =====
function applyPreset() {
  const p = PRESETS[PRESET];

  // Memória
  el("mem-seq").textContent = p.memSeq.join(", ");
  memScore = 0;
  el("mem-answer").value = "";
  el("mem-conf").value = "";
  el("mem-feedback").classList.add("hidden");

  // Flex
  flexChangesTodo = p.flexChanges;
  flexChangesDone = 0;
  flexStarted = false;
  goNoGoRequired = false;
  const fb = el("flex-btn");
  fb.textContent = "Azul";
  fb.style.background = "#0ea5e9";
  el("flex-changes-label").textContent = String(p.flexChanges);
  el("flex-conf").value = "";
  el("flex-feedback").classList.add("hidden");

  // Velocidade
  scheduleSpeedBox();
  speedScore = 0;
  el("speed-conf").value = "";
  el("speed-feedback").classList.add("hidden");

  // Lógica
  q(".logic-seq").textContent = p.logic.seq;
  const wrap = el("logic-options");
  wrap.innerHTML = "";
  p.logic.options.forEach((v) => {
    const lab = document.createElement("label");
    lab.className = "option";
    lab.innerHTML = `<input type="radio" name="logic" value="${v}">${v}`;
    wrap.appendChild(lab);
  });
  attachOptionUX();
  qa('input[name="logic"]').forEach((r) =>
    r.addEventListener("change", handleLogicChange)
  );
  logicScore = 0;
  el("logic-conf").value = "";
  el("logic-feedback").classList.add("hidden");

  // CPT
  cptTarget = p.cpt.targets[0];
  el("cpt-target-label").textContent = cptTarget;

  // Sondagens
  litLevel = "A";
  litIndex = 0;
  litScore = 0;
  litAnswered = false;
  matLevel = "A";
  matIndex = 0;
  matScore = 0;
  matAnswered = false;
  el("lit-progress").textContent = "Item 0/3";
  el("mat-progress").textContent = "Item 0/3";
  buildLitItem();
  buildMatItem();

  updateProgress();
}

// ===== Navegação =====
function voltarPainel() {
  window.location.href = "painel.html";
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", async () => {
  // Autenticação (usa verificarAuth de auth.js)
  const user = await verificarAuth();
  if (!user) return;

  // Busca perfil do aluno
  const { data: perfil, error } = await supabaseClient
    .from("alunos")
    .select("*")
    .eq("email", user.email)
    .single();

  if (error || !perfil) {
    console.error("Aluno não encontrado na tabela 'alunos':", error);
    alert("Seu usuário não está vinculado a um cadastro de aluno.");
    return;
  }
  aluno = perfil;

  // Nome no topo
  el("alunoNome").textContent = aluno.nome || user.email || "Aluno";

  // Define PRESET (se houver no perfil)
  if (aluno.preset) PRESET = aluno.preset;
  const radio = q(`input[name="preset"][value="${PRESET}"]`);
  if (radio) {
    radio.checked = true;
    radio.closest(".preset-box")?.classList.add("selected");
  }

  startTimer();
  attachOptionUX();
  applyPreset();

  // Listeners
  qa('input[name="preset"]').forEach((r) =>
    r.addEventListener("change", () => {
      PRESET = r.value;
      applyPreset();
    })
  );
  el("mem-check").addEventListener("click", handleMemoryCheck);
  el("flex-btn").addEventListener("click", handleFlexClick);
  el("speed-box").addEventListener("click", handleSpeedClick);
  el("cpt-start").addEventListener("click", startCPT);
  el("generate-btn").addEventListener("click", generateDiagnosis);

  // Upload opcional (somente se existir no HTML)
  const uploadButton = el("upload-btn");
  if (uploadButton) uploadButton.addEventListener("click", uploadFiles);
});

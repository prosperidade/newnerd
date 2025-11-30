// ====================================================================
// DIAGNOSTICO.JS - Refatorado
// ====================================================================

import { PRESETS, NORMS } from './diagnostico-data.js';
import { el, q, qa, clamp, updateProgress, attachOptionUX, showFeedback } from './diagnostico-ui.js';

// ===== Estado global =====
let aluno = null;
let PRESET = "efi";
let startTime = Date.now();
let timerInterval;
let uploadedFiles = [];
let dadosDiagnostico = null;

// Estado de Pontuação (Objeto para facilitar passagem)
const scores = {
    memScore: 0,
    flexScore: 0,
    speedScore: 0,
    logicScore: 0,
    cptScore: 0,
    litScore: 0,
    matScore: 0,
    litAnswered: false,
    matAnswered: false
};

// Variáveis de controle interno
let confMem = 0, confFlex = 0, confSpeed = 0, confLogic = 0;
let litLevel = "A", litIndex = 0;
let matLevel = "A", matIndex = 0;

// Estados dos testes específicos
let flexStarted = false, flexChangesDone = 0, flexChangesTodo = 1;
let goNoGoRequired = false, goNoGoOk = false;
let speedStart = 0, speedReaction = 0;
let cptRunning = false, cptStimIdx = 0, cptHits = 0, cptFalse = 0;
let cptRt = [], cptStimuli = [], cptTarget = "X", cptPressArmed = false;
let cptOnset = 0, cptRespWindowMs = 500;
let radarChart = null;

// ===== FUNÇÕES DE TESTE =====

// --- Memória ---
function memCorrectSum() {
  return PRESETS[PRESET].memSeq
    .filter((n) => n % 2 === 0)
    .reduce((a, b) => a + b, 0);
}

function handleMemoryCheck() {
  const ans = parseInt(el("mem-answer").value);
  confMem = clamp(parseInt(el("mem-conf").value) || 0, 0, 100);
  const correct = memCorrectSum();

  if (ans === correct) {
    scores.memScore = 10;
    showFeedback("mem-feedback", "✅ Correto!", "success");
  } else {
    scores.memScore = 4;
    showFeedback("mem-feedback", "❌ Correto: " + correct, "error");
  }
  updateProgress(scores);
}

// --- Flexibilidade ---
function handleFlexClick() {
  const btn = el("flex-btn");

  if (!flexStarted) {
    flexStarted = true;
    showFeedback("flex-feedback", "Aguarde as mudanças...", "");
    setTimeout(() => advanceFlexRule(btn), 700 + Math.random() * 700);
  } else {
    confFlex = clamp(parseInt(el("flex-conf").value) || 0, 0, 100);
    if (goNoGoRequired) {
      goNoGoOk = false;
      scores.flexScore = 4;
      showFeedback("flex-feedback", "❌ Inibição falhou (clicou no vermelho)", "error");
    } else {
      scores.flexScore = 10;
      showFeedback("flex-feedback", "✅ Flexibilidade OK!", "success");
    }
    updateProgress(scores);
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
        scores.flexScore = 10;
        showFeedback("flex-feedback", "✅ Inibição OK (não clicou)", "success");
        updateProgress(scores);
      }
      goNoGoRequired = false;
    }, 1500);
  }
}

// --- Velocidade ---
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
    showFeedback("speed-feedback", `⏱️ Tempo: ${speedReaction} ms`, "");

    confSpeed = clamp(parseInt(el("speed-conf").value) || 0, 0, 100);
    const [good, ok] = PRESETS[PRESET].speedBands;
    scores.speedScore = speedReaction < good ? 10 : speedReaction < ok ? 8 : 5;

    updateProgress(scores);
    scheduleSpeedBox();
  }
}

// --- CPT (Atenção) ---
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
  scores.cptScore = Math.max(
    3,
    Math.min(10, Math.round(acc / 10 - cptFalse * 0.25 - rtMean / 900))
  );
  showFeedback("cpt-feedback", `Precisão: ${acc.toFixed(0)}% · Falsos: ${cptFalse} · TR: ${rtMean}ms`, "");
  updateProgress(scores);
}

// --- Lógica ---
function handleLogicChange(ev) {
  confLogic = clamp(parseInt(el("logic-conf").value) || 0, 0, 100);
  const v = parseInt(ev.target.value);
  const correct = PRESETS[PRESET].logic.correct;

  if (v === correct) {
    scores.logicScore = 10;
    showFeedback("logic-feedback", "✅ Correto!", "success");
  } else {
    scores.logicScore = 4;
    showFeedback("logic-feedback", "❌ Pense no padrão", "error");
  }
  updateProgress(scores);
}

// --- Fallback local para itens ---
function pickItem(area, level) {
  const bank = PRESETS[PRESET][area]?.[level];
  if (!bank || bank.length === 0)
    return { stem: "—", opts: ["A", "B", "C", "D"], ans: 0 };
  return bank[Math.floor(Math.random() * bank.length)];
}

// --- Leitura ---
async function buildLitItem() {
  const wrap = el("lit-opts");
  const nextBtn = el("lit-next");
  if(!wrap || !nextBtn) return;

  wrap.innerHTML = '<div style="text-align:center; padding:20px;">Carregando questão…</div>';
  nextBtn.disabled = true;
  el("lit-feedback").classList.add("hidden");

  // Usando fallback local sempre por enquanto para estabilidade
  const item = pickItem("lit", litLevel);

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

    if (chosen === item.ans) {
      scores.litScore++;
      showFeedback("lit-feedback", "✅ Correto!", "success");
      if (litLevel === "A") litLevel = "B";
      else if (litLevel === "B") litLevel = "C";
    } else {
      showFeedback("lit-feedback", "❌ Incorreto", "error");
    }

    litIndex++;
    el("lit-progress").textContent = `Item ${litIndex}/3`;
    if (litIndex < 3) setTimeout(buildLitItem, 500);
    else {
      scores.litAnswered = true;
      nextBtn.disabled = true;
      updateProgress(scores);
    }
  };
}

// --- Matemática ---
async function buildMatItem() {
  const wrap = el("mat-opts");
  const nextBtn = el("mat-next");
  if(!wrap || !nextBtn) return;

  wrap.innerHTML = '<div style="text-align:center; padding:20px;">Carregando questão…</div>';
  nextBtn.disabled = true;
  el("mat-feedback").classList.add("hidden");

  const item = pickItem("mat", matLevel);

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

    if (chosen === item.ans) {
      scores.matScore++;
      showFeedback("mat-feedback", "✅ Correto!", "success");
      if (matLevel === "A") matLevel = "B";
      else if (matLevel === "B") matLevel = "C";
    } else {
      showFeedback("mat-feedback", "❌ Incorreto", "error");
    }

    matIndex++;
    el("mat-progress").textContent = `Item ${matIndex}/3`;
    if (matIndex < 3) setTimeout(buildMatItem, 500);
    else {
      scores.matAnswered = true;
      nextBtn.disabled = true;
      updateProgress(scores);
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
  const pts = [scores.memScore, scores.flexScore, scores.speedScore, scores.logicScore, scores.cptScore];
  const conf = [
    confMem,
    confFlex,
    confSpeed,
    confLogic,
    (confMem + confFlex + confSpeed + confLogic) / 4 || 50,
  ].map((c) => c / 10);
  let dif = 0, n = 0;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i] > 0) {
      dif += Math.abs(pts[i] - conf[i]);
      n++;
    }
  }
  const calib = Math.max(0, 100 - (dif * (100 / (n * 10)) * 100) / 100);
  return isFinite(calib) ? Math.min(100, Math.round(calib)) : 0;
}

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

function metaQualityLabel(p) {
  if (p >= 75) return { t: "Subconfiante?", c: "badge-adequado" };
  if (p >= 45 && p <= 65) return { t: "Bem calibrado", c: "badge-avancado" };
  return { t: "Superconfiante?", c: "badge-atencao" };
}

// ===== Geração do Diagnóstico =====
async function generateDiagnosis() {
  const required = ["motivation", "mindset", "anxiety", "efficacy", "persistence"];
  const ok = required.every((n) => q(`input[name="${n}"]:checked`));

  if (!ok || scores.memScore === 0 || scores.flexScore === 0 || scores.speedScore === 0 ||
      scores.logicScore === 0 || scores.cptScore === 0 || !scores.litAnswered || !scores.matAnswered) {
    alert("Complete todos os testes: cognitivo, sondagens e socioemocional.");
    return;
  }

  const cogTotal = scores.memScore + scores.flexScore + scores.speedScore + scores.logicScore + scores.cptScore;
  const socio = socioScore();
  const meta = metacogCalibration();
  const metaQ = metaQualityLabel(meta);

  const ncfg = NORMS[PRESET];
  const cogClass = classify(cogTotal, ncfg.cognitive);
  const litClass = classify(scores.litScore, ncfg.reading);
  const matClass = classify(scores.matScore, ncfg.math);

  dadosDiagnostico = {
    preset: PRESET,
    ...scores,
    cogTotal,
    socio,
    meta,
    norms: { cog: cogClass, lit: litClass, mat: matClass },
  };

  // Render UI
  el("cog-score").textContent = cogTotal;
  el("socio-score").textContent = socio;
  el("meta-score").textContent = meta + "%";
  const mq = el("meta-qual");
  mq.textContent = metaQ.t;
  mq.className = "badge " + metaQ.c;
  el("lit-score").textContent = scores.litScore;
  el("mat-score").textContent = scores.matScore;

  el("cog-norm").innerHTML = `<span class="badge ${cogClass.badgeClass}">${cogClass.level}</span> · P${cogClass.percentile}`;
  el("lit-norm").innerHTML = `<span class="badge ${litClass.badgeClass}">${litClass.level}</span> · P${litClass.percentile}`;
  el("mat-norm").innerHTML = `<span class="badge ${matClass.badgeClass}">${matClass.level}</span> · P${matClass.percentile}`;

  // Radar Chart
  const socioN = Math.round((socio / 12) * 10);
  const metaN = Math.round(meta / 10);
  const ctx = el("radar-canvas").getContext("2d");
  if (radarChart) radarChart.destroy();

  radarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["Memória", "Flexibilidade", "Velocidade", "Atenção", "Socioemocional", "Metacognição"],
      datasets: [{
        label: "Pontuação",
        data: [scores.memScore, scores.flexScore, scores.speedScore, scores.cptScore, socioN, metaN],
        backgroundColor: "rgba(102,126,234,0.3)",
        borderColor: "#667eea",
        pointBackgroundColor: "#667eea",
        pointBorderColor: "#fff",
        pointRadius: 5,
      }],
    },
    options: {
      scales: { r: { min: 0, max: 10, ticks: { stepSize: 2 } } },
      plugins: { legend: { display: false } },
    },
  });

  // Recomendações UI
  const recs = [];
  if (scores.memScore < 7) recs.push(["🧠 Memória", "Chunking e exemplos concretos"]);
  if (scores.flexScore < 7) recs.push(["🔄 Flexibilidade", "Resolver por duas rotas diferentes"]);
  if (scores.speedScore < 7) recs.push(["⚡ Velocidade", "Sprints cronometrados de 2-3 min"]);
  if (scores.cptScore < 7) recs.push(["🎯 Atenção", "Pomodoro e reduzir distrações"]);
  if (scores.logicScore < 7) recs.push(["🧩 Lógica", "Treinar padrões e progressões"]);
  if (scores.litScore <= 1) recs.push(["📖 Leitura", "Fluência + vocabulário básico"]);
  if (scores.matScore <= 1) recs.push(["🔢 Matemática", "Fatos básicos com representação visual"]);

  el("recommendations").innerHTML = recs.map(([t, c]) =>
    `<div class="strategy-item" style="background:#f8f9fa;padding:12px;border-radius:8px;border-left:4px solid #667eea;"><strong>${t}</strong><br>${c}</div>`
  ).join("");

  await salvarDiagnostico(dadosDiagnostico);

  el("results-panel").classList.remove("hidden");
  el("results-panel").scrollIntoView({ behavior: "smooth" });
}

async function salvarDiagnostico(dados) {
  if(!aluno?.id) return;
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
    const { error } = await window.supabaseClient.from("diagnosticos_alunos").insert(payload);
    if (error) console.error("Erro ao salvar diagnóstico:", error);
  } catch (err) {
    console.error("Erro ao salvar:", err);
  }
}

// ===== Timer =====
function startMainTimer() {
  timerInterval = setInterval(() => {
    const t = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(t / 60)).padStart(2, "0");
    const s = String(t % 60).padStart(2, "0");
    el("timer").textContent = `Tempo: ${m}:${s}`;
  }, 1000);
}

// ===== Inicialização =====
function applyPreset() {
  const p = PRESETS[PRESET];

  // Memória
  el("mem-seq").textContent = p.memSeq.join(", ");
  scores.memScore = 0;
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
  scores.speedScore = 0;
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
  scores.logicScore = 0;
  el("logic-conf").value = "";
  el("logic-feedback").classList.add("hidden");

  // CPT
  cptTarget = p.cpt.targets[0];
  el("cpt-target-label").textContent = cptTarget;

  // Sondagens
  litLevel = "A"; litIndex = 0; scores.litScore = 0; scores.litAnswered = false;
  matLevel = "A"; matIndex = 0; scores.matScore = 0; scores.matAnswered = false;

  el("lit-progress").textContent = "Item 0/3";
  el("mat-progress").textContent = "Item 0/3";
  buildLitItem();
  buildMatItem();

  updateProgress(scores);
}

document.addEventListener("DOMContentLoaded", async () => {
  aluno = await verificarAuth();
  if (!aluno) return;
  el("alunoNome").textContent = aluno.nome || aluno.email || "Aluno";

  if (aluno.preset) PRESET = aluno.preset;
  const radio = q(`input[name="preset"][value="${PRESET}"]`);
  if (radio) {
    radio.checked = true;
    radio.closest(".preset-box")?.classList.add("selected");
  }

  startMainTimer();
  attachOptionUX();
  applyPreset();

  // Event Listeners
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

  // PDF functions attached to window for onclick in HTML
  // (Assume pdf functions are imported or defined here if used by buttons)
});

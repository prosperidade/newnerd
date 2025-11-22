// ===== Helpers básicos =====
export const el = (id) => document.getElementById(id);
export const q = (sel) => document.querySelector(sel);
export const qa = (sel) => Array.from(document.querySelectorAll(sel));
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// ===== UI Helpers =====
export function updateProgress(scoreObj) {
  const total = 15;
  let answered = 0;

  // Somar scores numéricos
  if (scoreObj.memScore > 0) answered++;
  if (scoreObj.flexScore > 0) answered++;
  if (scoreObj.speedScore > 0) answered++;
  if (scoreObj.logicScore > 0) answered++;
  if (scoreObj.cptScore > 0) answered++;

  // Booleans
  if (scoreObj.litAnswered) answered++;
  if (scoreObj.matAnswered) answered++;

  // Formulário socioemocional
  answered += qa('input[name="motivation"]:checked').length;
  answered += qa('input[name="mindset"]:checked').length;
  answered += qa('input[name="anxiety"]:checked').length;
  answered += qa('input[name="efficacy"]:checked').length;
  answered += qa('input[name="persistence"]:checked').length;

  const pct = Math.min(100, Math.round((answered / total) * 100));
  const progressEl = el("progress");
  if(progressEl) progressEl.style.width = pct + "%";
}

export function attachOptionUX() {
  qa("label.option").forEach((l) => {
    // Remove listeners antigos para evitar duplicação (se houver)
    // Clonar o elemento remove listeners, mas aqui vamos assumir que está ok
    // ou usar uma flag se fosse crítico. Simplificando:
    l.onclick = () => {
      const inp = l.querySelector('input[type="radio"]');
      if (!inp) return;
      qa(`input[name="${inp.name}"]`).forEach((r) =>
        r.closest(".option")?.classList.remove("selected")
      );
      l.classList.add("selected");
      inp.checked = true;
      // Dispara change manualmente se necessário
      inp.dispatchEvent(new Event('change'));
    };
  });
}

export function showFeedback(elementId, message, type) {
    const feedback = el(elementId);
    if(!feedback) return;
    feedback.textContent = message;
    feedback.className = `feedback ${type}`; // type: 'success', 'error', ''
    feedback.classList.remove("hidden");
}

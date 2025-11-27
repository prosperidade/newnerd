// js/theme.js
(() => {
  const STORAGE_KEY = "nn-theme";

  // cria (ou recupera) um único botão; ignora o do live-server
  function ensureButton() {
    let btn = document.getElementById("themeToggle");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "themeToggle";
      btn.type = "button";
      btn.title = "Alternar tema";
      btn.className = "theme-toggle";
      document.body.appendChild(btn);
    }
    return btn;
  }

  function setIcon(btn, theme) {
    if (!btn) return;
    // Emoji = sempre aparece (sem CDN)
    btn.textContent = theme === "dark" ? "☀️" : "🌙";
    btn.setAttribute(
      "aria-label",
      theme === "dark" ? "Tema claro" : "Tema escuro"
    );
  }

  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    setIcon(document.getElementById("themeToggle"), theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  function toggleTheme() {
    const cur = document.body.getAttribute("data-theme") || "light";
    applyTheme(cur === "dark" ? "light" : "dark");
  }

  function init() {
    // remove o botão do live-server se existir (evita conflito visual)
    const injected = document.getElementById("nn-theme-toggle");
    if (injected && injected.parentElement) {
      injected.parentElement.removeChild(injected);
    }

    const btn = ensureButton();
    btn.onclick = toggleTheme;

    let theme = localStorage.getItem(STORAGE_KEY);
    if (!theme) {
      const prefersDark =
        globalThis.matchMedia &&
        globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
      theme = prefersDark ? "dark" : "light";
    }
    applyTheme(theme);
  }

  document.addEventListener("DOMContentLoaded", init);
})();

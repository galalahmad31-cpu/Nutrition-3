/* Diet Planner — global Light / Dark mode */
(() => {
  "use strict";

  const STORAGE_KEY = "diet-planner-theme";

  function getStoredTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;

    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    const safeTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", safeTheme);

    const button = document.getElementById("dp-theme-toggle");
    if (!button) return;

    const isDark = safeTheme === "dark";
    button.textContent = isDark ? "☀️" : "🌙";
    button.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode"
    );
    button.setAttribute(
      "title",
      isDark ? "Light mode" : "Dark mode"
    );
  }

  function createToggle() {
    if (document.getElementById("dp-theme-toggle")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.id = "dp-theme-toggle";
    button.className = "dp-theme-toggle";
    button.addEventListener("click", () => {
      const next =
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "light"
          : "dark";

      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    });

    document.body.appendChild(button);
    applyTheme(document.documentElement.getAttribute("data-theme") || getStoredTheme());
  }

  // Apply before the page is fully painted when possible.
  applyTheme(getStoredTheme());

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createToggle, { once: true });
  } else {
    createToggle();
  }
})();

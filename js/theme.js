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

  function updateColorSchemeMeta(theme) {
    const safeTheme = theme === "dark" ? "dark" : "light";
    let meta = document.querySelector('meta[name="color-scheme"]');

    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "color-scheme";
      document.head.appendChild(meta);
    }

    meta.content = safeTheme === "dark" ? "dark light" : "light dark";
    document.documentElement.style.colorScheme = safeTheme;
  }

  function updateThemeColorMeta(theme) {
    const safeTheme = theme === "dark" ? "dark" : "light";
    let meta = document.querySelector('meta[name="theme-color"]');

    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }

    meta.content = safeTheme === "dark" ? "#0d1514" : "#f7fafb";
  }

  function applyTheme(theme) {
    const safeTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", safeTheme);
    updateColorSchemeMeta(safeTheme);
    updateThemeColorMeta(safeTheme);

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
    if (document.getElementById("dp-theme-toggle")) {
      applyTheme(document.documentElement.getAttribute("data-theme") || getStoredTheme());
      return;
    }

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

  function syncSystemTheme(event) {
    if (localStorage.getItem(STORAGE_KEY)) return;
    applyTheme(event.matches ? "dark" : "light");
  }

  // Apply before the page is fully painted when possible.
  applyTheme(getStoredTheme());

  const colorSchemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  colorSchemeQuery?.addEventListener?.("change", syncSystemTheme);

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;

    if (event.newValue === "dark" || event.newValue === "light") {
      applyTheme(event.newValue);
      return;
    }

    applyTheme(getStoredTheme());
  });

  window.DietPlannerTheme = {
    get: () => document.documentElement.getAttribute("data-theme") || getStoredTheme(),
    set: (theme) => {
      const next = theme === "dark" ? "dark" : "light";
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    },
    toggle: () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createToggle, { once: true });
  } else {
    createToggle();
  }
})();

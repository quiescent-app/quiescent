import { useState } from "react";

const themeKey = "quiescent-landing-theme";

function getInitialTheme() {
  try {
    const savedTheme = window.localStorage.getItem(themeKey);
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  } catch {
    // The theme still works for this visit when storage is unavailable.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function usePublicTheme() {
  const [theme, setTheme] = useState(getInitialTheme);
  const nextTheme = theme === "dark" ? "light" : "dark";

  function toggleTheme() {
    setTheme(nextTheme);
    try {
      window.localStorage.setItem(themeKey, nextTheme);
    } catch {
      // Storage is optional for switching the current view.
    }
  }

  return { theme, nextTheme, toggleTheme };
}

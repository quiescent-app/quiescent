import { useState } from "react";

const APPEARANCE_KEY = "quiescent.appearance";

function readSavedDark() {
  try {
    return localStorage.getItem(APPEARANCE_KEY) === "dark";
  } catch {
    return false;
  }
}

// Light/dark choice shared by every page that uses the .q-theme palette
export function useAppearance() {
  const [dark, setDark] = useState(readSavedDark);

  function toggle() {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem(APPEARANCE_KEY, next ? "dark" : "light");
    } catch {
      // The page can still switch appearance when storage is blocked.
    }
  }

  return { dark, toggle };
}

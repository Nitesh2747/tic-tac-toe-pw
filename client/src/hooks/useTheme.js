import { useEffect, useState } from "react";

const KEY = "ttt-theme";
const META_COLORS = { light: "#eef2f1", dark: "#10151b" };

// localStorage can throw (private mode, blocked storage): never let that break the app.
function readStored() {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  // index.html already set data-theme before React started, so start from that.
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || readStored() || systemTheme()
  );

  // Push the theme to the page: the CSS reacts to the data-theme attribute.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", META_COLORS[theme]);
  }, [theme]);

  // Until the user picks a theme themselves, follow the operating system.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange(event) {
      if (!readStored()) setTheme(event.matches ? "dark" : "light");
    }
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* the theme still changes for this visit */
    }
    setTheme(next);
  }

  return { theme, toggle };
}

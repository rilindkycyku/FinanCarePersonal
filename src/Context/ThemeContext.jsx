import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const THEME_KEY = "financarepersonal-theme";
const ThemeContext = createContext(null);

// The colour a phone paints its address bar and task-switcher card with. index.html ships the dark
// one; switching to the light theme used to leave a black bar sitting above a white page.
const THEME_COLORS = { dark: "#080f1a", light: "#f1f5f9" };

function readInitialTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Toggles `body.light-mode`, which activates the light-theme CSS variable overrides already
 * defined in PremiumTheme.css. Persisted to localStorage; index.html applies the saved choice
 * before React mounts so there's no flash of the wrong theme. */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme);

  useEffect(() => {
    document.body.classList.toggle("light-mode", theme === "light");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* localStorage unavailable - theme still applies for this session */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

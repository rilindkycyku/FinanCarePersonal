import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const THEME_KEY = "financarepersonal-theme";
const ThemeContext = createContext(null);

// The colour a phone paints its address bar and task-switcher card with. index.html ships the dark
// one; switching to the light theme used to leave a black bar sitting above a white page.
const THEME_COLORS = { dark: "#080f1a", light: "#f1f5f9" };

/** The three things the preference can be. "sistemi" is the default for a browser that has never
 * been told otherwise, so a phone on automatic dark/light is followed rather than overruled - the
 * app used to open dark on a device set to light and stay there until somebody found the toggle. */
const TEMAT = ["sistemi", "dark", "light"];

const MEDIA = "(prefers-color-scheme: dark)";

/** What the operating system is asking for right now. Guarded because `matchMedia` is missing in a
 * handful of embedded webviews, where "no answer" has to mean the app's own default. */
function temaESistemit() {
  try {
    return window.matchMedia?.(MEDIA).matches === false ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** The preference as stored. Anything unrecognised - including the absence of a value - is the
 * system, which is also how a browser that predates this arrives: it holds "dark" or "light" only
 * if the user actually chose one, and that choice is still honoured. */
function lexoPreferencen() {
  try {
    const ruajtur = localStorage.getItem(THEME_KEY);
    return TEMAT.includes(ruajtur) ? ruajtur : "sistemi";
  } catch {
    return "sistemi";
  }
}

/**
 * Toggles `body.light-mode`, which activates the light-theme CSS variable overrides already
 * defined in PremiumTheme.css. The preference is persisted to localStorage; index.html applies the
 * same rule before React mounts so there's no flash of the wrong theme.
 *
 * `tema` is what the user chose ("sistemi" | "dark" | "light") and `theme` is what is actually on
 * screen - they differ exactly while the choice is "sistemi", and the two are kept apart because
 * the settings page has to say which of the three is selected, not merely which one is showing.
 */
export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(lexoPreferencen);
  const [sistemi, setSistemi] = useState(temaESistemit);

  // The OS switching over at sunset has to reach a tab that is already open, which is the whole
  // point of following it: a listener, not a reading taken once at startup.
  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia?.(MEDIA);
    } catch {
      return undefined;
    }
    if (!mq?.addEventListener) return undefined;
    const ndrysho = (e) => setSistemi(e.matches ? "dark" : "light");
    mq.addEventListener("change", ndrysho);
    return () => mq.removeEventListener("change", ndrysho);
  }, []);

  const theme = tema === "sistemi" ? sistemi : tema;

  useEffect(() => {
    document.body.classList.toggle("light-mode", theme === "light");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  }, [theme]);

  useEffect(() => {
    try {
      // "sistemi" is stored as the absence of a choice, so a browser opening the app for the first
      // time and one that was explicitly set back to automatic behave identically.
      if (tema === "sistemi") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, tema);
    } catch {
      /* localStorage unavailable - the theme still applies for this session */
    }
  }, [tema]);

  // Kept for the navbar button, where there is room for one tap and not for three choices: it
  // moves to the opposite of what is on screen, which turns an automatic theme into a deliberate
  // one. Cilësimet is where "follow the system" is picked back up.
  const toggleTheme = useCallback(
    () => setTema(theme === "dark" ? "light" : "dark"),
    [theme]
  );

  const value = useMemo(
    () => ({ theme, tema, sistemi, setTema, toggleTheme }),
    [theme, tema, sistemi, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

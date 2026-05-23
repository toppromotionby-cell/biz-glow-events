import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type ThemeMode = "dark" | "light" | "auto";

const STORAGE_KEY = "site-theme";

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode === "auto") return getSystemTheme();
  return mode;
}

function applyResolvedTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  root.classList.remove("theme-dark", "theme-light");
  root.classList.add(resolved === "light" ? "theme-light" : "theme-dark");
  root.dataset.theme = mode;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>("auto");
  const [resolved, setResolved] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  // Initial read from localStorage
  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "auto";
    setMode(saved);
    const initialResolved = resolveTheme(saved);
    setResolved(initialResolved);
    applyResolvedTheme(saved);
    setMounted(true);
  }, []);

  // Apply theme and persist when mode changes
  useEffect(() => {
    if (!mounted) return;
    const nextResolved = resolveTheme(mode);
    setResolved(nextResolved);
    applyResolvedTheme(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  }, [mode, mounted]);

  // Listen to system theme changes when in auto mode
  useEffect(() => {
    if (!mounted || mode !== "auto") return;
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e: MediaQueryListEvent) => {
      const next = e.matches ? "light" : "dark";
      setResolved(next);
      applyResolvedTheme("auto");
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode, mounted]);

  const btnBase = "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors";
  const btnInactive = "text-muted-foreground hover:text-foreground hover:bg-primary/10";
  const btnActive = "bg-gradient-primary text-primary-foreground shadow-sm";

  if (!mounted) {
    return (
      <div className={`inline-flex h-8 items-center rounded-lg border border-border bg-surface-2 p-0.5 gap-0.5 ${className}`}>
        <span className={`${btnBase} opacity-40`}><Moon className="h-3.5 w-3.5" /></span>
        <span className={`${btnBase} opacity-40`}><Sun className="h-3.5 w-3.5" /></span>
        <span className={`${btnBase} opacity-40`}><Monitor className="h-3.5 w-3.5" /></span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex h-8 items-center rounded-lg border border-border bg-surface-2 p-0.5 gap-0.5 ${className}`}
      role="radiogroup"
      aria-label="Переключение темы"
    >
      <button
        type="button"
        aria-label="Тёмная тема"
        aria-checked={mode === "dark"}
        role="radio"
        onClick={() => setMode("dark")}
        className={`${btnBase} ${mode === "dark" ? btnActive : btnInactive}`}
        title="Тёмная"
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Светлая тема"
        aria-checked={mode === "light"}
        role="radio"
        onClick={() => setMode("light")}
        className={`${btnBase} ${mode === "light" ? btnActive : btnInactive}`}
        title="Светлая"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Авто (системная тема)"
        aria-checked={mode === "auto"}
        role="radio"
        onClick={() => setMode("auto")}
        className={`${btnBase} ${mode === "auto" ? btnActive : btnInactive}`}
        title="Авто"
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Inline script to set theme class before hydration to prevent flash. */
export const themeBootstrapScript = `(function(){
  try{
    var t = localStorage.getItem('${STORAGE_KEY}') || 'auto';
    var isLight = t === 'light' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
    var r = document.documentElement;
    r.classList.remove('theme-dark','theme-light');
    r.classList.add(isLight ? 'theme-light' : 'theme-dark');
    r.dataset.theme = t;
  }catch(e){}
})();`;

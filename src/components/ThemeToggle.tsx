import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";
const STORAGE_KEY = "site-theme";

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("theme-dark", "theme-light");
  root.classList.add(t === "light" ? "theme-light" : "theme-dark");
  root.dataset.theme = t;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "dark";
    setTheme(saved);
    applyTheme(saved);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  };

  const isLight = mounted && theme === "light";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? "Переключить на тёмную тему" : "Переключить на светлую тему"}
      onClick={toggle}
      className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full border border-border bg-surface-2 transition-colors hover:bg-primary/10 ${className}`}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow transition-transform ${
          isLight ? "translate-x-8" : "translate-x-1"
        }`}
      >
        {isLight ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
      </span>
    </button>
  );
}

/** Inline script to set theme class before hydration to prevent flash. */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'dark';var r=document.documentElement;r.classList.remove('theme-dark','theme-light');r.classList.add(t==='light'?'theme-light':'theme-dark');r.dataset.theme=t;}catch(e){}})();`;

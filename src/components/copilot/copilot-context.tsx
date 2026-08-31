// Контекст страницы для помощника: какой раздел открыт и какая запись в фокусе.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import type { CopilotContext } from "@/lib/copilot/types";

interface Focus {
  recordType: string;
  recordId: string;
  recordLabel?: string;
}

interface Value {
  context: CopilotContext;
  open: boolean;
  setOpen: (v: boolean) => void;
  prefill: string;
  ask: (text: string) => void;
  clearPrefill: () => void;
  setFocus: (focus: Focus | null) => void;
}

const Ctx = createContext<Value | null>(null);

const SECTION_LABEL: [RegExp, string][] = [
  [/^\/admin\/orders/, "Заявки"],
  [/^\/admin\/quotes/, "Коммерческие предложения"],
  [/^\/admin\/promo/, "КП по промо"],
  [/^\/admin\/catalog/, "Каталог"],
  [/^\/admin\/content/, "Контент сайта"],
  [/^\/admin\/mail/, "Почта"],
  [/^\/admin\/marketing/, "Маркетинг и рассылки"],
  [/^\/admin\/paperwork/, "Документы"],
  [/^\/admin\/planner/, "Планер"],
  [/^\/admin\/dj/, "DJ Hub"],
  [/^\/admin\/knowledge/, "Информационная база"],
  [/^\/admin\/settings/, "Настройки"],
  [/^\/admin\/?$/, "Дашборд"],
];

export function CopilotContextProvider({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState("");
  const [focus, setFocus] = useState<Focus | null>(null);

  // Смена страницы сбрасывает фокус записи — иначе помощник «помнит» чужую заявку.
  useEffect(() => {
    setFocus(null);
  }, [loc.pathname]);

  const value = useMemo<Value>(() => {
    const section = SECTION_LABEL.find(([re]) => re.test(loc.pathname))?.[1] ?? "Админ-панель";
    return {
      context: { path: loc.pathname, section, ...(focus ?? {}) },
      open,
      setOpen,
      prefill,
      ask: (text: string) => {
        setPrefill(text);
        setOpen(true);
      },
      clearPrefill: () => setPrefill(""),
      setFocus,
    };
  }, [loc.pathname, open, prefill, focus]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCopilot(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCopilot must be used inside CopilotContextProvider");
  return v;
}

/** Регистрирует открытую запись, чтобы помощник понимал «эта заявка». */
export function useCopilotFocus(focus: Focus | null): void {
  const { setFocus } = useCopilot();
  const key = focus ? `${focus.recordType}:${focus.recordId}:${focus.recordLabel ?? ""}` : "";
  useEffect(() => {
    setFocus(focus);
    return () => setFocus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setFocus]);
}

// Глобальные текстовые переопределения.
// Админ может дважды кликнуть по любому тексту на сайте и переименовать его.
// Shift+двойной клик — сбросить переименование к оригиналу.
// Шрифты, размеры и стили не меняются — заменяется только текст.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-roles";
import { toast } from "sonner";

type Overrides = Record<string, string>;
const Ctx = createContext<Overrides>({});

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export function TextOverridesProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Overrides>({});
  const { has } = useRoles();
  const isAdmin = has("admin");
  const mapRef = useRef<Overrides>({});
  mapRef.current = map;

  // Загрузка и realtime
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("text_overrides").select("original_text, override_text");
      if (cancelled || !data) return;
      const next: Overrides = {};
      data.forEach((r: any) => { next[r.original_text] = r.override_text; });
      setMap(next);
    })();
    const ch = supabase
      .channel("text_overrides_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "text_overrides" }, (payload) => {
        const row = (payload.new ?? payload.old) as { original_text: string; override_text?: string } | null;
        if (!row?.original_text) return;
        setMap((prev) => {
          const next = { ...prev };
          if (payload.eventType === "DELETE") delete next[row.original_text];
          else if (row.override_text) next[row.original_text] = row.override_text;
          return next;
        });
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);

  // Применение к DOM
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => {
      const m = mapRef.current;
      if (!Object.keys(m).length) return;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          const p = n.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = p.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || p.isContentEditable) return NodeFilter.FILTER_REJECT;
          if (p.closest("[data-no-text-override]")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const nodes: Text[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) nodes.push(n as Text);
      nodes.forEach((tn) => {
        const original = tn.textContent ?? "";
        const key = norm(original);
        if (!key) return;
        const repl = m[key];
        if (repl == null) {
          // Возможно, ранее переименовали — восстановим, если есть оригинал
          const orig = (tn as any).__lovableOriginal as string | undefined;
          if (orig && tn.textContent !== orig) tn.textContent = orig;
          return;
        }
        if (tn.textContent === repl) return;
        if (!(tn as any).__lovableOriginal) (tn as any).__lovableOriginal = original;
        // Сохраняем ведущие/замыкающие пробелы оригинала
        const lead = original.match(/^\s*/)?.[0] ?? "";
        const tail = original.match(/\s*$/)?.[0] ?? "";
        tn.textContent = `${lead}${repl}${tail}`;
      });
    };
    apply();
    const obs = new MutationObserver(() => {
      // throttle через rAF
      requestAnimationFrame(apply);
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [map]);

  // Двойной клик — редактирование (только админ)
  useEffect(() => {
    if (!isAdmin || typeof window === "undefined") return;
    const onDbl = async (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Пропускаем форменные элементы
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      if (target.closest("[data-no-text-override]")) return;
      // Берём ближайший текстовый узел с непустым содержимым
      const text = (target.textContent ?? "").trim();
      if (!text || text.length > 500) return;
      // Если кликнули по контейнеру с детьми-элементами, попробуем взять только прямой текст
      let directText = "";
      target.childNodes.forEach((c) => { if (c.nodeType === Node.TEXT_NODE) directText += c.textContent ?? ""; });
      const baseText = norm(directText) || text;
      const m = mapRef.current;
      // Найдём оригинальный ключ: ищем сохранённый, иначе нормализованный текущий
      const existingOriginal = Object.entries(m).find(([, v]) => norm(v) === baseText)?.[0];
      const originalKey = existingOriginal ?? baseText;

      e.preventDefault();
      e.stopPropagation();

      if (e.shiftKey && existingOriginal) {
        // Сброс
        const { error } = await supabase.from("text_overrides").delete().eq("path", "*").eq("original_text", originalKey);
        if (error) toast.error("Не удалось сбросить: " + error.message);
        else toast.success("Текст возвращён к оригиналу");
        return;
      }

      const current = m[originalKey] ?? originalKey;
      const next = window.prompt(`Переименовать текст (Shift+двойной клик — сброс):\n\nОригинал: ${originalKey}`, current);
      if (next == null) return;
      const cleaned = next.trim();
      if (!cleaned) {
        toast.error("Текст не может быть пустым");
        return;
      }
      if (cleaned === originalKey) {
        // По сути сброс
        const { error } = await supabase.from("text_overrides").delete().eq("path", "*").eq("original_text", originalKey);
        if (error) toast.error("Ошибка: " + error.message);
        else toast.success("Переименование удалено");
        return;
      }
      const { error } = await supabase
        .from("text_overrides")
        .upsert({ path: "*", original_text: originalKey, override_text: cleaned }, { onConflict: "path,original_text" });
      if (error) toast.error("Не сохранено: " + error.message);
      else toast.success("Переименовано");
    };
    document.addEventListener("dblclick", onDbl, true);
    return () => document.removeEventListener("dblclick", onDbl, true);
  }, [isAdmin]);

  const value = useMemo(() => map, [map]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTextOverrides() {
  return useContext(Ctx);
}

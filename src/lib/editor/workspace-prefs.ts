// Настройки рабочего пространства редакторов (ширины панелей и колонок).
//
// Хранятся сразу в двух местах:
//   1) localStorage — мгновенное восстановление на этом устройстве;
//   2) профиль пользователя (profiles.editor_prefs) — чтобы раскладка
//      переезжала между устройствами и переживала очистку браузера.
// Запись в базу отложенная (debounce), чтение — один раз при входе в админку.
import { supabase } from "@/integrations/supabase/client";

export type PrefEntry = Record<string, number>;
export type EditorPrefs = Record<string, PrefEntry>;

const STORAGE_KEY = "editor-workspace-prefs";
const PUSH_DELAY = 900;

let cache: EditorPrefs | null = null;
let version = 0;
const listeners = new Set<() => void>();
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribePrefs(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function prefsVersion() {
  return version;
}

function load(): EditorPrefs {
  if (cache) return cache;
  cache = {};
  if (typeof window === "undefined") return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) cache = sanitize(JSON.parse(raw));
  } catch {
    /* приватный режим — работаем в памяти */
  }
  // Совместимость со старым форматом (ключ на каждую раскладку).
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith("editor-layout:")) continue;
      const id = k.slice("editor-layout:".length);
      if (cache[id]) continue;
      const parsed = JSON.parse(window.localStorage.getItem(k) ?? "null");
      const entry = sanitizeEntry(parsed);
      if (entry) cache[id] = entry;
    }
  } catch {
    /* игнорируем битые записи */
  }
  return cache;
}

function sanitizeEntry(value: unknown): PrefEntry | null {
  if (!value || typeof value !== "object") return null;
  const out: PrefEntry = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

function sanitize(value: unknown): EditorPrefs {
  if (!value || typeof value !== "object") return {};
  const out: EditorPrefs = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const entry = sanitizeEntry(v);
    if (entry) out[k] = entry;
  }
  return out;
}

function persistLocal(prefs: EditorPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* приватный режим */
  }
}

function schedulePush() {
  if (typeof window === "undefined") return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      await supabase.from("profiles").update({ editor_prefs: load() as never }).eq("id", uid);
    } catch {
      /* оффлайн — остаётся локальная копия */
    }
  }, PUSH_DELAY);
}

/** Прочитать сохранённую раскладку. */
export function readPref(key: string): PrefEntry | undefined {
  return load()[key];
}

/** Сохранить раскладку (локально сразу, в профиль — отложенно). */
export function writePref(key: string, value: PrefEntry) {
  const prefs = load();
  const prev = prefs[key];
  if (prev && JSON.stringify(prev) === JSON.stringify(value)) return;
  prefs[key] = value;
  persistLocal(prefs);
  schedulePush();
}

/** Подтянуть настройки из профиля и слить с локальными (локальные новее). */
export async function pullRemotePrefs() {
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return;
    const { data: row } = await supabase.from("profiles").select("editor_prefs").eq("id", uid).maybeSingle();
    const remote = sanitize((row as { editor_prefs?: unknown } | null)?.editor_prefs);
    if (!Object.keys(remote).length) return;
    const prefs = load();
    let changed = false;
    for (const [k, v] of Object.entries(remote)) {
      if (!prefs[k]) {
        prefs[k] = v;
        changed = true;
      }
    }
    if (changed) {
      persistLocal(prefs);
      emit();
    }
  } catch {
    /* нет сети или прав — работаем на локальных настройках */
  }
}

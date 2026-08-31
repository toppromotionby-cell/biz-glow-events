// Общие типы ИИ-помощника админки «Ember». Клиентобезопасный модуль.

/** Уровень риска действия: от чтения до необратимых операций. */
export type CopilotRisk = "read" | "draft" | "write" | "destructive";

export const RISK_ORDER: Record<CopilotRisk, number> = {
  read: 0,
  draft: 1,
  write: 2,
  destructive: 3,
};

export const RISK_LABEL: Record<CopilotRisk, string> = {
  read: "чтение",
  draft: "черновик",
  write: "изменение",
  destructive: "необратимое",
};

/** Модули админки, к которым помощник имеет доступ. */
export type CopilotModule =
  | "catalog"
  | "content"
  | "orders"
  | "documents"
  | "mail"
  | "files"
  | "analytics"
  | "hygiene"
  | "knowledge"
  | "web";

export const MODULE_LABEL: Record<CopilotModule, string> = {
  catalog: "Каталог",
  content: "Контент сайта",
  orders: "Заявки",
  documents: "Документы",
  mail: "Почта и рассылки",
  files: "Файлы",
  analytics: "Аналитика",
  hygiene: "Гигиена данных",
  knowledge: "База знаний",
  web: "Интернет",
};

/** Значение, которое можно передать через границу сервер→клиент. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonRecord = { [key: string]: JsonValue };

/** Одно конкретное изменение строки: основа превью «было → стало» и отката. */
export interface CopilotOp {
  op: "update" | "insert" | "delete";
  table: string;
  /** id строки; для вставки заполняется после применения. */
  id: string | null;
  /** Человекочитаемое название записи. */
  label: string;
  /** Значения до изменения (только затронутые поля). */
  before: JsonRecord | null;
  /** Значения после изменения (только затронутые поля). */
  after: JsonRecord | null;
}

/** Шаг плана — что помощник собирается сделать. */
export interface CopilotStep {
  tool: string;
  title: string;
  module: CopilotModule;
  risk: CopilotRisk;
  /** Количество затронутых записей. */
  count: number;
  note?: string;
}

export interface CopilotSource {
  title: string;
  url: string;
}

export type CopilotRunStatus =
  | "pending"
  | "approved"
  | "applied"
  | "rejected"
  | "failed"
  | "rolled_back"
  | "expired";

export interface CopilotRun {
  id: string;
  session_id: string | null;
  status: CopilotRunStatus;
  title: string;
  summary: string | null;
  request: string | null;
  risk: CopilotRisk;
  steps: CopilotStep[];
  preview: CopilotOp[];
  questions: string[];
  sources: CopilotSource[];
  result: string | null;
  error: string | null;
  applied_at: string | null;
  created_at: string;
}

export interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: CopilotSource[];
  run_id: string | null;
  created_at: string;
}

export interface CopilotSession {
  id: string;
  title: string;
  last_message_at: string;
  created_at: string;
}

/** Контекст открытой страницы админки — помощник понимает «эту заявку». */
export interface CopilotContext {
  path: string;
  /** Человеческое название раздела. */
  section?: string;
  /** Тип открытой записи (order, quote, zone…). */
  recordType?: string;
  recordId?: string;
  recordLabel?: string;
}

export interface CopilotSettings {
  speak_replies: boolean;
  voice_rate: number;
  hands_free: boolean;
  allow_web_search: boolean;
  max_rows_per_run: number;
  max_emails_per_run: number;
  allow_destructive: boolean;
  enabled_modules: CopilotModule[];
  operators: string[];
}

export const COPILOT_SETTINGS_DEFAULTS: CopilotSettings = {
  speak_replies: true,
  voice_rate: 1,
  hands_free: false,
  allow_web_search: true,
  max_rows_per_run: 50,
  max_emails_per_run: 100,
  allow_destructive: false,
  enabled_modules: [
    "catalog",
    "content",
    "orders",
    "documents",
    "mail",
    "files",
    "analytics",
    "hygiene",
    "knowledge",
  ],
  operators: [],
};

/** Максимальный риск среди шагов плана. */
export function maxRisk(steps: readonly { risk: CopilotRisk }[]): CopilotRisk {
  let best: CopilotRisk = "read";
  for (const s of steps) if (RISK_ORDER[s.risk] > RISK_ORDER[best]) best = s.risk;
  return best;
}

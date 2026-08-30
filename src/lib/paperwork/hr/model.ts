// Кадровые документы: справочник сотрудников, период и обозначения табеля.
// Модуль клиент-безопасный: используется в редакторе, PDF и тестах.

export type HrEmployee = {
  id: string;
  company_profile_id: string | null;
  tab_number: string;
  full_name: string;
  /** Краткое имя «Иванов И.И.» — для ведомости. */
  short_name: string;
  position: string;
  /** Код должности по ОКРБ 014-2017. */
  position_code: string;
  unit: string;
  /** Тарифный оклад на штатную единицу. */
  tariff: number;
  /** Повышение тарифного оклада, %. */
  raise_pct: number;
  /** Количество штатных единиц (0.25 / 0.5 / 1). */
  rate: number;
  hired_on: string | null;
  fired_on: string | null;
  is_active: boolean;
  sort_order: number;
  notes: string;
};

export const EMPTY_EMPLOYEE: Omit<HrEmployee, "id"> = {
  company_profile_id: null,
  tab_number: "",
  full_name: "",
  short_name: "",
  position: "",
  position_code: "",
  unit: "Основное",
  tariff: 0,
  raise_pct: 0,
  rate: 1,
  hired_on: null,
  fired_on: null,
  is_active: true,
  sort_order: 0,
  notes: "",
};

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : v == null ? fallback : String(v);
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export function normalizeEmployee(row: Record<string, unknown>): HrEmployee {
  const full = str(row.full_name);
  return {
    id: str(row.id),
    company_profile_id: str(row.company_profile_id) || null,
    tab_number: str(row.tab_number),
    full_name: full,
    short_name: str(row.short_name) || shortName(full),
    position: str(row.position),
    position_code: str(row.position_code),
    unit: str(row.unit) || "Основное",
    tariff: num(row.tariff),
    raise_pct: num(row.raise_pct),
    rate: num(row.rate, 1),
    hired_on: str(row.hired_on) || null,
    fired_on: str(row.fired_on) || null,
    is_active: row.is_active !== false,
    sort_order: num(row.sort_order),
    notes: str(row.notes),
  };
}

/** «Кузнецов Дмитрий Владимирович» → «Кузнецов Д.В.» */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return full.trim();
  const initials = parts.slice(1, 3).map((p) => `${p[0].toUpperCase()}.`).join("");
  return `${parts[0]} ${initials}`;
}

/* ------------------------------ Период ------------------------------ */

export const MONTHS_RU = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
] as const;

export type HrPeriod = { year: number; month: number }; // month: 1..12

export function periodLabel(p: HrPeriod): string {
  return `${MONTHS_RU[p.month - 1]} ${p.year}`;
}

export function daysInMonth(p: HrPeriod): number {
  return new Date(p.year, p.month, 0).getDate();
}

/** Воскресенье/суббота — выходные (0 = вс). */
export function isWeekend(p: HrPeriod, day: number): boolean {
  const wd = new Date(p.year, p.month - 1, day).getDay();
  return wd === 0 || wd === 6;
}

/** Норма рабочих дней месяца по пятидневке (без учёта праздников). */
export function normDays(p: HrPeriod): number {
  let n = 0;
  for (let d = 1; d <= daysInMonth(p); d += 1) if (!isWeekend(p, d)) n += 1;
  return n;
}

/** Норма часов: 8 ч в день (сокращённые предпраздничные не учитываем). */
export function normHours(p: HrPeriod, hoursPerDay = 8): number {
  return normDays(p) * hoursPerDay;
}

export function periodStart(p: HrPeriod): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}-01`;
}
export function periodEnd(p: HrPeriod): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(daysInMonth(p)).padStart(2, "0")}`;
}

export function nextPeriod(p: HrPeriod): HrPeriod {
  return p.month === 12 ? { year: p.year + 1, month: 1 } : { year: p.year, month: p.month + 1 };
}

export function currentPeriod(now = new Date()): HrPeriod {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/* --------------------------- Обозначения табеля --------------------------- */

export type HrMark = { code: string; label: string; /** Считать неявкой этой категории. */ bucket?: HrBucket };

export type HrBucket =
  | "vacation"
  | "unpaid"
  | "sick"
  | "adminLeave"
  | "state"
  | "trip"
  | "weekend";

export const HR_MARKS: HrMark[] = [
  { code: "В", label: "Выходной", bucket: "weekend" },
  { code: "О", label: "Трудовой отпуск", bucket: "vacation" },
  { code: "А", label: "Отпуск без сохранения з/платы", bucket: "unpaid" },
  { code: "Б", label: "Временная нетрудоспособность", bucket: "sick" },
  { code: "Р", label: "Адм. отпуск по инициативе нанимателя", bucket: "adminLeave" },
  { code: "Г", label: "Выполнение гос. обязанностей", bucket: "state" },
  { code: "К", label: "Служебная командировка", bucket: "trip" },
  { code: "У", label: "Отпуск в связи с обучением" },
  { code: "ПР", label: "Прогулы и др. неявки" },
  { code: "Д", label: "Донор" },
  { code: "НН", label: "Невыясненные причины" },
  { code: "ОР", label: "Отстранение от работы" },
  { code: "ГС", label: "Нахождение под следствием" },
  { code: "ГП", label: "Допризывная подготовка" },
  { code: "ОЖ", label: "Отпуск по уходу за ребёнком" },
];

export const HR_MARK_CODES = HR_MARKS.map((m) => m.code);

export function markByCode(code: string): HrMark | null {
  const c = code.trim().toUpperCase();
  return HR_MARKS.find((m) => m.code === c) ?? null;
}

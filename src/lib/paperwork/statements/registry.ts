// Реестр заявлений работников: приём на работу, отпуск за свой счёт, продление
// контракта, увольнение. Тексты — по утверждённым образцам компании.
import { normalizeBlock, type PwBlock } from "@/lib/paperwork/model";
import {
  countWithWords,
  fioDative,
  fioGenitive,
  plural,
  positionGenitive,
} from "@/lib/paperwork/orders/morph";
import {
  daysBetween,
  ru,
  type OrderField,
  type OrderForm,
  type OrderPerson,
} from "@/lib/paperwork/orders/registry";

export type StatementKind = {
  code: string;
  label: string;
  description: string;
  fields: OrderField[];
  /** Текст заявления по данным мастера. */
  buildText: (form: OrderForm) => string;
};

const s = (form: OrderForm, key: string): string => {
  const v = form[key];
  return typeof v === "string" ? v.trim() : "";
};

const tidy = (t: string) =>
  t.replace(/\s+([.,])/g, "$1").replace(/\.{2,}/g, ".").replace(/[ \t]{2,}/g, " ").trim();

export const applicant = (form: OrderForm): OrderPerson => {
  const v = form["people"];
  const first = Array.isArray(v) ? v[0] : undefined;
  return first ?? { fullName: s(form, "fullName"), position: s(form, "position") };
};

const PERSON: OrderField = { key: "people", label: "Заявитель", type: "employee", required: true };

/* -------------------------------- Виды -------------------------------- */

export const STATEMENT_KINDS: StatementKind[] = [
  {
    code: "hire",
    label: "О приёме на работу",
    description: "Заявление о приёме на должность с указанием ставки и даты.",
    fields: [
      PERSON,
      { key: "startDate", label: "Дата приёма", type: "date", required: true },
      { key: "rate", label: "Ставка", type: "text", defaultValue: "0,25" },
      { key: "partTime", label: "Неполное рабочее время", type: "text", defaultValue: "нет", hint: "да / нет" },
      { key: "hoursFrom", label: "Часов было", type: "text", defaultValue: "8" },
      { key: "hoursTo", label: "Часов стало", type: "text", defaultValue: "2" },
    ],
    buildText: (form) => {
      const p = applicant(form);
      const part = /^д/i.test(s(form, "partTime"));
      return tidy(
        `Прошу принять меня на должность ${positionGenitive(p.position)} с ${ru(s(form, "startDate"))} г. ` +
          (part
            ? `на условиях неполного рабочего времени в виде уменьшения продолжительности рабочего дня с ${s(form, "hoursFrom")} до ${s(form, "hoursTo")} часов.`
            : `на ${s(form, "rate") || "1"} ставки.`),
      );
    },
  },
  {
    code: "leave-unpaid",
    label: "Об отпуске за свой счёт",
    description: "Социальный отпуск без сохранения заработной платы на период.",
    fields: [
      PERSON,
      { key: "from", label: "Дата начала", type: "date", required: true },
      { key: "to", label: "Дата окончания", type: "date", required: true },
      {
        key: "reason",
        label: "Причина",
        type: "text",
        defaultValue: "по уважительным причинам семейного характера",
      },
    ],
    buildText: (form) => {
      const days = daysBetween(s(form, "from"), s(form, "to"));
      return tidy(
        "Прошу предоставить социальный отпуск без сохранения заработной платы " +
          `${s(form, "reason")} на ${days} (${countWithWords(days)}) ` +
          `${plural(days, "календарный день", "календарных дня", "календарных дней")} ` +
          `с ${ru(s(form, "from"))} г. по ${ru(s(form, "to"))} г.`,
      );
    },
  },
  {
    code: "contract-extend",
    label: "О продлении контракта",
    description: "Продление трудовых отношений в связи с окончанием срока контракта.",
    fields: [
      PERSON,
      { key: "endDate", label: "Контракт заканчивается", type: "date", required: true },
      { key: "contractNo", label: "Номер контракта", type: "text" },
      { key: "contractDate", label: "Дата контракта", type: "date" },
      { key: "from", label: "Продлить с", type: "date", required: true },
      { key: "to", label: "Продлить по", type: "date", required: true },
      { key: "termYears", label: "Срок, лет", type: "number", defaultValue: "1" },
    ],
    buildText: (form) => {
      const years = Number(s(form, "termYears") || "1") || 1;
      return tidy(
        `В связи с окончанием ${ru(s(form, "endDate"))} г. срока действия Трудового контракта` +
          (s(form, "contractNo") ? ` №${s(form, "contractNo")}` : "") +
          (s(form, "contractDate") ? ` от ${ru(s(form, "contractDate"))} г.` : "") +
          `, прошу продлить со мной трудовые отношения на предложенных условиях сроком на ` +
          `${years} (${countWithWords(years).toLowerCase()}) ${plural(years, "год", "года", "лет")} ` +
          `с ${ru(s(form, "from"))} г. по ${ru(s(form, "to"))} г.`,
      );
    },
  },
  {
    code: "resign",
    label: "Об увольнении",
    description: "Заявление об увольнении по соглашению сторон или по желанию работника.",
    fields: [
      PERSON,
      { key: "date", label: "Дата увольнения", type: "date", required: true },
      {
        key: "reason",
        label: "Основание",
        type: "text",
        defaultValue: "по соглашению сторон (ст. 37 Трудового кодекса Республики Беларусь)",
      },
    ],
    buildText: (form) =>
      tidy(`Прошу уволить меня ${ru(s(form, "date"))} г. ${s(form, "reason")}.`),
  },
  {
    code: "general",
    label: "Произвольное заявление",
    description: "Свободный текст заявления на имя руководителя.",
    fields: [PERSON, { key: "body", label: "Текст заявления", type: "multiline", required: true }],
    buildText: (form) => s(form, "body"),
  },
];

export const STATEMENT_KIND_MAP: Record<string, StatementKind> = Object.fromEntries(
  STATEMENT_KINDS.map((k) => [k.code, k]),
);

export function statementKindLabel(code: string | null | undefined): string {
  return code ? (STATEMENT_KIND_MAP[code]?.label ?? "Заявление") : "Заявление";
}

export const statementPresetId = (code: string) => `statement-${code}`;

/** Шапка заявления: кому и от кого. */
/** Шапка заявления: кому и от кого. */
export function statementHeader(form: OrderForm): string {
  const p = applicant(form);
  const title = s(form, "addresseeTitle") || "Директору";
  const company = s(form, "company");
  const lines = [
    `${title}${company ? ` ${company}` : ""}`,
    s(form, "addressee") ? fioDative(s(form, "addressee")) : "",
    p.position ? `от ${positionGenitive(p.position)}` : "",
    fioGenitive(p.fullName),
    s(form, "address"),
    s(form, "phone"),
  ];
  return lines.filter(Boolean).join("\n");
}

/** Общие поля шапки заявления (одинаковы для всех видов). */
export const STATEMENT_COMMON_FIELDS: OrderField[] = [
  { key: "addresseeTitle", label: "Кому (должность)", type: "text", defaultValue: "Директору" },
  { key: "company", label: "Организация", type: "text", hint: "ООО «ТОП ПРОМОУШН»" },
  { key: "addressee", label: "ФИО руководителя", type: "text", required: true },
  { key: "address", label: "Адрес заявителя", type: "text" },
  { key: "phone", label: "Телефон заявителя", type: "text" },
];


/* --------------------------- Блоки шаблона --------------------------- */

const h = (text: string) => normalizeBlock({ type: "heading", text, align: "center" });
const p = (text: string, align: "left" | "right" | "justify" = "justify") =>
  normalizeBlock({ type: "paragraph", text, align });
const gap = (size: number) => normalizeBlock({ type: "spacer", size });

/** Блоки заводского шаблона заявления. */
export function statementBlocks(_kind: StatementKind): PwBlock[] {
  return [
    p("{{Шапка заявления}}", "right"),
    gap(18),
    h("ЗАЯВЛЕНИЕ"),
    gap(10),
    p("{{Текст заявления}}"),
    gap(20),
    p("{{Дата}} г.\t\t_______________\t\t{{Заявитель}}", "left"),
  ];
}

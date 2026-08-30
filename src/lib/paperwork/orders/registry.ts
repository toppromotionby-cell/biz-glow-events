// Реестр видов приказов компании: журналы регистрации, поля мастера и тексты
// по образцам архива 2022–2026. Один вид = один заводской шаблон + набор полей.
import { normalizeBlock, type PwBlock } from "@/lib/paperwork/model";
import {
  countWithWords,
  fioAccusative,
  fioDative,
  initialsAfter,
  initialsBefore,
  plural,
  positionDative,
  positionGenitive,
  surnameUpper,
} from "@/lib/paperwork/orders/morph";

/* ------------------------------- Журналы ------------------------------- */

export const ORDER_JOURNALS = ["k", "l", "main"] as const;
export type OrderJournal = (typeof ORDER_JOURNALS)[number];

export const ORDER_JOURNAL_LABELS: Record<OrderJournal, string> = {
  k: "По кадровому составу (К)",
  l: "По личному составу (Л)",
  main: "По основной деятельности",
};

export const ORDER_JOURNAL_SHORT: Record<OrderJournal, string> = {
  k: "К",
  l: "Л",
  main: "Осн.",
};

/** Суффикс номера приказа в журнале: 05-к, 02-л, 7. */
export const ORDER_JOURNAL_SUFFIX: Record<OrderJournal, string> = {
  k: "-к",
  l: "-л",
  main: "",
};

export function orderJournalOf(value: unknown): OrderJournal {
  return (ORDER_JOURNALS as readonly string[]).includes(String(value))
    ? (String(value) as OrderJournal)
    : "main";
}

/* --------------------------------- Поля --------------------------------- */

export const ORDER_FIELD_TYPES = [
  "text",
  "multiline",
  "date",
  "number",
  "money",
  "employee",
  "employees",
] as const;
export type OrderFieldType = (typeof ORDER_FIELD_TYPES)[number];

export type OrderField = {
  key: string;
  label: string;
  type: OrderFieldType;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
};

/** Данные работника для подстановки (из реестра кадров или введённые вручную). */
export type OrderPerson = {
  fullName: string;
  position: string;
  /** Сумма надбавки / оклад — используется в отдельных видах приказов. */
  amount?: string;
};

export type OrderFormValue = string | OrderPerson[] | undefined;
export type OrderForm = Record<string, OrderFormValue>;

export type OrderKind = {
  code: string;
  journal: OrderJournal;
  label: string;
  description: string;
  /** Заголовок приказа («О предоставлении отпуска»). */
  heading: string;
  /** Распорядительное слово: ПРИНЯТЬ / ПРЕДОСТАВИТЬ / ПРИКАЗЫВАЮ. */
  verb: string;
  fields: OrderField[];
  /** Итоговые значения переменных шаблона по данным мастера. */
  buildValues: (form: OrderForm) => Record<string, string>;
};

/* ------------------------------ Утилиты ------------------------------ */

const s = (form: OrderForm, key: string): string => {
  const v = form[key];
  return typeof v === "string" ? v.trim() : "";
};

const people = (form: OrderForm, key = "people"): OrderPerson[] => {
  const v = form[key];
  return Array.isArray(v) ? v.filter((p) => p.fullName.trim()) : [];
};

/** «2026-03-06» → «06.03.2026». */
export function ru(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso.trim();
}

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/** «2026-03-06» → «06 марта 2026 г.». */
export function ruLong(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso.trim();
  return `${m[3]} ${MONTHS_GEN[Number(m[2]) - 1]} ${m[1]} г.`;
}

/** Количество календарных дней между датами включительно. */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}

const first = (form: OrderForm): OrderPerson =>
  people(form)[0] ?? { fullName: s(form, "fullName"), position: s(form, "position") };

const personLine = (p: OrderPerson): string =>
  `${surnameUpper(fioDative(p.fullName))}, ${positionDative(p.position)}`;

/** Строки «С приказом ознакомлен(а)» для всех участников приказа. */
const ackNames = (list: OrderPerson[]): string =>
  list.map((p) => initialsAfter(p.fullName)).join(", ");

/* ------------------------- Общие поля мастера ------------------------- */

const F: Record<string, OrderField> = {
  people: { key: "people", label: "Работники", type: "employees", required: true },
  person: { key: "people", label: "Работник", type: "employee", required: true },
  from: { key: "from", label: "Дата начала", type: "date", required: true },
  to: { key: "to", label: "Дата окончания", type: "date", required: true },
  basis: { key: "basis", label: "Основание", type: "multiline", hint: "Каждый пункт с новой строки" },
  contractNo: { key: "contractNo", label: "Номер контракта", type: "text" },
  contractDate: { key: "contractDate", label: "Дата контракта", type: "date" },
};

/* -------------------------------- Виды -------------------------------- */

export const ORDER_KINDS: OrderKind[] = [
  /* ------------------------- Кадровый состав (К) ------------------------- */
  {
    code: "hire",
    journal: "k",
    label: "О приёме на работу",
    description: "Приём работника с указанием ставки, срока контракта и оклада.",
    heading: "О принятии на работу",
    verb: "ПРИНЯТЬ:",
    fields: [
      F.person!,
      { key: "startDate", label: "Дата приёма", type: "date", required: true },
      { key: "rate", label: "Ставка", type: "text", defaultValue: "1", hint: "Например: 0,25" },
      { key: "termYears", label: "Срок контракта, лет", type: "number", defaultValue: "1" },
      { key: "to", label: "Контракт действует по", type: "date" },
      F.contractNo!,
      F.contractDate!,
      { key: "partTime", label: "Неполное рабочее время", type: "text", defaultValue: "да", hint: "да / нет" },
      F.basis!,
    ],
    buildValues: (form) => {
      const p = first(form);
      const start = s(form, "startDate");
      const years = Number(s(form, "termYears") || "1") || 1;
      const partTime = /^д/i.test(s(form, "partTime"));
      const rate = s(form, "rate") || "1";
      const period = s(form, "to") ? ` с ${ru(start)} г. по ${ru(s(form, "to"))} г.` : "";
      const text =
        `${fioAccusative(p.fullName)} на должность ${positionGenitive(p.position)} на ${rate} ставки` +
        (partTime ? " на условиях неполного рабочего времени" : "") +
        ` с ${ru(start)} г. с окладом согласно штатному расписанию` +
        (partTime ? " и оплатой труда пропорционально отработанному времени" : "") +
        ` сроком на ${countWithWords(years).toLowerCase()} ${plural(years, "год", "года", "лет")}${period}` +
        (s(form, "contractNo")
          ? ` в соответствии с Трудовым контрактом №${s(form, "contractNo")} от ${ru(s(form, "contractDate"))} г.`
          : "") +
        ".";
      return {
        "Текст приказа": text,
        "Основание": s(form, "basis"),
        "Работник": p.fullName,
        "Ознакомлен": ackNames([p]),
      };
    },
  },
  {
    code: "hire-director",
    journal: "k",
    label: "О приёме директора",
    description: "Приём директора: подписывает председатель общего собрания участников.",
    heading: "О принятии на работу директора",
    verb: "ПРИНЯТЬ:",
    fields: [
      F.person!,
      { key: "startDate", label: "Дата приёма", type: "date", required: true },
      { key: "rate", label: "Ставка", type: "text", defaultValue: "0,25" },
      { key: "termYears", label: "Срок контракта, лет", type: "number", defaultValue: "1" },
      { key: "to", label: "Контракт действует по", type: "date" },
      F.contractNo!,
      F.contractDate!,
      { key: "chairman", label: "Председатель общего собрания", type: "text", required: true },
      F.basis!,
    ],
    buildValues: (form) => {
      const p = first(form);
      const start = s(form, "startDate");
      const years = Number(s(form, "termYears") || "1") || 1;
      const rate = s(form, "rate") || "0,25";
      const period = s(form, "to") ? ` с ${ru(start)} г. по ${ru(s(form, "to"))} г.` : "";
      return {
        "Текст приказа":
          `${fioAccusative(p.fullName)} на должность ${positionGenitive(p.position || "директор")} на ${rate} ставки ` +
          `на условиях неполного рабочего времени с ${ru(start)} г. с окладом согласно штатному расписанию ` +
          `и оплатой труда пропорционально отработанному времени сроком на ${countWithWords(years).toLowerCase()} ` +
          `${plural(years, "год", "года", "лет")}${period}` +
          (s(form, "contractNo")
            ? ` в соответствии с Трудовым контрактом №${s(form, "contractNo")} от ${ru(s(form, "contractDate"))} г.`
            : "") +
          ".",
        "Основание": s(form, "basis"),
        "Должность подписанта": "Председатель Общего собрания участников",
        "ФИО подписанта": s(form, "chairman"),
        "Работник": p.fullName,
        "Ознакомлен": ackNames([p]),
      };
    },
  },
  {
    code: "fire",
    journal: "k",
    label: "Об увольнении",
    description: "Увольнение с указанием статьи ТК и компенсации за неиспользованный отпуск.",
    heading: "Об увольнении",
    verb: "УВОЛИТЬ:",
    fields: [
      F.person!,
      { key: "fireDate", label: "Дата увольнения", type: "date", required: true },
      {
        key: "reason",
        label: "Основание увольнения",
        type: "text",
        defaultValue: "по соглашению сторон в соответствии с пунктом 3 части 2 статьи 35 Трудового кодекса Республики Беларусь",
      },
      { key: "compDays", label: "Компенсация, календарных дней", type: "number", defaultValue: "0" },
      F.basis!,
    ],
    buildValues: (form) => {
      const p = first(form);
      const days = Number(s(form, "compDays") || "0") || 0;
      const lines = [
        `1. ${surnameUpper(fioAccusative(p.fullName))}, ${positionGenitive(p.position)}, ` +
          `${ruLong(s(form, "fireDate"))} ${s(form, "reason")}.`,
      ];
      if (days > 0) {
        lines.push(
          `2. Бухгалтерии произвести окончательный расчёт с учётом выплаты компенсации за ${days} ` +
            `${plural(days, "календарный день", "календарных дня", "календарных дней")} неиспользованного трудового отпуска.`,
        );
      }
      return {
        "Текст приказа": lines.join("\n"),
        "Основание": s(form, "basis"),
        "Работник": p.fullName,
        "Ознакомлен": ackNames([p]),
      };
    },
  },
  {
    code: "transfer",
    journal: "k",
    label: "О переводе на другую должность",
    description: "Перевод с прекращением прежнего контракта и заключением нового.",
    heading: "О переводе на другую должность",
    verb: "ПРИКАЗЫВАЮ:",
    fields: [
      F.person!,
      { key: "newPosition", label: "Новая должность", type: "text", required: true },
      { key: "startDate", label: "Дата перевода", type: "date", required: true },
      F.contractNo!,
      F.contractDate!,
      { key: "termYears", label: "Срок нового контракта, лет", type: "number", defaultValue: "1" },
      F.basis!,
    ],
    buildValues: (form) => {
      const p = first(form);
      const start = s(form, "startDate");
      const years = Number(s(form, "termYears") || "1") || 1;
      return {
        "Текст приказа": [
          `Перевести ${fioAccusative(p.fullName)}, с должности ${positionGenitive(p.position)} ` +
            `на должность ${positionGenitive(s(form, "newPosition"))} с ${ruLong(start)}`,
          `Прекратить с ${ruLong(start)} контракт от ${ruLong(s(form, "contractDate"))} № ${s(form, "contractNo")}, ` +
            `заключённый с ${fioAccusative(p.fullName).replace(/^(\S+)/, (w) => w)}, по п. 2 ч. 1 ст. 35 Трудового кодекса ` +
            `Республики Беларусь (по соглашению сторон) в связи с переводом на другую должность.`,
          `Заключить с ${ruLong(start)} с ${fioAccusative(p.fullName)} новый контракт на новую должность ` +
            `сроком на ${countWithWords(years)} ${plural(years, "год", "года", "лет")}.`,
        ].join("\n"),
        "Основание": s(form, "basis"),
        "Работник": p.fullName,
        "Ознакомлен": ackNames([p]),
      };
    },
  },
  {
    code: "contract-extend",
    journal: "k",
    label: "О продлении контракта",
    description: "Продление срока действия трудового контракта на прежних условиях.",
    heading: "О продлении срока действия контракта",
    verb: "ПРОДЛИТЬ:",
    fields: [
      F.person!,
      F.contractNo!,
      F.contractDate!,
      { key: "termYears", label: "Продлить на, лет", type: "number", defaultValue: "1" },
      F.from!,
      F.to!,
      { key: "chairman", label: "Подписывает (если не директор)", type: "text" },
      F.basis!,
    ],
    buildValues: (form) => {
      const p = first(form);
      const years = Number(s(form, "termYears") || "1") || 1;
      const chairman = s(form, "chairman");
      return {
        "Текст приказа":
          `${personLine(p)}, срок действия Трудового контракта №${s(form, "contractNo")} от ${ru(s(form, "contractDate"))} г. ` +
          `на ${countWithWords(years)} ${plural(years, "год", "года", "лет")} ` +
          `с ${ru(s(form, "from"))} г. по ${ru(s(form, "to"))} г. на прежних условиях.`,
        "Основание": s(form, "basis"),
        "Работник": p.fullName,
        "Ознакомлен": ackNames([p]),
        ...(chairman
          ? { "Должность подписанта": "Председатель Общего собрания участников", "ФИО подписанта": chairman }
          : {}),
      };
    },
  },
  {
    code: "contract-new",
    journal: "k",
    label: "О заключении нового контракта",
    description: "Новый контракт с работником по окончании прежнего срока.",
    heading: "О заключении нового контракта",
    verb: "ЗАКЛЮЧИТЬ:",
    fields: [
      F.person!,
      F.contractNo!,
      F.contractDate!,
      { key: "termYears", label: "Срок контракта, лет", type: "number", defaultValue: "1" },
      F.from!,
      F.to!,
      F.basis!,
    ],
    buildValues: (form) => {
      const p = first(form);
      const years = Number(s(form, "termYears") || "1") || 1;
      return {
        "Текст приказа":
          `С ${fioAccusative(p.fullName)}, ${positionDative(p.position)}, новый трудовой контракт ` +
          `№${s(form, "contractNo")} от ${ru(s(form, "contractDate"))} г. сроком на ${countWithWords(years)} ` +
          `${plural(years, "год", "года", "лет")} с ${ru(s(form, "from"))} г. по ${ru(s(form, "to"))} г.`,
        "Основание": s(form, "basis"),
        "Работник": p.fullName,
        "Ознакомлен": ackNames([p]),
      };
    },
  },
  {
    code: "staffing-change",
    journal: "k",
    label: "Об изменении штатного расписания",
    description: "Утверждение новой редакции штатного расписания с даты введения.",
    heading: "О внесении изменения и дополнения\nв штатное расписание",
    verb: "ПРИКАЗЫВАЮ:",
    fields: [{ key: "startDate", label: "Дата введения", type: "date", required: true }],
    buildValues: (form) => ({
      "Текст приказа": [
        "1. Утвердить штатное расписание, новая редакция (прилагается).",
        `2. Установить срок введения штатного расписания с ${ruLong(s(form, "startDate"))}`,
      ].join("\n"),
      "Основание": "",
      "Ознакомлен": "",
    }),
  },
  {
    code: "staffing-unit",
    journal: "k",
    label: "О введении новой штатной единицы",
    description: "Добавление должности в штатное расписание.",
    heading: "О внесении изменения и дополнения\nв штатное расписание",
    verb: "ВВЕСТИ:",
    fields: [
      { key: "position", label: "Должность", type: "text", required: true },
      { key: "startDate", label: "Дата введения", type: "date", required: true },
      { key: "units", label: "Количество штатных единиц", type: "number", defaultValue: "1" },
    ],
    buildValues: (form) => {
      const units = Number(s(form, "units") || "1") || 1;
      return {
        "Текст приказа":
          `В штатное расписание должность ${s(form, "position")} с ${ruLong(s(form, "startDate"))} ` +
          `в количестве ${countWithWords(units, "f")} ${plural(units, "штатной единицы", "штатных единиц", "штатных единиц")}.\n` +
          "Штатное расписание прилагается.",
        "Основание": "",
        "Ознакомлен": "",
      };
    },
  },
  {
    code: "worktime",
    journal: "k",
    label: "Об установлении неполного рабочего времени",
    description: "Неполный рабочий день на период с оплатой пропорционально отработанному времени.",
    heading: "Об установлении неполного\nрабочего времени",
    verb: "УСТАНОВИТЬ:",
    fields: [
      F.people!,
      { key: "hours", label: "Продолжительность рабочего дня, часов", type: "number", defaultValue: "4" },
      { key: "startTime", label: "Начало рабочего дня", type: "text", defaultValue: "10.30" },
      { key: "endTime", label: "Окончание рабочего дня", type: "text", defaultValue: "14.30" },
      F.from!,
      F.to!,
      { key: "reason", label: "Причина", type: "text", defaultValue: "по семейно-бытовым причинам" },
      F.basis!,
    ],
    buildValues: (form) => {
      const list = people(form);
      const hours = Number(s(form, "hours") || "4") || 4;
      const body = list
        .map(
          (p) =>
            `${personLine(p)}, неполное рабочее время (продолжительность рабочего дня — ${hours} ` +
            `${plural(hours, "час", "часа", "часов")}, время начала рабочего дня — ${s(form, "startTime")}, ` +
            `время окончания рабочего дня — ${s(form, "endTime")}) с ${ru(s(form, "from"))} г. по ${ru(s(form, "to"))} г. ` +
            `с оплатой пропорционально отработанному времени ${s(form, "reason")}.`,
        )
        .join("\n");
      return {
        "Текст приказа": body,
        "Основание": s(form, "basis"),
        "Ознакомлен": ackNames(list),
      };
    },
  },
  {
    code: "bonus",
    journal: "k",
    label: "О выплате надбавки за сложность и напряжённость",
    description: "Надбавка за месяц списком работников и сумм.",
    heading: "О выплате надбавки\nза сложность и напряжённость\nработы",
    verb: "ПРИКАЗЫВАЮ:",
    fields: [
      { key: "people", label: "Работники и суммы", type: "employees", required: true },
      { key: "period", label: "Период (месяц и год)", type: "text", required: true, hint: "Например: февраль 2026 года" },
    ],
    buildValues: (form) => {
      const list = people(form);
      const body = [
        `Установить и выплатить надбавку за сложность и напряжённость труда за ${s(form, "period")}:`,
        ...list.map(
          (p) => `${initialsBefore(p.fullName)}, ${p.position} — ${p.amount ?? ""} белорусских рублей`,
        ),
      ].join("\n");
      return { "Текст приказа": body, "Основание": "", "Ознакомлен": "" };
    },
  },
  {
    code: "acting",
    journal: "k",
    label: "О возложении обязанностей",
    description: "Исполнение обязанностей временно отсутствующего работника без освобождения от основной работы.",
    heading: "О выполнении обязанностей\nвременно отсутствующего\nработника",
    verb: "ПРИКАЗЫВАЮ:",
    fields: [
      F.person!,
      { key: "absentName", label: "Кого замещает (ФИО)", type: "text", required: true },
      { key: "absentPosition", label: "Должность отсутствующего", type: "text", required: true },
      F.from!,
      F.to!,
      F.basis!,
    ],
    buildValues: (form) => {
      const p = first(form);
      return {
        "Текст приказа":
          `ВОЗЛОЖИТЬ на ${fioAccusative(p.fullName)}, ${positionDative(p.position)}, ` +
          `с ${ru(s(form, "from"))} г. по ${ru(s(form, "to"))} г. включительно без освобождения от основной работы ` +
          `выполнение обязанностей временно отсутствующего ${positionGenitive(s(form, "absentPosition"))} ` +
          `${fioGenitiveSafe(s(form, "absentName"))}.`,
        "Основание": s(form, "basis"),
        "Работник": p.fullName,
        "Ознакомлен": ackNames([p]),
      };
    },
  },

  /* -------------------------- Личный состав (Л) -------------------------- */
  {
    code: "vac-annual",
    journal: "l",
    label: "О предоставлении трудового отпуска",
    description: "Очередной трудовой отпуск за отработанный период.",
    heading: "О предоставлении отпуска",
    verb: "ПРЕДОСТАВИТЬ:",
    fields: [
      F.person!,
      F.from!,
      F.to!,
      { key: "periodFrom", label: "Отработанный период с", type: "date" },
      { key: "periodTo", label: "Отработанный период по", type: "date" },
      F.basis!,
    ],
    buildValues: (form) => {
      const p = first(form);
      const days = daysBetween(s(form, "from"), s(form, "to"));
      const period =
        s(form, "periodFrom") && s(form, "periodTo")
          ? ` за отработанный период с ${ru(s(form, "periodFrom"))} г. по ${ru(s(form, "periodTo"))} г.`
          : "";
      return {
        "Текст приказа":
          `${personLine(p)}, очередной трудовой отпуск сроком на ${countWithWords(days)} ` +
          `${plural(days, "календарный день", "календарных дня", "календарных дней")} ` +
          `с ${ru(s(form, "from"))} г. по ${ru(s(form, "to"))} г.${period}.`,
        "Основание": s(form, "basis") || `Заявление ${initialsBefore(p.fullName)}`,
        "Работник": p.fullName,
        "Ознакомлен": ackNames([p]),
      };
    },
  },
  {
    code: "vac-own",
    journal: "l",
    label: "Отпуск без сохранения зарплаты (за свой счёт)",
    description: "Социальный отпуск по уважительным причинам семейного характера.",
    heading: "О предоставлении социального отпуска\nбез сохранения заработной платы",
    verb: "ПРЕДОСТАВИТЬ:",
    fields: [
      F.people!,
      F.from!,
      F.to!,
      {
        key: "reason",
        label: "Причина",
        type: "text",
        defaultValue: "по уважительным причинам семейного характера",
      },
      F.basis!,
    ],
    buildValues: (form) => {
      const list = people(form);
      const days = daysBetween(s(form, "from"), s(form, "to"));
      const body = list
        .map(
          (p) =>
            `${personLine(p)}, социальный отпуск без сохранения заработной платы ${s(form, "reason")} ` +
            `на ${countWithWords(days)} ${plural(days, "календарный день", "календарных дня", "календарных дней")} ` +
            `с ${ru(s(form, "from"))} г. по ${ru(s(form, "to"))} г.`,
        )
        .join("\n");
      return {
        "Текст приказа": body,
        "Основание": s(form, "basis"),
        "Ознакомлен": ackNames(list),
      };
    },
  },
  {
    code: "trip",
    journal: "l",
    label: "О командировании",
    description: "Служебная командировка с целью и сроком.",
    heading: "О командировании",
    verb: "КОМАНДИРОВАТЬ:",
    fields: [
      F.person!,
      { key: "place", label: "Место командировки", type: "text", required: true },
      F.from!,
      F.to!,
      { key: "purpose", label: "Цель командировки", type: "multiline", required: true },
      F.basis!,
    ],
    buildValues: (form) => {
      const p = first(form);
      const days = daysBetween(s(form, "from"), s(form, "to"));
      return {
        "Текст приказа":
          `${surnameUpper(fioAccusative(p.fullName))}, ${positionGenitive(p.position)}, ` +
          `${s(form, "place")} сроком на ${countWithWords(days)} ` +
          `${plural(days, "день", "дня", "дней")} с ${ru(s(form, "from"))} г. по ${ru(s(form, "to"))} г. ` +
          `для ${s(form, "purpose")}.`,
        "Основание": s(form, "basis"),
        "Работник": p.fullName,
        "Ознакомлен": ackNames([p]),
      };
    },
  },

  /* ------------------------ Основная деятельность ------------------------ */
  {
    code: "lna-approve",
    journal: "main",
    label: "Об утверждении локальных актов",
    description: "Утверждение и введение в действие положений, ПВТР и других ЛНА.",
    heading: "Об утверждении и введении в действие\nлокально-нормативных актов",
    verb: "ПРИКАЗЫВАЮ:",
    fields: [
      { key: "acts", label: "Документы", type: "multiline", required: true, hint: "Каждый акт с новой строки" },
      { key: "startDate", label: "Дата введения", type: "date", required: true },
    ],
    buildValues: (form) => {
      const acts = s(form, "acts").split("\n").map((x) => x.trim()).filter(Boolean);
      const body = [
        ...acts.map((a) => `Утвердить и ввести в действие с ${ru(s(form, "startDate"))} г. ${a}.`),
        "Ознакомить с локально-нормативными актами, утверждёнными настоящим приказом, работников под подпись.",
        "Контроль за исполнением настоящего приказа оставляю за собой.",
      ].join("\n");
      return { "Текст приказа": body, "Основание": "", "Ознакомлен": "" };
    },
  },
  {
    code: "staffing-approve",
    journal: "main",
    label: "Об утверждении штатного расписания",
    description: "Утверждение штатного расписания и срока его введения.",
    heading: "Об утверждении штатного расписания",
    verb: "ПРИКАЗЫВАЮ:",
    fields: [
      { key: "startDate", label: "Дата введения", type: "date", required: true },
      { key: "edition", label: "Редакция", type: "text", defaultValue: "новая редакция" },
    ],
    buildValues: (form) => ({
      "Текст приказа": [
        `1. Утвердить штатное расписание${s(form, "edition") ? `, ${s(form, "edition")}` : ""} (прилагается).`,
        `2. Установить срок введения штатного расписания с ${ruLong(s(form, "startDate"))}`,
      ].join("\n"),
      "Основание": "",
      "Ознакомлен": "",
    }),
  },
  {
    code: "responsible",
    journal: "main",
    label: "О назначении ответственного",
    description: "Назначение работника ответственным за участок работы.",
    heading: "О назначении ответственного",
    verb: "ПРИКАЗЫВАЮ:",
    fields: [
      F.person!,
      { key: "area", label: "За что отвечает", type: "multiline", required: true },
    ],
    buildValues: (form) => {
      const p = first(form);
      return {
        "Текст приказа": `1. Назначить ${positionGenitive(p.position)} ${fioAccusative(p.fullName)} ответственным за ${s(form, "area")}.`,
        "Основание": "",
        "Ознакомлен": ackNames([p]),
      };
    },
  },
  {
    code: "salary-dates",
    journal: "main",
    label: "О сроках выплаты заработной платы",
    description: "Установление дней выплаты заработной платы.",
    heading: "Об установлении сроков выплаты\nзаработной платы",
    verb: "ПРИКАЗЫВАЮ:",
    fields: [{ key: "day", label: "День выплаты", type: "text", required: true, defaultValue: "25-го числа месяца, следующего за расчётным" }],
    buildValues: (form) => ({
      "Текст приказа":
        `Установить следующие дни выплаты заработной платы работникам: заработной платы — ${s(form, "day")}.`,
      "Основание": "",
      "Ознакомлен": "",
    }),
  },
  {
    code: "general",
    journal: "main",
    label: "Приказ по основной деятельности (произвольный)",
    description: "Свободный текст: нормы топлива, представительские расходы, прочие вопросы.",
    heading: "О {{Тема приказа}}",
    verb: "ПРИКАЗЫВАЮ:",
    fields: [
      { key: "subject", label: "Тема приказа", type: "text", required: true, hint: "например: нормах расхода топлива" },
      { key: "preamble", label: "Преамбула", type: "multiline", hint: "«В целях …» — необязательно" },
      { key: "body", label: "Распорядительная часть", type: "multiline", required: true, hint: "Каждый пункт с новой строки" },
      F.basis!,
    ],
    buildValues: (form) => ({
      "Заголовок приказа": `О ${s(form, "subject")}`,
      "Преамбула": s(form, "preamble"),
      "Текст приказа": s(form, "body"),
      "Основание": s(form, "basis"),
      "Ознакомлен": "",
    }),
  },
];

/** Родительный падеж ФИО с защитой от пустой строки. */
function fioGenitiveSafe(name: string): string {
  return name.trim() ? fioDative(name).replace(/у$/, "а") : "";
}

export const ORDER_KIND_MAP: Record<string, OrderKind> = Object.fromEntries(
  ORDER_KINDS.map((k) => [k.code, k]),
);

export function orderKindsOf(journal: OrderJournal): OrderKind[] {
  return ORDER_KINDS.filter((k) => k.journal === journal);
}

export function orderKindLabel(code: string | null | undefined): string {
  return code ? (ORDER_KIND_MAP[code]?.label ?? "Приказ") : "Приказ";
}

/** Идентификатор заводского шаблона приказа. */
export const orderPresetId = (code: string) => `order-${code}`;

/* --------------------------- Блоки шаблона --------------------------- */

const h = (text: string, align: "left" | "center" = "center") =>
  normalizeBlock({ type: "heading", text, align });
const p = (text: string, indent = false) =>
  normalizeBlock({ type: "paragraph", text, align: "justify", indent });

/** Блоки заводского шаблона для вида приказа. */
export function orderBlocks(kind: OrderKind): PwBlock[] {
  const blocks: PwBlock[] = [
    h(kind.code === "general" ? "{{Заголовок приказа}}" : kind.heading),
    normalizeBlock({ type: "spacer", size: 10 }),
  ];
  if (kind.code === "general") blocks.push(p("{{Преамбула}}"));
  blocks.push(p(kind.verb), p("{{Текст приказа}}"));
  blocks.push(normalizeBlock({ type: "spacer", size: 8 }));
  blocks.push(p("Основание: {{Основание}}"));
  blocks.push(normalizeBlock({ type: "spacer", size: 14 }));
  blocks.push(
    normalizeBlock({
      type: "signature",
      signerTitle: "{{Должность подписанта}}",
      signerName: "{{ФИО подписанта}}",
      withStamp: false,
    }),
  );
  blocks.push(
    normalizeBlock({
      type: "paragraph",
      text: "С приказом ознакомлен(а): {{Ознакомлен}}\n\n_______________ «___» ____________ 20___ г.",
      align: "left",
    }),
  );
  return blocks;
}

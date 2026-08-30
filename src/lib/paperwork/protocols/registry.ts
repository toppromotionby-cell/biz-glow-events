// Реестр протоколов общего собрания участников ООО: виды, поля мастера и тексты
// по образцам архива 2022–2025. Нумерация — сквозная по годам (Протокол №1, №2 …).
import { normalizeBlock, type PwBlock } from "@/lib/paperwork/model";
import { fioAccusative, fioGenitive, initialsAfter } from "@/lib/paperwork/orders/morph";
import { ru, type OrderField, type OrderForm } from "@/lib/paperwork/orders/registry";

export type ProtocolKind = {
  code: string;
  label: string;
  description: string;
  /** Дополнительные поля вида (общие поля добавляет мастер). */
  fields: OrderField[];
  /** Повестка дня, «СЛУШАЛИ» и «РЕШИЛИ» по данным мастера. */
  build: (form: OrderForm) => { agenda: string; heard: string; decided: string };
};

const s = (form: OrderForm, key: string): string => {
  const v = form[key];
  return typeof v === "string" ? v.trim() : "";
};

const tidy = (t: string) =>
  t.replace(/\s+([.,])/g, "$1").replace(/\.{2,}/g, ".").replace(/[ \t]{2,}/g, " ").trim();

const speaker = (form: OrderForm) => s(form, "Докладчик") || s(form, "speaker");

const heardBy = (form: OrderForm, proposal: string): string =>
  tidy(`${fioAccusative(speaker(form))}, который(-ая) предложил(-а) ${proposal}`);

/* -------------------------------- Виды -------------------------------- */

export const PROTOCOL_KINDS: ProtocolKind[] = [
  {
    code: "found",
    label: "О создании общества",
    description: "Учредительное собрание: создание ООО, наименование, уставный фонд, устав.",
    fields: [
      { key: "companyName", label: "Наименование общества", type: "text", required: true },
      { key: "capital", label: "Уставный фонд, BYN", type: "money", required: true },
      { key: "address", label: "Юридический адрес", type: "text", required: true },
      { key: "chairman", label: "Председатель собрания", type: "text", required: true },
      { key: "secretary", label: "Секретарь собрания", type: "text", required: true },
    ],
    build: (form) => ({
      agenda: [
        "1. О создании Общества с ограниченной ответственностью (далее — «Общество»).",
        "2. О согласовании наименования Общества.",
        "3. Об уставном фонде Общества.",
        "4. О юридическом адресе Общества.",
        "5. Об утверждении Устава Общества.",
        "6. Об избрании Председателя Общего собрания участников.",
        "7. Об избрании Секретаря Общего собрания участников.",
      ].join("\n"),
      heard: heardBy(form, "создать Общество с ограниченной ответственностью."),
      decided: tidy(
        [
          `1. Создать Общество с ограниченной ответственностью «${s(form, "companyName")}».`,
          `2. Согласовать наименование Общества: «${s(form, "companyName")}».`,
          `3. Сформировать уставный фонд Общества в размере ${s(form, "capital")} бел. рублей.`,
          `4. Определить местонахождение Общества: ${s(form, "address")}.`,
          "5. Утвердить Устав Общества.",
          `6. Избрать Председателем Общего собрания участников ${fioAccusative(s(form, "chairman"))}.`,
          `7. Избрать Секретарём Общего собрания участников ${fioAccusative(s(form, "secretary"))}.`,
        ].join("\n"),
      ),
    }),
  },
  {
    code: "director-appoint",
    label: "О назначении директора",
    description: "Избрание (назначение) директора общества и заключение с ним контракта.",
    fields: [
      { key: "director", label: "ФИО директора", type: "text", required: true },
      { key: "startDate", label: "Дата назначения", type: "date", required: true },
      { key: "termYears", label: "Срок полномочий, лет", type: "number", defaultValue: "1" },
      { key: "rate", label: "Ставка", type: "text", defaultValue: "0,25" },
    ],
    build: (form) => ({
      agenda: "1. О назначении директора Общества.",
      heard: heardBy(
        form,
        `назначить директором Общества ${fioAccusative(s(form, "director"))}.`,
      ),
      decided: tidy(
        `Назначить директором Общества ${fioAccusative(s(form, "director"))} с ${ru(s(form, "startDate"))} г. ` +
          `на ${s(form, "rate") || "1"} ставки сроком на ${s(form, "termYears") || "1"} год(а) и заключить с ним(ней) трудовой контракт.`,
      ),
    }),
  },
  {
    code: "director-salary",
    label: "Об изменении оплаты труда директора",
    description: "Изменение оклада или процента надбавки директору общества.",
    fields: [
      { key: "director", label: "ФИО директора", type: "text", required: true },
      { key: "percent", label: "Процент надбавки", type: "text", hint: "например: 30" },
      { key: "salary", label: "Новый оклад, BYN", type: "money" },
      { key: "startDate", label: "Дата вступления в силу", type: "date", required: true },
    ],
    build: (form) => {
      const change = s(form, "percent")
        ? `увеличить оклад Директора Общества ${fioGenitive(s(form, "director"))} за счёт поднятия процента до ${s(form, "percent")} процентов`
        : `установить Директору Общества ${fioGenitive(s(form, "director"))} оклад в размере ${s(form, "salary")} бел. рублей`;
      return {
        agenda: "1. Об изменении оплаты труда директора Общества.",
        heard: heardBy(form, `${change} и заключить дополнительное соглашение к трудовому контракту.`),
        decided: tidy(
          `${change.charAt(0).toUpperCase()}${change.slice(1)} с ${ru(s(form, "startDate"))} г. ` +
            "и заключить дополнительное соглашение к трудовому контракту.",
        ),
      };
    },
  },
  {
    code: "contract-extend",
    label: "О продлении контракта с директором",
    description: "Продление срока трудового контракта с директором общества.",
    fields: [
      { key: "director", label: "ФИО директора", type: "text", required: true },
      { key: "from", label: "Продлить с", type: "date", required: true },
      { key: "to", label: "Продлить по", type: "date", required: true },
    ],
    build: (form) => ({
      agenda: "1. О продлении трудовых отношений с директором Общества.",
      heard: heardBy(form, `продлить трудовые отношения с ${fioAccusative(s(form, "director"))}.`),
      decided: tidy(
        `Продлить трудовой контракт с директором Общества ${fioAccusative(s(form, "director"))} ` +
          `на срок с ${ru(s(form, "from"))} г. по ${ru(s(form, "to"))} г.`,
      ),
    }),
  },
  {
    code: "credit",
    label: "О совершении крупной сделки (кредит)",
    description: "Одобрение кредитного договора и наделение директора полномочиями на подписание.",
    fields: [
      { key: "bank", label: "Банк", type: "text", required: true },
      { key: "amount", label: "Сумма, BYN", type: "money", required: true },
      { key: "amountWords", label: "Сумма прописью", type: "text" },
      { key: "director", label: "ФИО директора", type: "text", required: true },
    ],
    build: (form) => {
      const amount = `${s(form, "amount")}${s(form, "amountWords") ? ` (${s(form, "amountWords")})` : ""} бел. рублей`;
      return {
        agenda: tidy(
          "1. О совершении крупной сделки:\n" +
            `1.1. О заключении Обществом с ${s(form, "bank")} кредитного договора на сумму ${amount} и утверждении условий кредитного договора.\n` +
            `2. О наделении полномочиями директора Общества ${fioAccusative(s(form, "director"))} на подписание вышеуказанного договора.`,
        ),
        heard: heardBy(
          form,
          `заключить с ${s(form, "bank")} кредитный договор на сумму ${amount}.`,
        ),
        decided: tidy(
          `1. Заключить с ${s(form, "bank")} кредитный договор на сумму ${amount} и утвердить его условия согласно проекту банка.\n` +
            `2. Наделить директора Общества ${fioAccusative(s(form, "director"))} полномочиями на подписание кредитного договора и всех связанных с ним документов.`,
        ),
      };
    },
  },
  {
    code: "address",
    label: "О смене юридического адреса",
    description: "Изменение местонахождения общества и внесение изменений в устав.",
    fields: [
      { key: "address", label: "Новый адрес", type: "text", required: true },
      { key: "startDate", label: "Дата изменения", type: "date", required: true },
    ],
    build: (form) => ({
      agenda: "1. Об изменении местонахождения Общества.",
      heard: heardBy(form, `изменить местонахождение Общества на ${s(form, "address")}.`),
      decided: tidy(
        `Определить местонахождение Общества с ${ru(s(form, "startDate"))} г. по адресу: ${s(form, "address")}. ` +
          "Внести соответствующие изменения в Устав Общества и уведомить регистрирующий орган.",
      ),
    }),
  },
  {
    code: "general",
    label: "Протокол по произвольному вопросу",
    description: "Свободная повестка: любой вопрос общего собрания участников.",
    fields: [
      { key: "agenda", label: "Повестка дня", type: "multiline", required: true, hint: "Каждый пункт с новой строки" },
      { key: "heard", label: "СЛУШАЛИ", type: "multiline" },
      { key: "decided", label: "РЕШИЛИ", type: "multiline", required: true },
    ],
    build: (form) => ({
      agenda: s(form, "agenda"),
      decided: s(form, "decided"),
      heard: s(form, "heard") || (speaker(form) ? heardBy(form, "рассмотреть вопросы повестки дня.") : ""),
    }),
  },
];

export const PROTOCOL_KIND_MAP: Record<string, ProtocolKind> = Object.fromEntries(
  PROTOCOL_KINDS.map((k) => [k.code, k]),
);

export function protocolKindLabel(code: string | null | undefined): string {
  return code ? (PROTOCOL_KIND_MAP[code]?.label ?? "Протокол") : "Протокол";
}

export const protocolPresetId = (code: string) => `protocol-${code}`;

/** Строка участника собрания для блока «ПРИСУТСТВОВАЛИ УЧАСТНИКИ». */
export type ProtocolParticipant = {
  fullName: string;
  birthDate?: string;
  passport?: string;
  passportIssued?: string;
  passportAuthority?: string;
  passportValid?: string;
  personalNumber?: string;
  address?: string;
};

export function participantLine(p: ProtocolParticipant): string {
  const parts = [p.fullName.trim()];
  if (p.birthDate) parts.push(`дата рождения ${ru(p.birthDate)} г.`);
  if (p.passport) parts.push(`паспорт ${p.passport}`);
  if (p.passportIssued) parts.push(`дата выдачи — ${ru(p.passportIssued)} г.`);
  if (p.passportAuthority) parts.push(`орган выдачи — ${p.passportAuthority}`);
  if (p.passportValid) parts.push(`срок действия ${ru(p.passportValid)} г.`);
  if (p.personalNumber) parts.push(`идентификационный номер ${p.personalNumber}`);
  if (p.address) parts.push(`зарегистрирован(а) по адресу: ${p.address}`);
  return tidy(parts.join(", ") + ".");
}

export const participantShort = (p: ProtocolParticipant) => initialsAfter(p.fullName);

/* --------------------------- Блоки шаблона --------------------------- */

const h = (text: string, align: "left" | "center" = "center") =>
  normalizeBlock({ type: "heading", text, align });
const p = (text: string, align: "left" | "justify" = "justify") =>
  normalizeBlock({ type: "paragraph", text, align });
const gap = (size: number) => normalizeBlock({ type: "spacer", size });

/** Блоки заводского шаблона протокола (единая структура для всех видов). */
export function protocolBlocks(_kind: ProtocolKind): PwBlock[] {
  return [
    h("ПРОТОКОЛ №{{Номер документа}}"),
    h("{{Вид собрания}}"),
    gap(10),
    p("ПРИСУТСТВОВАЛИ УЧАСТНИКИ:", "left"),
    p("{{Участники}}"),
    gap(6),
    p("Председатель Общего собрания Участников: {{Председатель}}.", "left"),
    p("Секретарь Общего собрания Участников: {{Секретарь}}.", "left"),
    gap(6),
    p("Форма проведения Общего собрания участников: {{Форма проведения}}.", "left"),
    p("Форма голосования Участников: {{Форма голосования}}.", "left"),
    gap(8),
    p("ПОВЕСТКА ДНЯ:", "left"),
    p("{{Повестка}}"),
    gap(8),
    p("СЛУШАЛИ:", "left"),
    p("{{Слушали}}"),
    gap(6),
    p("РЕШИЛИ:", "left"),
    p("{{Решили}}"),
    gap(6),
    p("ГОЛОСОВАЛИ:", "left"),
    p("«За» — {{Голосование}}.", "left"),
    gap(16),
    normalizeBlock({
      type: "signature",
      signerTitle: "Председатель Общего собрания участников",
      signerName: "{{Председатель}}",
      withStamp: false,
    }),
    normalizeBlock({
      type: "signature",
      signerTitle: "Секретарь Общего собрания участников",
      signerName: "{{Секретарь}}",
      withStamp: false,
    }),
  ];
}

/* --------------------- Общие поля и значения мастера --------------------- */

/** Поля, одинаковые для всех протоколов (шапка, президиум, форма собрания). */
export const PROTOCOL_COMMON_FIELDS: OrderField[] = [
  {
    key: "meetingKind",
    label: "Вид собрания",
    type: "text",
    defaultValue: "Внеочередного Общего собрания участников",
  },
  { key: "participants", label: "Присутствовали участники", type: "multiline", required: true },
  { key: "chairman", label: "Председатель собрания", type: "text", required: true },
  { key: "secretary", label: "Секретарь собрания", type: "text", required: true },
  { key: "Докладчик", label: "Докладчик", type: "text" },
  { key: "meetingForm", label: "Форма проведения", type: "text", defaultValue: "очная" },
  { key: "voteForm", label: "Форма голосования", type: "text", defaultValue: "открытая" },
  { key: "vote", label: "Голосовали «За»", type: "text", defaultValue: "единогласно" },
];

/** Значения переменных протокола по данным мастера. */
export function buildProtocolValues(kind: ProtocolKind, form: OrderForm): Record<string, string> {
  const built = kind.build(form);
  return {
    "Вид собрания": s(form, "meetingKind") || "Внеочередного Общего собрания участников",
    "Участники": s(form, "participants"),
    "Председатель": s(form, "chairman"),
    "Секретарь": s(form, "secretary"),
    "Форма проведения": s(form, "meetingForm") || "очная",
    "Форма голосования": s(form, "voteForm") || "открытая",
    "Повестка": built.agenda,
    "Слушали": built.heard,
    "Решили": built.decided,
    "Голосование": s(form, "vote") || "единогласно",
  };
}

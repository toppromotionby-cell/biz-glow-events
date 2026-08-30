// Реестр видов документов: единая точка правил для писем, приказов, счетов, актов и договоров.
// Новый вид документа добавляется здесь — редактор, список и экспорт подхватывают его автоматически.
import {
  PW_DOC_TYPE_LABELS,
  PW_TYPE_CATEGORY,
  type PwBlockType,
  type PwCategory,
  type PwDocType,
} from "@/lib/paperwork/model";

export type PwKind = {
  type: PwDocType;
  label: string;
  category: PwCategory;
  /** Короткое описание для карточки выбора. */
  description: string;
  /** Блоки, без которых документ считается неполным. */
  requiredBlocks: PwBlockType[];
  /** Блоки, предлагаемые при создании пустого документа. */
  starterBlocks: PwBlockType[];
  /** Нужен ли номер документа. */
  numbered: boolean;
  /** Финансовый документ: показываем суммы, НДС и сумму прописью. */
  financial: boolean;
  /** Лист A4 в альбомной ориентации (широкие таблицы: ведомости, табель). */
  landscape: boolean;
  /** Устаревший вид: остаётся для старых документов, но не предлагается в интерфейсе. */
  hidden?: boolean;

};

const base = (
  type: PwDocType,
  description: string,
  overrides: Partial<PwKind> = {},
): PwKind => ({
  type,
  label: PW_DOC_TYPE_LABELS[type],
  category: PW_TYPE_CATEGORY[type],
  description,
  requiredBlocks: ["heading"],
  starterBlocks: ["heading", "paragraph", "signature"],
  numbered: true,
  financial: false,
  landscape: false,
  ...overrides,
});

export const PW_KINDS: Record<PwDocType, PwKind> = {
  letter: base("letter", "Официальное письмо контрагенту или в организацию", {
    starterBlocks: ["recipient", "heading", "paragraph", "signature"],
  }),
  order: base("order", "Приказ по организации с распорядительной частью", {
    starterBlocks: ["heading", "paragraph", "list", "signature"],
  }),
  attorney: base("attorney", "Доверенность на представление интересов", {
    starterBlocks: ["heading", "paragraph", "list", "signature"],
  }),
  certificate: base("certificate", "Справка по месту требования", {
    starterBlocks: ["heading", "paragraph", "signature"],
  }),
  notice: base("notice", "Уведомление об изменении условий или событии", {
    starterBlocks: ["recipient", "heading", "paragraph", "signature"],
  }),
  memo: base("memo", "Внутренняя служебная записка", {
    numbered: false,
    hidden: true,
    starterBlocks: ["recipient", "heading", "paragraph", "signature"],
  }),
  contract: base("contract", "Договор с реквизитами сторон", {
    requiredBlocks: ["heading", "parties"],
    starterBlocks: ["heading", "paragraph", "list", "parties", "signature"],
  }),
  workact: base("workact", "Договор подряда с приложением акта выполненных работ", {
    requiredBlocks: ["heading", "parties"],
    starterBlocks: ["heading", "paragraph", "list", "lineitems", "parties", "signature"],
  }),
  loan: base("loan", "Договор займа между сторонами", {
    requiredBlocks: ["heading", "parties"],
    starterBlocks: ["heading", "paragraph", "list", "parties", "signature"],
  }),
  payroll: base("payroll", "Ведомость на выплату заработной платы", {
    financial: true,
    landscape: true,
    requiredBlocks: ["heading", "table"],
    starterBlocks: ["heading", "table", "signature"],
  }),
  staffing: base("staffing", "Штатное расписание организации", {
    landscape: true,
    requiredBlocks: ["heading", "table"],
    starterBlocks: ["heading", "table", "signature"],
  }),
  timesheet: base("timesheet", "Табель учёта рабочего времени сотрудников", {
    landscape: true,
    requiredBlocks: ["heading", "table"],
    starterBlocks: ["heading", "table", "signature"],
  }),
  invoice: base("invoice", "Счёт на оплату с позициями и суммой прописью", {
    financial: true,
    requiredBlocks: ["heading", "lineitems"],
    starterBlocks: ["heading", "parties", "lineitems", "signature"],
  }),
  act: base("act", "Акт выполненных работ с перечнем позиций", {
    financial: true,
    requiredBlocks: ["heading", "lineitems"],
    starterBlocks: ["heading", "parties", "lineitems", "signature"],
  }),
  custom: base("custom", "Произвольный документ на фирменном бланке", {
    numbered: false,
    requiredBlocks: [],
    starterBlocks: ["heading", "paragraph"],
  }),
};

/** Виды, доступные для выбора и создания документов. */
export const PW_KIND_LIST: PwKind[] = Object.values(PW_KINDS).filter((k) => !k.hidden);

export function pwKind(type: PwDocType): PwKind {
  return PW_KINDS[type] ?? PW_KINDS.custom;
}

/** Каких обязательных блоков не хватает документу. */
export function missingBlocks(type: PwDocType, present: PwBlockType[]): PwBlockType[] {
  const set = new Set(present);
  return pwKind(type).requiredBlocks.filter((b) => !set.has(b));
}

/** Альбомная ориентация листа для вида документа. */
export function isLandscapeType(type: PwDocType): boolean {
  return pwKind(type).landscape;
}

// Единая точка для «реестровых» документов: приказы, протоколы, заявления.
// Все они регистрируются в журналах, нумеруются по годам и создаются мастером.
import type { PwBlock, PwDocType } from "@/lib/paperwork/model";
import {
  ORDER_JOURNALS,
  ORDER_JOURNAL_LABELS,
  ORDER_JOURNAL_SHORT,
  ORDER_JOURNAL_SUFFIX,
  ORDER_KINDS,
  ORDER_KIND_MAP,
  orderBlocks,
  orderKindLabel,
  orderPresetId,
  type OrderField,
  type OrderForm,
} from "@/lib/paperwork/orders/registry";
import {
  buildProtocolValues,
  PROTOCOL_COMMON_FIELDS,
  PROTOCOL_KINDS,
  PROTOCOL_KIND_MAP,
  protocolBlocks,
  protocolKindLabel,
  protocolPresetId,
} from "@/lib/paperwork/protocols/registry";
import {
  buildStatementValues,
  STATEMENT_COMMON_FIELDS,
  STATEMENT_KINDS,
  STATEMENT_KIND_MAP,
  statementBlocks,
  statementKindLabel,
  statementPresetId,
} from "@/lib/paperwork/statements/registry";


export const REGISTRY_DOC_TYPES = ["order", "protocol", "statement"] as const;
export type RegistryDocType = (typeof REGISTRY_DOC_TYPES)[number];

export function isRegistryDocType(type: string): type is RegistryDocType {
  return (REGISTRY_DOC_TYPES as readonly string[]).includes(type);
}

export type RegistryJournal = { code: string; label: string; short: string; suffix: string };

export type RegistryKindRef = {
  code: string;
  journal: string;
  label: string;
  description: string;
};

export type RegistrySpec = {
  docType: RegistryDocType;
  /** Подпись кнопки создания и заголовков журнала. */
  createLabel: string;
  itemLabel: string;
  itemsLabel: string;
  wizardTitle: string;
  wizardHint: string;
  journals: RegistryJournal[];
  kinds: RegistryKindRef[];
  kindLabel: (code: string | null | undefined) => string;
  presetId: (code: string) => string;
  blocksOf: (code: string) => PwBlock[] | null;
  /** Нумеруется ли документ автоматически. */
  numbered: boolean;
  /** Название документа по виду и номеру. */
  titleOf: (code: string, number: string) => string;
};

const ORDER_SPEC: RegistrySpec = {
  docType: "order",
  createLabel: "Создать приказ",
  itemLabel: "Приказ",
  itemsLabel: "приказов",
  wizardTitle: "Новый приказ",
  wizardHint: "Выберите журнал регистрации и вид приказа — текст соберётся автоматически.",
  journals: ORDER_JOURNALS.map((j) => ({
    code: j,
    label: ORDER_JOURNAL_LABELS[j],
    short: ORDER_JOURNAL_SHORT[j],
    suffix: ORDER_JOURNAL_SUFFIX[j],
  })),
  kinds: ORDER_KINDS.map((k) => ({
    code: k.code,
    journal: k.journal,
    label: k.label,
    description: k.description,
  })),
  kindLabel: orderKindLabel,
  presetId: orderPresetId,
  blocksOf: (code) => {
    const kind = ORDER_KIND_MAP[code];
    return kind ? orderBlocks(kind) : null;
  },
  numbered: true,
  titleOf: (code, number) =>
    `Приказ №${number} — ${orderKindLabel(code).replace(/^О\s/, "о ")}`,
};

const PROTOCOL_SPEC: RegistrySpec = {
  docType: "protocol",
  createLabel: "Создать протокол",
  itemLabel: "Протокол",
  itemsLabel: "протоколов",
  wizardTitle: "Новый протокол общего собрания",
  wizardHint: "Выберите вопрос повестки — состав участников и решения подставятся автоматически.",
  journals: [{ code: "protocol", label: "Протоколы общего собрания", short: "Протокол", suffix: "" }],
  kinds: PROTOCOL_KINDS.map((k) => ({
    code: k.code,
    journal: "protocol",
    label: k.label,
    description: k.description,
  })),
  kindLabel: protocolKindLabel,
  presetId: protocolPresetId,
  blocksOf: (code) => {
    const kind = PROTOCOL_KIND_MAP[code];
    return kind ? protocolBlocks(kind) : null;
  },
  numbered: true,
  titleOf: (code, number) => `Протокол №${number} — ${protocolKindLabel(code).replace(/^О\s/, "о ")}`,
};

const STATEMENT_SPEC: RegistrySpec = {
  docType: "statement",
  createLabel: "Создать заявление",
  itemLabel: "Заявление",
  itemsLabel: "заявлений",
  wizardTitle: "Новое заявление работника",
  wizardHint: "Выберите вид заявления и работника — текст соберётся по утверждённому образцу.",
  journals: [{ code: "statement", label: "Заявления работников", short: "Заявл.", suffix: "" }],
  kinds: STATEMENT_KINDS.map((k) => ({
    code: k.code,
    journal: "statement",
    label: k.label,
    description: k.description,
  })),
  kindLabel: statementKindLabel,
  presetId: statementPresetId,
  blocksOf: (code) => {
    const kind = STATEMENT_KIND_MAP[code];
    return kind ? statementBlocks(kind) : null;
  },
  numbered: false,
  titleOf: (code, _number) => `Заявление — ${statementKindLabel(code).replace(/^О\s/, "о ")}`,
};

export const REGISTRY_SPECS: Record<RegistryDocType, RegistrySpec> = {
  order: ORDER_SPEC,
  protocol: PROTOCOL_SPEC,
  statement: STATEMENT_SPEC,
};

export function registrySpec(type: PwDocType | string): RegistrySpec | null {
  return isRegistryDocType(String(type)) ? REGISTRY_SPECS[String(type) as RegistryDocType] : null;
}

export function registryKindsOf(spec: RegistrySpec, journal: string): RegistryKindRef[] {
  return journal === "all" ? spec.kinds : spec.kinds.filter((k) => k.journal === journal);
}

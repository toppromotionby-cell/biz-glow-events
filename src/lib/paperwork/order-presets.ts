// Заводские шаблоны приказов — по одному на каждый вид из реестра.
// Тексты собираются мастером создания приказа, шаблон хранит только разметку.
import type { PwPreset } from "@/lib/paperwork/preset-types";
import {
  ORDER_JOURNAL_LABELS,
  ORDER_KINDS,
  orderBlocks,
  orderPresetId,
} from "@/lib/paperwork/orders/registry";

export const ORDER_PRESETS: PwPreset[] = ORDER_KINDS.map((kind) => ({
  id: orderPresetId(kind.code),
  name: `Приказ: ${kind.label}`,
  description: `${kind.description} Журнал: ${ORDER_JOURNAL_LABELS[kind.journal]}.`,
  category: "orders",
  doc_type: "order",
  blocks: orderBlocks(kind),
}));

// Заводские шаблоны заявлений работников — по одному на вид.
import type { PwPreset } from "@/lib/paperwork/preset-types";
import {
  STATEMENT_KINDS,
  statementBlocks,
  statementPresetId,
} from "@/lib/paperwork/statements/registry";

export const STATEMENT_PRESETS: PwPreset[] = STATEMENT_KINDS.map((kind) => ({
  id: statementPresetId(kind.code),
  name: `Заявление: ${kind.label}`,
  description: kind.description,
  category: "protocols",
  doc_type: "statement",
  blocks: statementBlocks(kind),
}));

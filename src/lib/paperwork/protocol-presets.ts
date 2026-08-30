// Заводские шаблоны протоколов общего собрания участников — по одному на вид.
import type { PwPreset } from "@/lib/paperwork/preset-types";
import {
  PROTOCOL_KINDS,
  protocolBlocks,
  protocolPresetId,
} from "@/lib/paperwork/protocols/registry";

export const PROTOCOL_PRESETS: PwPreset[] = PROTOCOL_KINDS.map((kind) => ({
  id: protocolPresetId(kind.code),
  name: `Протокол: ${kind.label}`,
  description: kind.description,
  category: "protocols",
  doc_type: "protocol",
  blocks: protocolBlocks(kind),
}));

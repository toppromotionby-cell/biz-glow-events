// Тип заводского шаблона документа. Вынесен отдельно, чтобы наборы шаблонов
// (общие и по видам, например договоры займа) не импортировали друг друга по кругу.
import type { PwBlock, PwCategory, PwDocType } from "@/lib/paperwork/model";

export type PwPreset = {
  id: string;
  name: string;
  description: string;
  category: PwCategory;
  doc_type: PwDocType;
  blocks: PwBlock[];
};

// Стабильные загрузчики подсказок из базы знаний документов.
import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { suggestContacts, suggestItems, suggestTexts } from "@/lib/doc-knowledge.functions";
import type { ContactHit, ItemHit, TextHit } from "@/lib/doc-knowledge.functions";

export type { ContactHit, ItemHit, TextHit };

export function useDocSuggest() {
  const contactsFn = useServerFn(suggestContacts);
  const itemsFn = useServerFn(suggestItems);
  const textsFn = useServerFn(suggestTexts);

  const fetchContacts = useCallback(
    async (term: string): Promise<ContactHit[]> => {
      try { return await contactsFn({ data: { term } }); } catch { return []; }
    },
    [contactsFn],
  );

  const fetchItems = useCallback(
    async (term: string, section?: string): Promise<ItemHit[]> => {
      try { return await itemsFn({ data: { term, section } }); } catch { return []; }
    },
    [itemsFn],
  );

  const fetchTexts = useCallback(
    async (kind: "note" | "footer" | "section" | "venue" | "event_format" | "term", term: string): Promise<TextHit[]> => {
      try { return await textsFn({ data: { kind, term } }); } catch { return []; }
    },
    [textsFn],
  );

  return { fetchContacts, fetchItems, fetchTexts };
}

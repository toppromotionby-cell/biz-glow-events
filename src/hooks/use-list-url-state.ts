// Общее состояние списков админки в URL: поиск (?q=) и открытая запись (?id=).
// Зачем: F5, «назад» и пересланная ссылка возвращают тот же экран, а не сброс.
// Типизацию роутера оставляем на вызывающей стороне — сюда приходят уже
// разобранные search-параметры и функция их обновления.
import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export interface ListUrlSearch {
  q?: string | undefined;
  id?: string | undefined;
}

export function useListUrlState(
  search: ListUrlSearch,
  patch: (p: ListUrlSearch) => void,
  delay = 300,
) {
  const [query, setQuery] = useState(search.q ?? "");
  const debouncedQuery = useDebouncedValue(query, delay);

  useEffect(() => {
    if ((search.q ?? "") === debouncedQuery) return;
    patch({ q: debouncedQuery || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  return {
    /** Значение в поле поиска (обновляется мгновенно). */
    query,
    setQuery,
    /** Значение, по которому фильтруем список (после дебаунса). */
    debouncedQuery,
    selectedId: search.id,
    selectId: (id: string | null) => patch({ id: id ?? undefined }),
  };
}

/** Простой поиск по нескольким текстовым полям записи. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

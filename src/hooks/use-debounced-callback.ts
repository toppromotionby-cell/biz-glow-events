import { useCallback, useEffect, useRef } from "react";

/**
 * Возвращает стабильный колбэк, который вызовет `fn` через `delay` мс после
 * последнего вызова. Используется для гашения шквала realtime-событий, чтобы
 * не дёргать invalidateQueries/refetch по каждому INSERT/UPDATE.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay = 300,
) {
  const fnRef = useRef(fn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fnRef.current = fn; }, [fn]);
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return useCallback((...args: TArgs) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      fnRef.current(...args);
    }, delay);
  }, [delay]);
}

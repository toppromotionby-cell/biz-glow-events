import { useEffect, useState } from "react";

/** Возвращает значение с задержкой — для дебаунса поиска и подобных полей. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

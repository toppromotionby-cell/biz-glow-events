// Единый паттерн админ-формы: локальное состояние + zod-валидация + ошибки сервера.
// Ошибки полей показываются только после «касания» поля или попытки сохранения,
// чтобы новая запись не встречала пользователя красным экраном.
import { useCallback, useMemo, useRef, useState } from "react";
import type { ZodType } from "zod";
import { zodFieldErrors, mapServerError, type FieldErrors } from "@/lib/admin/form-errors";

export interface EntityForm<T> {
  values: T;
  /** Изменить часть полей (помечает их как «тронутые»). */
  patch: (p: Partial<T>) => void;
  setValues: (updater: T | ((prev: T) => T)) => void;
  /** Ошибки, которые нужно показать прямо сейчас. */
  errors: FieldErrors;
  /** Все ошибки валидации, включая ещё не показанные. */
  allErrors: FieldErrors;
  isValid: boolean;
  /** Показать все ошибки (вызывать перед сохранением). */
  revealErrors: () => void;
  /** Разобрать ошибку сохранения: подсветить поле и вернуть текст для тоста. */
  applyServerError: (error: unknown) => string;
  clearServerError: () => void;
}

export function useEntityForm<T extends object>(
  initial: T | (() => T),
  schema: ZodType<unknown, T> | ZodType<unknown, never> | { safeParse: (v: unknown) => { success: boolean; error?: unknown } },
  /** Преобразование значений формы в объект для валидации. */
  toInput: (values: T) => unknown = (v) => v,
): EntityForm<T> {
  const [values, setValuesState] = useState<T>(initial);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [revealed, setRevealed] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;

  const allErrors = useMemo(() => {
    const r = schema.safeParse(toInput(values));
    if (r.success) return {} as FieldErrors;
    return zodFieldErrors(r.error as import("zod").ZodError);
    // toInput стабилен по смыслу: пересчитываем только на изменение значений
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const errors = useMemo(() => {
    const visible: FieldErrors = {};
    for (const [k, v] of Object.entries(allErrors)) {
      if (revealed || touched.has(k)) visible[k] = v;
    }
    return { ...visible, ...serverErrors };
  }, [allErrors, revealed, touched, serverErrors]);

  const patch = useCallback((p: Partial<T>) => {
    const keys = Object.keys(p);
    setTouched((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
    // правка поля снимает серверную ошибку по нему
    setServerErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
    setValuesState((prev) => ({ ...prev, ...p }));
  }, []);

  const setValues = useCallback((updater: T | ((prev: T) => T)) => {
    setValuesState((prev) => (typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater));
  }, []);

  const applyServerError = useCallback((error: unknown) => {
    const mapped = mapServerError(error);
    if (mapped.field) setServerErrors((prev) => ({ ...prev, [mapped.field as string]: mapped.message }));
    setRevealed(true);
    return mapped.message;
  }, []);

  return {
    values,
    patch,
    setValues,
    errors,
    allErrors,
    isValid: Object.keys(allErrors).length === 0,
    revealErrors: useCallback(() => setRevealed(true), []),
    applyServerError,
    clearServerError: useCallback(() => setServerErrors({}), []),
  };
}

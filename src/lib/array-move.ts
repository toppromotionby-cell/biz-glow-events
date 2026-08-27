/**
 * Единый помощник перестановки соседних элементов массива.
 * Используется и в моделях документов (перенос разделов), и в UI-редакторах блоков.
 * Возвращает исходный массив, если перемещение выходит за границы.
 */
export function swapAt<T>(arr: readonly T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (index < 0 || index >= arr.length || target < 0 || target >= arr.length) return [...arr];
  const next = [...arr];
  next[index] = arr[target]!;
  next[target] = arr[index]!;
  return next;
}

/** true, если перестановка возможна (не выходит за границы). */
export function canSwapAt(length: number, index: number, dir: -1 | 1): boolean {
  const target = index + dir;
  return index >= 0 && index < length && target >= 0 && target < length;
}

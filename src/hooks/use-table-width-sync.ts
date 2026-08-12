// Синхронизация ширин: шапка таблицы, colgroup и ячейки тела всегда совпадают.
//
// Лист документа масштабируется вместе с рабочим пространством, и при
// изменении ширины панелей округления в процентах могут развести шапку и
// строки. Здесь фактические ширины первой строки тела переносятся в <col> и
// в ячейки шапки — сетка сходится при любом размере.
import { useEffect } from "react";

type Scope = Document | HTMLElement | null | undefined;

export function syncTableWidths(scope: Scope) {
  if (!scope) return;
  const tables = scope.querySelectorAll<HTMLTableElement>("table");
  tables.forEach((table) => {
    const head = table.tHead?.rows[0];
    if (!head) return;
    // Строки-разделы и объединённые ячейки («услуга») сетку не задают —
    // берём первую строку с полным набором колонок.
    const rows = Array.from(table.tBodies[0]?.rows ?? []);
    const row = rows.find(
      (r) => r.cells.length === head.cells.length && Array.from(r.cells).every((c) => c.colSpan === 1),
    );
    if (!row) return;
    const total = table.getBoundingClientRect().width;
    if (!total) return;

    const cols = table.querySelector("colgroup")?.children;
    Array.from(row.cells).forEach((cell, i) => {
      const width = cell.getBoundingClientRect().width;
      if (!width) return;
      const pct = `${((width / total) * 100).toFixed(4)}%`;
      (head.cells[i] as HTMLElement).style.width = pct;
      const col = cols?.[i] as HTMLElement | undefined;
      if (col) col.style.width = pct;
    });
  });
}

/**
 * Держит сетку таблиц ровной: пересчёт после отрисовки, при изменении
 * размеров области и при обновлении содержимого.
 */
export function useTableWidthSync(getScope: () => Scope, deps: unknown[] = []) {
  useEffect(() => {
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => syncTableWidths(getScope()));
    };
    run();
    const scope = getScope();
    const el = scope instanceof Document ? scope.documentElement : scope;
    const ro = el ? new ResizeObserver(run) : null;
    if (el && ro) ro.observe(el);
    window.addEventListener("resize", run);
    const t = window.setTimeout(run, 200);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(t);
      window.clearTimeout(t);
      ro?.disconnect();
      window.removeEventListener("resize", run);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

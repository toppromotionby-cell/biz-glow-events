import { ChevronLeft, ChevronRight } from "lucide-react";

const PER_PAGE_OPTIONS = [30, 90, 150] as const;
export type PerPage = (typeof PER_PAGE_OPTIONS)[number];

export function PaginationControls({
  total,
  page,
  perPage,
  onPageChange,
  onPerPageChange,
  className,
}: {
  total: number;
  page: number;
  perPage: PerPage;
  onPageChange: (p: number) => void;
  onPerPageChange: (p: PerPage) => void;
  className?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), pageCount);
  if (total === 0) return null;

  const pages = buildPageList(current, pageCount);

  return (
    <nav
      className={`mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 ${className ?? ""}`}
      aria-label="Пагинация"
    >
      <div className="text-sm text-muted-foreground">
        Показано {Math.min(total, (current - 1) * perPage + 1)}–{Math.min(total, current * perPage)} из {total}
      </div>

      {pageCount > 1 && (
        <ul className="flex items-center gap-1">
          <li>
            <button
              type="button"
              onClick={() => onPageChange(current - 1)}
              disabled={current === 1}
              aria-label="Предыдущая страница"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg glass border border-primary/20 disabled:opacity-40 hover:border-primary/50 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </li>
          {pages.map((p, i) =>
            p === "…" ? (
              <li key={`e${i}`} className="px-2 text-muted-foreground">…</li>
            ) : (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => onPageChange(p)}
                  aria-current={p === current ? "page" : undefined}
                  className={`h-9 min-w-9 px-3 inline-flex items-center justify-center rounded-lg border transition text-sm ${
                    p === current
                      ? "bg-primary text-primary-foreground border-primary"
                      : "glass border-primary/20 hover:border-primary/50"
                  }`}
                >
                  {p}
                </button>
              </li>
            ),
          )}
          <li>
            <button
              type="button"
              onClick={() => onPageChange(current + 1)}
              disabled={current === pageCount}
              aria-label="Следующая страница"
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg glass border border-primary/20 disabled:opacity-40 hover:border-primary/50 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </li>
        </ul>
      )}

      <label className="text-sm text-muted-foreground inline-flex items-center gap-2">
        На странице:
        <select
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value) as PerPage)}
          className="glass border border-primary/20 rounded-lg px-2 py-1.5 text-sm bg-transparent hover:border-primary/50 transition"
        >
          {PER_PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
    </nav>
  );
}

function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

export { PER_PAGE_OPTIONS };

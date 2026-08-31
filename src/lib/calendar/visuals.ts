// Визуальные ответы ассистента: картинки (графики) и моноширинные таблицы.
// Картинки строятся как URL к рендереру графиков — Telegram сам скачивает файл,
// поэтому в воркере не нужен canvas и нативные зависимости.
import type { CalDirection, CalItem } from "@/lib/calendar/model";

const CHART = "https://quickchart.io/chart";

/** Локальные часы (например 14.5) для даты в нужном часовом поясе. */
export function hoursIn(iso: string, tz: string): number {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h + m / 60;
}

export function dayKey(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: tz, day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

/** Лимит длины URL: длиннее Telegram/QuickChart не примут. */
export const CHART_URL_LIMIT = 3800;

function chartUrl(config: unknown, w = 900, h = 500): string | null {
  const url = `${CHART}?w=${w}&h=${h}&bkg=white&f=png&c=${encodeURIComponent(JSON.stringify(config))}`;
  return url.length > CHART_URL_LIMIT ? null : url;
}


function colorOf(item: CalItem, dirs: CalDirection[]): string {
  const dir = dirs.find((d) => d.id === item.direction_id);
  if (item.status === "done") return "#94a3b8";
  return dir?.color ?? (item.kind === "meeting" ? "#3b82f6" : "#64748b");
}

function short(s: string, n = 34): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * Таймлайн дня: горизонтальные полосы «с — по» по каждой записи.
 * Возвращает null, если рисовать нечего (нет записей со временем).
 */
export function dayTimelineUrl(title: string, items: CalItem[], dirs: CalDirection[], tz: string): string | null {
  const timed = items.filter((i) => i.starts_at && !i.all_day).slice(0, 14);
  if (!timed.length) return null;
  const labels = timed.map((i) => short(i.title));
  const data = timed.map((i) => {
    const from = hoursIn(i.starts_at as string, tz);
    const to = i.ends_at ? hoursIn(i.ends_at, tz) : from + 1;
    return [from, Math.max(to, from + 0.5)];
  });
  const min = Math.max(0, Math.floor(Math.min(...data.map((d) => d[0] as number)) - 1));
  const max = Math.min(24, Math.ceil(Math.max(...data.map((d) => d[1] as number)) + 1));
  return chartUrl(
    {
      type: "horizontalBar",
      data: {
        labels,
        datasets: [{ data, backgroundColor: timed.map((i) => colorOf(i, dirs)) }],
      },
      options: {
        title: { display: true, text: title, fontSize: 18 },
        legend: { display: false },
        scales: {
          xAxes: [{ ticks: { min, max, stepSize: 1, callback: "__H__" }, gridLines: { color: "#e2e8f0" } }],
          yAxes: [{ ticks: { fontSize: 12 } }],
        },
      },
    },
    900,
    Math.max(260, 90 + labels.length * 34),
  ).replace("%22__H__%22", encodeURIComponent("function(v){return v+':00'}"));
}

/** Загрузка недели: столбики «сколько записей в день», раскрашенные по направлениям. */
export function weekLoadUrl(title: string, items: CalItem[], dirs: CalDirection[], tz: string): string | null {
  const dated = items.filter((i) => i.starts_at ?? i.due_at);
  if (!dated.length) return null;
  const days: string[] = [];
  for (const i of dated) {
    const k = dayKey((i.starts_at ?? i.due_at) as string, tz);
    if (!days.includes(k)) days.push(k);
  }
  days.sort((a, b) => {
    const [da, ma] = a.split(".");
    const [db, mb] = b.split(".");
    return Number(ma) - Number(mb) || Number(da) - Number(db);
  });
  const groups = [...dirs, null as CalDirection | null];
  const datasets = groups
    .map((g) => ({
      label: g?.title ?? "Без направления",
      backgroundColor: g?.color ?? "#cbd5e1",
      data: days.map(
        (d) =>
          dated.filter(
            (i) => dayKey((i.starts_at ?? i.due_at) as string, tz) === d && (i.direction_id ?? null) === (g?.id ?? null),
          ).length,
      ),
    }))
    .filter((ds) => ds.data.some((n) => n > 0));
  return chartUrl({
    type: "bar",
    data: { labels: days, datasets },
    options: {
      title: { display: true, text: title, fontSize: 18 },
      legend: { position: "bottom" },
      scales: {
        xAxes: [{ stacked: true }],
        yAxes: [{ stacked: true, ticks: { beginAtZero: true, precision: 0 } }],
      },
    },
  });
}

/** Круговая диаграмма распределения по направлениям. */
export function directionPieUrl(
  title: string,
  slices: Array<{ label: string; value: number; color: string }>,
): string | null {
  const use = slices.filter((s) => s.value > 0);
  if (!use.length) return null;
  return chartUrl(
    {
      type: "doughnut",
      data: {
        labels: use.map((s) => s.label),
        datasets: [{ data: use.map((s) => s.value), backgroundColor: use.map((s) => s.color) }],
      },
      options: { title: { display: true, text: title, fontSize: 18 }, legend: { position: "right" } },
    },
    800,
    420,
  );
}

/** Моноширинная таблица для Telegram (<pre>) — работает без картинок. */
export function renderTable(headers: string[], rows: string[][]): string {
  const all = [headers, ...rows];
  const widths = headers.map((_, c) => Math.min(28, Math.max(...all.map((r) => (r[c] ?? "").length))));
  const pad = (s: string, w: number) => (s.length > w ? `${s.slice(0, w - 1)}…` : s.padEnd(w));
  const line = (r: string[]) => r.map((c, i) => pad(c ?? "", widths[i] as number)).join(" │ ");
  const sep = widths.map((w) => "─".repeat(w)).join("─┼─");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<pre>${esc([line(headers), sep, ...rows.map(line)].join("\n"))}</pre>`;
}

/** Таблица записей: время, тип, направление, название. */
export function itemsTable(items: CalItem[], dirs: CalDirection[], tz: string): string {
  const fmt = (i: CalItem) => {
    const iso = i.starts_at ?? i.due_at;
    if (!iso) return "—";
    if (i.all_day || !i.starts_at) return dayKey(iso, tz);
    return new Intl.DateTimeFormat("ru-RU", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  };
  return renderTable(
    ["Время", "Тип", "Направление", "Что"],
    items.slice(0, 20).map((i) => [
      fmt(i),
      i.kind === "meeting" ? "встреча" : "задача",
      dirs.find((d) => d.id === i.direction_id)?.title ?? "—",
      i.title,
    ]),
  );
}

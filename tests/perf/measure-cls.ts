// Измеряет CLS на ключевых страницах через PerformanceObserver и сохраняет
// отчёт в tests/perf/cls-report.md. Запускается локально и в CI:
//   bun run tests/perf/measure-cls.ts
//
// Не используем Lighthouse CLI — в Worker-sandbox нет полного Chromium с
// CDP-портом, а нам нужны только layout-shift entries для каталога.
import { chromium, type Page } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const PAGES = [
  { name: "home", path: "/" },
  { name: "equipment", path: "/equipment" },
  { name: "services", path: "/services" },
];

type Shift = { value: number; sources: string[] };

async function measure(page: Page, url: string): Promise<{ cls: number; shifts: Shift[] }> {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number; __shifts: Shift[] }).__cls = 0;
    (window as unknown as { __shifts: Shift[] }).__shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntry[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e = entry as any;
        if (e.hadRecentInput) continue;
        (window as unknown as { __cls: number }).__cls += e.value;
        const sources: string[] = ((e.sources ?? []) as Array<{ node: Element | null }>).map((s) => {
          const n = s.node;
          if (!n || !(n instanceof Element)) return "(unknown)";
          const cls = n.className && typeof n.className === "string" ? `.${n.className.split(/\s+/).slice(0, 2).join(".")}` : "";
          return `${n.tagName.toLowerCase()}${cls}`;
        });
        (window as unknown as { __shifts: Shift[] }).__shifts.push({ value: e.value, sources });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(url, { waitUntil: "networkidle" });
  // даём шрифтам и lazy-картинкам успеть вызвать поздние shifts
  await page.waitForTimeout(2500);
  return page.evaluate(() => ({
    cls: (window as unknown as { __cls: number }).__cls,
    shifts: (window as unknown as { __shifts: Shift[] }).__shifts,
  }));
}

async function main() {
  const base = process.env.PW_BASE_URL ?? "http://localhost:8080";
  const browser = await chromium.launch({ headless: true });
  const results: Array<{ device: string; page: string; cls: number; topShifts: Shift[] }> = [];

  for (const device of [
    { name: "mobile", viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    { name: "desktop", viewport: { width: 1280, height: 900 } },
  ]) {
    const ctx = await browser.newContext(device);
    const page = await ctx.newPage();
    for (const p of PAGES) {
      const { cls, shifts } = await measure(page, `${base}${p.path}`);
      shifts.sort((a, b) => b.value - a.value);
      results.push({ device: device.name, page: p.name, cls, topShifts: shifts.slice(0, 5) });
      console.log(`[${device.name}] ${p.path} CLS=${cls.toFixed(4)} shifts=${shifts.length}`);
    }
    await ctx.close();
  }
  await browser.close();

  const md = [
    "# CLS Report — каталог карточек",
    "",
    `Сгенерирован: ${new Date().toISOString()}`,
    `Цель: CLS < 0.1 (good), идеал < 0.02 для каталога.`,
    "",
    "| Device | Page | CLS | Verdict |",
    "|---|---|---:|---|",
    ...results.map((r) => {
      const v = r.cls < 0.02 ? "✅ excellent" : r.cls < 0.1 ? "🟢 good" : r.cls < 0.25 ? "🟡 needs improvement" : "🔴 poor";
      return `| ${r.device} | ${r.page} | ${r.cls.toFixed(4)} | ${v} |`;
    }),
    "",
    "## Топ-источники сдвигов",
    "",
    ...results.flatMap((r) => [
      `### ${r.device} — ${r.page}`,
      "",
      r.topShifts.length === 0
        ? "_нет сдвигов_"
        : r.topShifts
            .map((s, i) => `${i + 1}. **${s.value.toFixed(4)}** — ${s.sources.join(", ") || "(no source)"}`)
            .join("\n"),
      "",
    ]),
  ].join("\n");

  const out = "tests/perf/cls-report.md";
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, md);
  console.log(`\nReport saved to ${out}`);

  const max = Math.max(...results.map((r) => r.cls));
  if (process.env.CI && max > 0.1) {
    console.error(`\n❌ CLS ${max.toFixed(4)} exceeds budget 0.1`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

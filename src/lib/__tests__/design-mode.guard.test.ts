/**
 * Гард дизайн-мода «Ember Board».
 * Ловит возврат старых паттернов: фиксированные контейнеры, жёсткие сетки
 * без адаптива и хардкод-цвета в компонентах интерфейса.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      walk(full, out);
    } else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const FILES = walk("src");

/** Файлы, где белый/чёрный — часть контента (превью PDF, видео, фото-оверлеи, показ слайдов). */
const COLOR_ALLOW = [
  "presentations/",
  "dj/",
  "dj.index",
  "CoverArt",
  "CatalogGrid",
  "CatalogDetail",
  "CatalogQuickView",
  "admin.orders.$id",
  "admin.campaigns",
  "admin.settings.emails",
  "admin.documents.quotes",
  "LogoHeaderDesigner",
  "HeroSection",
];

describe("design mode: Ember Board", () => {
  it("страницы используют page-shell вместо фиксированного container mx-auto px-4", () => {
    const bad = FILES.filter((f) => /container mx-auto px-4/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });

  it("нет жёстких grid-cols без адаптивных вариантов или авто-сеток", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/className="([^"]*\bgrid-cols-[3-9]\b[^"]*)"/g)) {
        const cls = m[1] as string;
        if (/(sm|md|lg|xl):grid-cols-/.test(cls)) continue;
        if (/grid-(cards|tiles|fields|stats|auto)/.test(cls)) continue;
        bad.push(`${f}: ${cls}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("нет хардкод-цветов темы в обычных компонентах", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      if (COLOR_ALLOW.some((a) => f.includes(a))) continue;
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/className="([^"]*)"/g)) {
        const cls = m[1] as string;
        if (/\b(text-white|text-black|bg-white|bg-black)\b/.test(cls)) bad.push(`${f}: ${cls}`);
        if (/\b(bg|text|border)-\[#/.test(cls)) bad.push(`${f}: ${cls}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

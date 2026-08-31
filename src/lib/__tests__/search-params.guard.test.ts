/**
 * Гард фильтров: маршрут, читающий параметры из URL, обязан их валидировать.
 *
 * Без validateSearch «мусорный» параметр из рекламы или старая ссылка
 * ломают страницу (undefined в фильтрах, пустая выдача, ошибка рендера).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__tests__") continue;
      walk(full, out);
    } else if (/\.tsx$/.test(full)) out.push(full);
  }
  return out;
}

const ROUTE_FILES = walk("src/routes");

describe("фильтры и состояние в URL", () => {
  it("каждый маршрут с useSearch объявляет validateSearch", () => {
    const bad: string[] = [];
    for (const f of ROUTE_FILES) {
      const src = readFileSync(f, "utf8");
      if (!/Route\.useSearch\(|useSearch\(\{/.test(src)) continue;
      if (!/validateSearch/.test(src)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });

  it("обновление фильтров сохраняет остальные параметры (функциональная форма search)", () => {
    const bad: string[] = [];
    for (const f of ROUTE_FILES) {
      const src = readFileSync(f, "utf8");
      if (!/validateSearch/.test(src)) continue;
      // Полная замена объекта в navigate стирает соседние фильтры.
      for (const m of src.matchAll(/navigate\(\{[^)]*search:\s*\{/g)) {
        const tail = src.slice(m.index ?? 0, (m.index ?? 0) + 200);
        if (!/replace:\s*true/.test(tail) && !/reset|clear/i.test(tail)) {
          bad.push(`${f}: navigate с полной заменой search`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("фильтры не читают window.location напрямую", () => {
    const bad: string[] = [];
    for (const f of ROUTE_FILES) {
      const src = readFileSync(f, "utf8");
      if (/window\.location\.search/.test(src)) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
});

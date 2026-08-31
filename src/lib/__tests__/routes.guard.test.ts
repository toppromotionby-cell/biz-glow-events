/**
 * Гард навигации: все ссылки в приложении должны вести на существующие
 * маршруты, а динамические сегменты — получать params.
 *
 * Ловит опечатки в путях, ссылки на удалённые страницы и интерполяцию
 * вида `/orders/${id}` вместо params.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** URL-пути всех маршрутов, собранные из имён файлов src/routes. */
export function routePathsFromFiles(dir = "src/routes"): Set<string> {
  const out = new Set<string>();
  for (const name of readdirSync(dir)) {
    if (name.startsWith("__")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "api") continue;
      for (const p of routePathsFromFiles(full)) out.add(p);
      continue;
    }
    if (!/\.(tsx|ts)$/.test(name)) continue;
    const base = name.replace(/\.(tsx|ts)$/, "");
    // Спец-файлы вида sitemap[.]xml, llms[.]txt — это не страницы приложения.
    if (base.includes("[.]")) continue;
    const rel = join(dir, base).replace(/^src\/routes/, "");
    let path = rel.replace(/\./g, "/");
    path = path.replace(/\/index$/, "");
    // Pathless-лейауты (_authenticated) не попадают в URL.
    path = path.replace(/\/_[^/]+/g, "");
    out.add(path === "" ? "/" : path);
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      walk(full, out);
    } else if (/\.(tsx|ts)$/.test(full)) out.push(full);
  }
  return out;
}

const ROUTES = routePathsFromFiles();
const FILES = walk("src");

/** Внешние/служебные пути, которые маршрутами не являются. */
const NON_ROUTE = new Set(["/", "/api", "/sitemap.xml", "/robots.txt", "/llms.txt"]);

function known(path: string) {
  if (NON_ROUTE.has(path)) return true;
  if (ROUTES.has(path)) return true;
  // Ссылка на конкретное значение динамического сегмента: /zones/vr-arena
  const parts = path.split("/");
  for (const r of ROUTES) {
    const rp = r.split("/");
    if (rp.length !== parts.length) continue;
    if (rp.every((seg, i) => seg.startsWith("$") || seg === parts[i])) return true;
  }
  return false;
}

describe("навигация: ссылки ведут на существующие маршруты", () => {
  it("карта маршрутов собирается", () => {
    expect(ROUTES.has("/")).toBe(true);
    expect(ROUTES.has("/admin/orders")).toBe(true);
    expect(ROUTES.has("/zones/$slug")).toBe(true);
  });

  it("каждый <Link to> / navigate({ to }) указывает на существующий маршрут", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\bto[=:]\s*"(\/[^"${}]*)"/g)) {
        const p = (m[1] as string).replace(/\/$/, "") || "/";
        if (!known(p)) bad.push(`${f}: to="${p}"`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("внутренние href ведут на существующие маршруты", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\bhref=\{?["`](\/[^"`]*)["`]/g)) {
        const raw = m[1] as string;
        const interpolated = raw.includes("${");
        // Шаблонные строки проверяем по статическому префиксу.
        const p = (raw.split(/[$?#]/)[0] ?? "").replace(/\/$/, "") || "/";
        const ok = interpolated
          ? [...ROUTES].some((r) => r === p || r.startsWith(`${p}/`))
          : known(p);
        if (!ok) bad.push(`${f}: href="${raw}"`);
      }


    }
    expect(bad).toEqual([]);
  });

  it("ссылки с динамическим сегментом передают params", () => {
    const bad: string[] = [];
    for (const f of FILES) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/\bto[=:]\s*"(\/[^"]*\$[^"]*)"/g)) {
        const tail = src.slice((m.index ?? 0), (m.index ?? 0) + 600);
        if (!/\bparams\s*[=:]/.test(tail)) bad.push(`${f}: ${m[1]} без params`);
      }
    }
    expect(bad).toEqual([]);
  });
});

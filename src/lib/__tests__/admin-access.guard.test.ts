/**
 * Гард админки: соответствие пунктов меню, маршрутов и прав доступа.
 *
 * Ловит: пункт меню на несуществующий раздел, раздел без права в матрице,
 * несовпадение права в меню и в ROUTE_PERMISSIONS (пункт видно, а внутрь не пускает).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MATRIX, ROUTE_PERMISSIONS, permissionForPath, roleHasPermission } from "@/lib/permissions";
import { routePathsFromFiles } from "./routes.guard.test";

const ROUTES = routePathsFromFiles();
const sidebar = readFileSync("src/components/admin/AdminSidebar.tsx", "utf8");

type Item = { to: string; perm?: string };
const items: Item[] = [...sidebar.matchAll(/\{\s*to:\s*"(\/admin[^"]*)"[^}]*\}/g)].map((m) => {
  const block = m[0] as string;
  const perm = block.match(/perm:\s*"([^"]+)"/)?.[1];
  return perm ? { to: m[1] as string, perm } : { to: m[1] as string };
});

function routeExists(path: string) {
  if (ROUTES.has(path)) return true;
  const parts = path.split("/");
  for (const r of ROUTES) {
    const rp = r.split("/");
    if (rp.length !== parts.length) continue;
    if (rp.every((seg, i) => seg.startsWith("$") || seg === parts[i])) return true;
  }
  return false;
}

describe("админка: меню, маршруты и права", () => {
  it("меню разобрано", () => {
    expect(items.length).toBeGreaterThan(15);
  });

  it("каждый пункт меню ведёт на существующий раздел", () => {
    const bad = items.filter((i) => !routeExists(i.to)).map((i) => i.to);
    expect(bad).toEqual([]);
  });

  it("право в меню совпадает с правом маршрута", () => {
    const bad: string[] = [];
    for (const i of items) {
      const routePerm = permissionForPath(i.to);
      if (!routePerm) continue;
      if (i.perm && i.perm !== routePerm) bad.push(`${i.to}: меню=${i.perm}, маршрут=${routePerm}`);
      if (!i.perm) bad.push(`${i.to}: маршрут требует ${routePerm}, а пункт меню без perm`);
    }
    expect(bad).toEqual([]);
  });

  it("каждый защищённый раздел админки покрыт правилом доступа", () => {
    // Справочный центр доступен любому сотруднику намеренно.
    const openToAllStaff = /^\/admin\/help/;
    const unmatched = [...ROUTES]
      .filter((r) => r.startsWith("/admin/") && !openToAllStaff.test(r))
      .filter((r) => !permissionForPath(r));
    expect(unmatched).toEqual([]);
  });


  it("все права из правил маршрутов существуют в матрице ролей", () => {
    const all = new Set(Object.values(MATRIX).flat());
    const bad = ROUTE_PERMISSIONS.map((r) => r.perm).filter((p) => !all.has(p));
    expect(bad).toEqual([]);
  });

  it("роль admin имеет доступ ко всем разделам админки", () => {
    const bad = ROUTE_PERMISSIONS.filter((r) => !roleHasPermission(["admin"], r.perm)).map((r) => r.perm);
    expect(bad).toEqual([]);
  });
});

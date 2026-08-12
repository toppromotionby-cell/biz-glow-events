// Этап 6: маршруты и права. Тесты фиксируют, что каждый раздел админки
// защищён правилом доступа и что роли видят ровно свои разделы.
import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import {
  permissionsForRoles,
  roleHasPermission,
  isStaffRoles,
  permissionForPath,
  firstAllowedAdminPath,
  STAFF_ROLES,
} from "./permissions";

/** Роуты, которым право не нужно: сам лейаут и общий дашборд. */
const NO_PERMISSION_ROUTES = new Set(["/admin", "/admin/"]);

function adminRoutePaths(): string[] {
  return readdirSync("src/routes")
    .filter((f) => f.startsWith("admin") && f.endsWith(".tsx"))
    .map((f) =>
      "/" +
      f
        .replace(/\.tsx$/, "")
        .split(".")
        .filter((seg) => seg !== "index")
        .map((seg) => (seg.startsWith("$") ? "id" : seg))
        .join("/"),
    );
}

describe("матрица ролей", () => {
  it("контент-редактор не имеет доступа к заказам, документам и настройкам", () => {
    const p = permissionsForRoles(["content_editor"]);
    expect([...p]).toEqual(["content.manage"]);
    expect(roleHasPermission(["content_editor"], "orders.manage")).toBe(false);
    expect(roleHasPermission(["content_editor"], "documents.finance")).toBe(false);
    expect(roleHasPermission(["content_editor"], "system.manage")).toBe(false);
  });

  it("менеджер не видит себестоимость, пользователей и аудит", () => {
    for (const perm of ["documents.cost_margin", "users.manage", "audit.view", "system.manage"] as const) {
      expect(roleHasPermission(["manager"], perm)).toBe(false);
    }
    expect(roleHasPermission(["manager"], "orders.manage")).toBe(true);
  });

  it("бухгалтер работает с документами, но не с каталогом и пользователями", () => {
    expect(roleHasPermission(["accountant"], "documents.finance")).toBe(true);
    expect(roleHasPermission(["accountant"], "content.manage")).toBe(false);
    expect(roleHasPermission(["accountant"], "users.manage")).toBe(false);
  });

  it("клиент не сотрудник и не имеет прав", () => {
    expect(isStaffRoles(["client"])).toBe(false);
    expect(permissionsForRoles(["client"]).size).toBe(0);
  });

  it("несколько ролей объединяют права", () => {
    const p = permissionsForRoles(["content_editor", "accountant"]);
    expect(p.has("content.manage")).toBe(true);
    expect(p.has("documents.finance")).toBe(true);
  });

  it("любая staff-роль пускает в админку", () => {
    for (const r of STAFF_ROLES) expect(isStaffRoles([r])).toBe(true);
  });
});

describe("права по маршрутам", () => {
  it("каждый файл роута админки защищён правилом", () => {
    const unguarded = adminRoutePaths().filter(
      (p) => !NO_PERMISSION_ROUTES.has(p) && permissionForPath(p) === null,
    );
    expect(unguarded).toEqual([]);
  });

  it("финансовые документы требуют отдельного права", () => {
    expect(permissionForPath("/admin/documents/finance/abc/render")).toBe("documents.finance");
    expect(permissionForPath("/admin/documents/quotes/abc")).toBe("documents.manage");
    expect(permissionForPath("/admin/documents/knowledge")).toBe("documents.knowledge");
    expect(permissionForPath("/admin/settings/documents")).toBe("documents.settings");
    expect(permissionForPath("/admin/settings/social")).toBe("system.manage");
  });

  it("контент-редактор не проходит в заказы, но проходит в каталог", () => {
    const perms = permissionsForRoles(["content_editor"]);
    expect(perms.has(permissionForPath("/admin/orders")!)).toBe(false);
    expect(perms.has(permissionForPath("/admin/catalog/zones")!)).toBe(true);
  });
});

describe("firstAllowedAdminPath", () => {
  it("уводит роль на её первый доступный раздел", () => {
    expect(firstAllowedAdminPath(permissionsForRoles(["admin"]))).toBe("/admin/orders");
    expect(firstAllowedAdminPath(permissionsForRoles(["content_editor"]))).toBe("/admin/catalog-structure");
    expect(firstAllowedAdminPath(permissionsForRoles(["accountant"]))).toBe("/admin/orders");
    expect(firstAllowedAdminPath(permissionsForRoles(["client"]))).toBe("/profile");
  });

  it("возвращает только разрешённый маршрут", () => {
    for (const role of STAFF_ROLES) {
      const perms = permissionsForRoles([role]);
      const target = firstAllowedAdminPath(perms);
      const need = permissionForPath(target);
      expect(need === null || perms.has(need)).toBe(true);
    }
  });
});

import { describe, expect, it, vi } from "vitest";
import { entityKeys, invalidateEntity, type AdminEntity } from "./invalidate";
import { adminKeys } from "@/lib/query-keys";

const ALL: AdminEntity[] = [
  "social",
  "site-settings",
  "catalog-structure",
  "emails",
  "paperwork",
  "documents",
  "company-profiles",
];

describe("invalidateEntity", () => {
  it("у каждой сущности есть хотя бы один ключ", () => {
    for (const e of ALL) expect(entityKeys(e).length).toBeGreaterThan(0);
  });

  it("настройки соцсетей сбрасывают и публичный кэш сайта", () => {
    expect(entityKeys("social")).toContain(adminKeys.siteSettingsPublic);
  });

  it("структура каталога сбрасывает меню каталога", () => {
    expect(entityKeys("catalog-structure")).toContain(adminKeys.catalogNav);
  });

  it("вызывает invalidateQueries по всем ключам сущностей", () => {
    const qc = { invalidateQueries: vi.fn() };
    invalidateEntity(qc as never, "social", "catalog-structure");
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(
      entityKeys("social").length + entityKeys("catalog-structure").length,
    );
  });
});

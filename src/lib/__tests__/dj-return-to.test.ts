import { describe, expect, it } from "vitest";
import { djReturnTo, djAbsoluteUrl, DJ_DEFAULT_RETURN, DJ_RETURN_ROUTES } from "@/lib/dj/return-to";
import { djEntryFor } from "@/components/dj/DjEntryLink";

describe("djReturnTo", () => {
  it("сохраняет разрешённые DJ-маршруты", () => {
    for (const r of DJ_RETURN_ROUTES) expect(djReturnTo(r)).toBe(r);
  });

  it("сохраняет query-строку фильтров", () => {
    expect(djReturnTo("/dj/pool", "?genre=house")).toBe("/dj/pool?genre=house");
    expect(djReturnTo("/dj/pool", "genre=house")).toBe("/dj/pool?genre=house");
  });

  it("отбрасывает внешние и неизвестные пути", () => {
    expect(djReturnTo("https://evil.tld/dj/pool")).toBe(DJ_DEFAULT_RETURN);
    expect(djReturnTo("//evil.tld")).toBe(DJ_DEFAULT_RETURN);
    expect(djReturnTo("/admin/dj/members")).toBe(DJ_DEFAULT_RETURN);
    expect(djReturnTo(null, null)).toBe(DJ_DEFAULT_RETURN);
  });

  it("режет подозрительный query", () => {
    expect(djReturnTo("/dj/pool", '?q="><script>')).toBe("/dj/pool");
  });
});

describe("djAbsoluteUrl", () => {
  it("строит абсолютную ссылку для писем", () => {
    expect(djAbsoluteUrl()).toBe("https://event-hub.by/dj/pool");
    expect(djAbsoluteUrl("/dj/software")).toBe("https://event-hub.by/dj/software");
    expect(djAbsoluteUrl("/admin")).toBe("https://event-hub.by/dj/pool");
  });
});

describe("djEntryFor", () => {
  it("участника ведёт в библиотеку", () => {
    expect(djEntryFor({ isMember: true, status: "approved" })?.href).toBe(DJ_DEFAULT_RETURN);
  });

  it("ожидающего и новичка — на витрину", () => {
    expect(djEntryFor({ isMember: false, status: "pending" })?.href).toBe("/dj");
    expect(djEntryFor({ isMember: false, status: null })?.href).toBe("/dj");
  });

  it("заблокированному ссылку не показываем", () => {
    expect(djEntryFor({ isMember: false, status: "blocked" })).toBeNull();
    expect(djEntryFor(undefined)).toBeNull();
  });
});

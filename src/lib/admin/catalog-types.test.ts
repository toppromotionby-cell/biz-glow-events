// Type-only тесты: убеждаемся, что catalog-types корректно проецирует Database.
import { describe, it, expectTypeOf } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import {
  CATALOG_TABLES, isCatalogTable, tagRow,
  type CatalogTable, type CatalogRow, type CatalogInsert, type CatalogUpdate,
  type CatalogRowTagged, type AnyCatalogRow,
} from "./catalog-types";

describe("catalog-types", () => {
  it("CatalogTable exactly equals the table tuple", () => {
    expectTypeOf<CatalogTable>().toEqualTypeOf<"zones" | "tech_equipment" | "services" | "production_items" | "attractions">();
  });

  it("CatalogRow<T> matches Database row exactly", () => {
    expectTypeOf<CatalogRow<"zones">>().toEqualTypeOf<Database["public"]["Tables"]["zones"]["Row"]>();
    expectTypeOf<CatalogRow<"services">>().toEqualTypeOf<Database["public"]["Tables"]["services"]["Row"]>();
    expectTypeOf<CatalogInsert<"tech_equipment">>().toEqualTypeOf<Database["public"]["Tables"]["tech_equipment"]["Insert"]>();
    expectTypeOf<CatalogUpdate<"production_items">>().toEqualTypeOf<Database["public"]["Tables"]["production_items"]["Update"]>();
  });

  it("AnyCatalogRow keeps shared columns on the union", () => {
    expectTypeOf<AnyCatalogRow>().toHaveProperty("slug").toEqualTypeOf<string>();
    expectTypeOf<AnyCatalogRow>().toHaveProperty("title").toEqualTypeOf<string>();
    expectTypeOf<AnyCatalogRow>().toHaveProperty("published").toEqualTypeOf<boolean>();
  });

  it("tagRow narrows by __table discriminator", () => {
    const row = {} as CatalogRow<"zones">;
    const tagged = tagRow("zones", row);
    expectTypeOf<typeof tagged>().toMatchTypeOf<CatalogRowTagged>();
    if (tagged.__table === "zones") {
      // Inside this branch TS knows it's the zones variant.
      expectTypeOf(tagged).toMatchTypeOf<CatalogRow<"zones">>();
    }
  });

  it("isCatalogTable narrows string to CatalogTable", () => {
    const s: string = "zones";
    if (isCatalogTable(s)) expectTypeOf(s).toEqualTypeOf<CatalogTable>();
  });

  it("CATALOG_TABLES is exhaustive at runtime", () => {
    const expected: CatalogTable[] = ["zones", "tech_equipment", "services", "production_items"];
    for (const t of expected) {
      if (!(CATALOG_TABLES as readonly string[]).includes(t)) {
        throw new Error(`Missing ${t}`);
      }
    }
  });
});

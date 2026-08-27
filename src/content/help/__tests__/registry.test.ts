// Регрессионные проверки справки: уникальные id, живые перекрёстные ссылки,
// заполненная структура и наличие статей в каждой категории.
import { describe, expect, it } from "vitest";
import { HELP_ARTICLES, HELP_CATEGORIES, articlesByCategory, searchHelp } from "../registry";

describe("справка для сотрудников", () => {
  it("id статей уникальны", () => {
    const ids = HELP_ARTICLES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("все related-ссылки ведут на существующие статьи", () => {
    const ids = new Set(HELP_ARTICLES.map((a) => a.id));
    const broken = HELP_ARTICLES.flatMap((a) =>
      (a.related ?? []).filter((r) => !ids.has(r)).map((r) => `${a.id} -> ${r}`),
    );
    expect(broken).toEqual([]);
  });

  it("у каждой статьи есть заголовок, описание и блоки", () => {
    for (const a of HELP_ARTICLES) {
      expect(a.title.length).toBeGreaterThan(3);
      expect(a.summary.length).toBeGreaterThan(3);
      expect(a.blocks.length).toBeGreaterThan(1);
    }
  });

  it("в каждой категории есть хотя бы одна статья", () => {
    for (const c of HELP_CATEGORIES) {
      expect(articlesByCategory(c.id).length).toBeGreaterThan(0);
    }
  });

  it("категория статьи объявлена в реестре категорий", () => {
    const known = new Set(HELP_CATEGORIES.map((c) => c.id));
    for (const a of HELP_ARTICLES) expect(known.has(a.category)).toBe(true);
  });

  it("поиск находит статью по заголовку", () => {
    expect(searchHelp("Информационная").length).toBeGreaterThan(0);
    expect(searchHelp("я").length).toBe(0);
  });

  it("статей достаточно для покрытия функционала админки", () => {
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(60);
  });
});

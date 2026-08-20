import { describe, expect, it } from "vitest";
import { hyphenPoints, softHyphenate, splitWordForWidth, SOFT_HYPHEN } from "@/lib/documents/hyphenate";

const VOWELS = "аеёиоуыэюяaeiouy";
const parts = (w: string) => {
  const pts = hyphenPoints(w);
  const out: string[] = [];
  let prev = 0;
  for (const i of pts) {
    out.push(w.slice(prev, i + 1));
    prev = i + 1;
  }
  out.push(w.slice(prev));
  return out;
};

describe("hyphenPoints", () => {
  it("режет длинные слова по слогам", () => {
    for (const w of ["администрирование", "транспортные", "монтажник", "оборудование"]) {
      const p = parts(w);
      expect(p.length).toBeGreaterThan(1);
      expect(p.join("")).toBe(w);
      // в каждой части есть гласная и минимум 2 буквы
      for (const seg of p) {
        expect(seg.length).toBeGreaterThanOrEqual(2);
        expect([...seg].some((ch) => VOWELS.includes(ch))).toBe(true);
      }
    }
  });

  it("не начинает часть с ь, ъ, й", () => {
    for (const w of ["стройплощадка", "объединение", "пользователь"]) {
      for (const seg of parts(w)) expect("ьъй").not.toContain(seg[0]!);
    }
  });

  it("не переносит короткие слова, числа и аббревиатуры", () => {
    for (const w of ["услуга", "шт", "2026", "УНП", "1200"]) expect(hyphenPoints(w)).toEqual([]);
  });
});

describe("softHyphenate", () => {
  it("вставляет мягкий перенос и сохраняет текст", () => {
    const src = "Администрирование проекта 2026";
    const res = softHyphenate(src);
    expect(res).toContain(SOFT_HYPHEN);
    expect(res.replaceAll(SOFT_HYPHEN, "")).toBe(src);
  });

  it("не трогает числа и знаки", () => {
    expect(softHyphenate("1200,50 BYN")).toBe("1200,50 BYN");
  });
});

describe("splitWordForWidth", () => {
  const measure = (s: string) => s.length; // 1 «px» на символ

  it("возвращает часть с дефисом, влезающую в ширину", () => {
    const r = splitWordForWidth("администрирование", 10, measure);
    expect(r).not.toBeNull();
    expect(r!.head.endsWith("-")).toBe(true);
    expect(measure(r!.head)).toBeLessThanOrEqual(10);
    expect(r!.head.slice(0, -1) + r!.tail).toBe("администрирование");
  });

  it("null, если точки переноса нет", () => {
    expect(splitWordForWidth("шт", 10, measure)).toBeNull();
  });
});

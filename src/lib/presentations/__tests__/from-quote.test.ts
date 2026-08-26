import { describe, expect, it } from "vitest";
import { buildStoryboard, diffSlidesAgainstItems, stepsToSlideRows, type StoryItem, type StoryMeta, type StoryTotals } from "@/lib/presentations/from-quote";

const meta: StoryMeta = {
  title: "Свадьба в Мирском замке",
  number: "КП-1",
  clientName: "Иван",
  clientCompany: "ООО Ромашка",
  eventDate: "2026-07-12",
  venue: "Мирский замок",
  about: "Мы делаем мероприятия под ключ.",
  terms: "Предоплата 50%.",
  currency: "BYN",
};

const totals: StoryTotals = {
  subtotal: 1000, discount: 0, delivery: 100, management: 50, agencyFee: 20, vat: 0, total: 1170, prepayment: 585,
};

const item = (over: Partial<StoryItem>): StoryItem => ({
  id: over.id ?? "11111111-1111-1111-1111-111111111111",
  title: "Фотозона",
  description: "",
  qty: 1,
  unit: "шт.",
  price: 500,
  includes: [],
  entity_type: null,
  entity_id: null,
  ...over,
});

describe("storyboard из КП", () => {
  const items = [
    item({ id: "a", title: "Фотозона", section: "Декор", images: ["p1.jpg", "p2.jpg"], image: "p1.jpg" }),
    item({ id: "b", title: "Сцена", section: "Техника", description: "Сцена 6×4 с подиумом и лестницей, монтаж за 3 часа." }),
    item({ id: "c", title: "Доставка реквизита", section: "Техника", price: 100 }),
  ];

  it("собирает полный сценарий с разделами и дополнительными позициями", () => {
    const steps = buildStoryboard(meta, items, totals);
    const types = steps.map((s) => s.type);
    expect(types[0]).toBe("title");
    expect(types.at(-1)).toBe("contacts");
    expect(steps.filter((s) => s.type === "product")).toHaveLength(2);
    expect(steps.some((s) => s.key === "extras")).toBe(true);
    expect(steps.some((s) => s.key === "budget")).toBe(true);
    expect(steps.filter((s) => s.type === "section")).toHaveLength(2);
  });

  it("фото каталога попадают на слайд позиции", () => {
    const step = buildStoryboard(meta, items, totals).find((s) => s.quote_item_id === "a")!;
    expect(step.image_url).toBe("p1.jpg");
    expect((step.content.images as string[]).length).toBe(2);
  });

  it("отключение блоков и цен уважается", () => {
    const steps = buildStoryboard(meta, items, totals, {
      cover: false, about: false, budget: false, contacts: false, terms: false, prices: false,
    });
    expect(steps.every((s) => s.type !== "title" && s.type !== "contacts")).toBe(true);
    const product = steps.find((s) => s.type === "product")!;
    expect(product.content.price).toBeNull();
    expect(product.content.showPrice).toBe(false);
  });

  it("выбор позиций ограничивает сценарий", () => {
    const steps = buildStoryboard(meta, items, totals, { itemIds: ["a"] });
    expect(steps.filter((s) => s.type === "product")).toHaveLength(1);
    expect(steps.some((s) => s.key === "extras")).toBe(false);
  });

  it("строки для БД получают последовательные позиции", () => {
    const rows = stepsToSlideRows(buildStoryboard(meta, items, totals));
    expect(rows.map((r) => r.position)).toEqual(rows.map((_, i) => i));
    expect(rows.every((r) => r.is_visible)).toBe(true);
  });

  it("diff видит новые, удалённые и изменённые позиции", () => {
    const diff = diffSlidesAgainstItems(
      [
        { id: "s1", type: "product", title: "Фотозона", quote_item_id: "a", content: { price: 400, qty: 1 } },
        { id: "s2", type: "product", title: "Старое", quote_item_id: "zz", content: { price: null, qty: null } },
        { id: "s3", type: "title", title: "Обложка", quote_item_id: null, content: { price: null, qty: null } },
      ],
      items,
    );
    expect(diff.added.map((a) => a.id).sort()).toEqual(["b", "c"]);
    expect(diff.removed.map((r) => r.slideId)).toEqual(["s2"]);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0]).toMatchObject({ slideId: "s1", field: "price", to: "500" });
  });
});

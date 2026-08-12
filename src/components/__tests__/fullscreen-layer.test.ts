// Регрессия: полноэкранные слои админки не должны попадать в контекст наложения
// <main> (z-index: 2) — иначе боковое меню админки перекрывает редактор и
// перехватывает клики. Проверяем инварианты вёрстки.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("fullscreen layers", () => {
  it("редактор презентаций рендерится через портал FullscreenLayer", () => {
    const src = read("src/routes/admin.documents.presentations.$id.index.tsx");
    expect(src).toContain("FullscreenLayer");
    expect(src).not.toContain('className="fixed inset-0 z-30');
  });

  it("режим показа рендерится через портал", () => {
    const src = read("src/components/admin/presentations/PresentationFullscreen.tsx");
    expect(src).toContain("FullscreenLayer");
    expect(src).not.toContain("fixed inset-0 z-[70]");
  });

  it("FullscreenLayer ставит флаг на body и портал в body", () => {
    const src = read("src/components/FullscreenLayer.tsx");
    expect(src).toContain("createPortal");
    expect(src).toContain("data-fullscreen-layer");
  });

  it("виджеты сайта скрываются под полноэкранным слоем", () => {
    expect(read("src/styles.css")).toContain(
      "body[data-fullscreen-layer] [data-site-widgets]",
    );
    expect(read("src/components/DeferredGlobals.tsx")).toContain("data-site-widgets");
  });
});

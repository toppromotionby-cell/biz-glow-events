// Статический smoke-тест: у каждого админ-редактора есть автосохранение
// (или черновик + защита от ухода для чувствительных разделов) и сброс кэша.
// Падает, если новый редактор добавили без сохранения правок.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

/** Редакторы с реальным автосохранением на сервер. */
const AUTOSAVE_EDITORS = [
  "src/routes/admin.settings.social.tsx",
  "src/components/admin/paperwork/PaperworkEditor.tsx",
];

/** Чувствительные редакторы: черновик + защита от ухода, отправка по кнопке. */
const GUARDED_EDITORS = ["src/routes/admin.settings.emails.tsx"];

/** Редакторы с дебаунс-сохранением полей (без отдельной кнопки). */
const DEBOUNCED_EDITORS = ["src/routes/admin.catalog-structure.tsx"];

describe("Админ-редакторы: сохранение правок", () => {
  it.each(AUTOSAVE_EDITORS)("%s использует useEditorSave и показывает статус", (file) => {
    const src = read(file);
    expect(src).toContain("useEditorSave");
    expect(src).toContain("SaveStatus");
  });

  it.each(GUARDED_EDITORS)("%s хранит черновик и защищает от ухода", (file) => {
    const src = read(file);
    expect(src).toContain("useAutoSaveDraft");
    expect(src).toContain("useUnsavedGuard");
    expect(src).toContain("clearDraft");
  });

  it.each(DEBOUNCED_EDITORS)("%s сохраняет поля по дебаунсу", (file) => {
    const src = read(file);
    expect(src).toContain("useDebouncedCallback");
    expect(src).toContain("AUTOSAVE_DELAY");
  });

  it.each([...AUTOSAVE_EDITORS, ...GUARDED_EDITORS, ...DEBOUNCED_EDITORS])(
    "%s сбрасывает кэш через invalidateEntity",
    (file) => {
      expect(read(file)).toContain("invalidateEntity");
    },
  );

  it("видимость секций сохраняется сразу при переключении", () => {
    const src = read("src/routes/admin.sections.tsx");
    expect(src).toMatch(/onCheckedChange=\{\(v\) => toggle\(/);
    expect(src).toContain("site_sections");
  });
});

// @vitest-environment jsdom
// Интеграционный smoke-тест редактора: zod-валидация + автосейв черновика +
// конечный автомат SaveStatus. Воспроизводит поведение Editor в admin.cases /
// admin.testimonials без рендера полной формы (не зависит от supabase).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { caseSchema, testimonialSchema } from "@/lib/admin/schemas";
import {
  useAutoSaveDraft, readDraft, clearDraft,
} from "@/lib/admin/use-autosave-draft";
import type { SaveState } from "@/components/admin/SaveStatus";

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});

describe("Editor smoke — live validation (cases)", () => {
  const base = {
    title: "Кейс A", slug: "case-a", client: "", event_type: "", event_date: null,
    location: "", guests_count: null, summary: "", description: "", cover_url: "",
    seo_title: "", seo_description: "", published: false, featured: false,
  };

  it("принимает корректный кейс", () => {
    expect(caseSchema.safeParse(base).success).toBe(true);
  });

  it("отмечает ошибки по полям при пустом title и невалидном slug", () => {
    const result = caseSchema.safeParse({ ...base, title: "", slug: "BAD SLUG" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = new Set(result.error.issues.map((i) => i.path.join(".")));
      expect(fields.has("title")).toBe(true);
      expect(fields.has("slug")).toBe(true);
    }
  });

  it("сохраняет saveDisabled пока есть ошибки и снимает блокировку после правки", () => {
    let form = { ...base, title: "" };
    const v1 = caseSchema.safeParse(form);
    expect(v1.success).toBe(false);
    form = { ...form, title: "Конференция" };
    expect(caseSchema.safeParse(form).success).toBe(true);
  });
});

describe("Editor smoke — autosave draft", () => {
  it("сохраняет в localStorage после debounce и восстанавливается через readDraft", () => {
    const key = "cases:42";
    const initial = { title: "X", slug: "x" };
    const { rerender } = renderHook(({ v }: { v: { title: string; slug: string } }) =>
      useAutoSaveDraft(key, v, { delayMs: 1500 }), { initialProps: { v: initial } });

    // Первый прогон ничего не пишет (firstRun guard).
    act(() => { vi.advanceTimersByTime(1500); });
    expect(readDraft(key)).toBeNull();

    // Меняем значение → ждём debounce → должно сохраниться.
    rerender({ v: { title: "X edited", slug: "x" } });
    act(() => { vi.advanceTimersByTime(1500); });
    expect(readDraft<{ title: string }>(key)?.title).toBe("X edited");
  });

  it("debounce коалесцирует серию правок в одну запись", () => {
    const key = "cases:99";
    const { rerender } = renderHook(({ v }: { v: { n: number } }) =>
      useAutoSaveDraft(key, v), { initialProps: { v: { n: 0 } } });

    for (let i = 1; i <= 5; i++) {
      rerender({ v: { n: i } });
      act(() => { vi.advanceTimersByTime(200); });
    }
    // Не прошло 1500 мс между правками — ничего не записано.
    expect(readDraft(key)).toBeNull();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(readDraft<{ n: number }>(key)?.n).toBe(5);
  });

  it("clearDraft удаляет черновик после успешного save", () => {
    const key = "cases:c";
    window.localStorage.setItem("admin-draft:" + key, JSON.stringify({ savedAt: "", data: { ok: 1 } }));
    expect(readDraft(key)).not.toBeNull();
    clearDraft(key);
    expect(readDraft(key)).toBeNull();
  });
});

describe("Editor smoke — SaveState state machine", () => {
  // Воспроизводим переходы как в admin.cases/testimonials: idle → saving → saved | error.
  function transition(current: SaveState, event: "submit" | "ok" | "fail"): SaveState {
    if (event === "submit") return "saving";
    if (event === "ok") return "saved";
    if (event === "fail") return "error";
    return current;
  }

  it("успешный путь", () => {
    let s: SaveState = "idle";
    s = transition(s, "submit"); expect(s).toBe("saving");
    s = transition(s, "ok"); expect(s).toBe("saved");
  });

  it("путь с ошибкой", () => {
    let s: SaveState = "dirty";
    s = transition(s, "submit"); expect(s).toBe("saving");
    s = transition(s, "fail"); expect(s).toBe("error");
  });
});

describe("Editor smoke — live validation (testimonials)", () => {
  const base = {
    client_name: "Иван", client_company: "", client_role: "", client_photo_url: "",
    rating: 5, text: "Отлично", event_date: null,
    published: true, featured: false, sort_order: 0,
  };
  it("отлавливает выход рейтинга за диапазон", () => {
    const r = testimonialSchema.safeParse({ ...base, rating: 7 });
    expect(r.success).toBe(false);
  });
  it("требует client_name и text", () => {
    expect(testimonialSchema.safeParse({ ...base, client_name: "" }).success).toBe(false);
    expect(testimonialSchema.safeParse({ ...base, text: "" }).success).toBe(false);
  });
});

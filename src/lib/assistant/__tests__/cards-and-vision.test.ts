import { describe, expect, it } from "vitest";
import { cardButtons, renderCard, renderDecided, stripFakeButtons, BUTTON_LABELS } from "@/lib/assistant/cards";
import { actionsPrompt, isAllowedAction, isExecutable } from "@/lib/assistant/actions";
import { acceptsAttachment, visionMessages } from "@/lib/assistant/vision.server";
import { checkPlan, type AssistantPlanRow } from "@/lib/assistant/plans.server";
import { largestPhoto } from "@/lib/assistant/agent.server";
import { mimeByPath } from "@/lib/assistant/transport.server";

const plan = (over: Partial<AssistantPlanRow> = {}): AssistantPlanRow => ({
  id: "p1",
  kind: "assistant",
  status: "pending",
  title: "Разбор",
  summary: "текст",
  request: null,
  steps: [],
  questions: [],
  attachments: [],
  result: null,
  tg_chat_id: 42,
  tg_message_id: null,
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  created_at: new Date().toISOString(),
  ...over,
});

describe("карточки решений", () => {
  it("кнопки всегда привязаны к номеру плана", () => {
    const [row] = cardButtons("abc");
    expect(row?.map((b) => b.data)).toEqual(["ap:ok:abc", "ap:edit:abc", "ap:no:abc"]);
  });

  it("вырезает нарисованные моделью кнопки", () => {
    const text = ["Что делать:", "Проверить доступы.", "✅ Утвердить / ✏️ Правки / 🚫 Отменить"].join("\n");
    const out = stripFakeButtons(text);
    expect(out).toContain("Проверить доступы.");
    expect(out).not.toContain("Утвердить");
  });

  it("не режет содержательный текст со словом «удалить»", () => {
    expect(stripFakeButtons("Нужно удалить дубли позиций в КП №12.")).toContain("дубли");
  });

  it("в тексте карточки нет подписей кнопок", () => {
    const body = renderCard({ id: "p1", title: "План", summary: "✅ Утвердить\nСуть задачи", steps: [] });
    for (const label of BUTTON_LABELS) expect(body.includes(`✅ ${label}`)).toBe(false);
    expect(body).toContain("Суть задачи");
  });

  it("после решения показывает статус", () => {
    expect(renderDecided("тело", "approved", "🟢 шаг — ок")).toContain("Утверждено");
    expect(renderDecided("тело", "rejected")).toContain("Удалено");
  });
});

describe("защита решений", () => {
  it("чужой чат не может решать", () => {
    expect(checkPlan(plan(), 999)).toMatchObject({ ok: false, reason: "foreign" });
  });
  it("повторное решение блокируется", () => {
    expect(checkPlan(plan({ status: "approved" }), 42)).toMatchObject({ ok: false, reason: "decided" });
  });
  it("просроченная карточка блокируется", () => {
    const old = plan({ expires_at: new Date(Date.now() - 1000).toISOString() });
    expect(checkPlan(old, 42)).toMatchObject({ ok: false, reason: "expired" });
  });
  it("свежая карточка проходит", () => {
    expect(checkPlan(plan(), 42).ok).toBe(true);
  });
});

describe("полномочия", () => {
  it("разрешает только описанные действия", () => {
    expect(isAllowedAction("kb_add")).toBe(true);
    expect(isAllowedAction("drop_table")).toBe(false);
    expect(isExecutable("manual")).toBe(false);
  });
  it("подсказка модели перечисляет действия", () => {
    expect(actionsPrompt()).toContain("kb_add");
    expect(actionsPrompt()).toContain("manual");
  });
});

describe("вложения", () => {
  it("берёт самое крупное превью фото", () => {
    expect(largestPhoto([{ file_id: "s", file_size: 10 }, { file_id: "l", file_size: 900 }])?.file_id).toBe("l");
    expect(largestPhoto(undefined)).toBeNull();
  });
  it("принимает картинки и PDF, отвергает прочее", () => {
    expect(acceptsAttachment("image/png", 1000).ok).toBe(true);
    expect(acceptsAttachment("application/pdf", 1000).ok).toBe(true);
    expect(acceptsAttachment("application/zip", 1000).ok).toBe(false);
    expect(acceptsAttachment("image/png", 50 * 1024 * 1024).ok).toBe(false);
  });
  it("определяет тип по пути файла Telegram", () => {
    expect(mimeByPath("photos/file_1.jpg")).toBe("image/jpeg");
    expect(mimeByPath("documents/file_2.pdf")).toBe("application/pdf");
    expect(mimeByPath("voice/file_3.oga")).toBe("audio/ogg");
  });
  it("картинка уходит в модель как image_url", () => {
    const msgs = visionMessages({
      system: "s",
      attachments: [{ fileId: "f", mime: "image/png", base64: "AAA", bytes: 3 }],
      question: "что тут",
    });
    const content = (msgs[1] as { content: { type: string; image_url?: { url: string } }[] }).content;
    expect(content.some((c) => c.type === "image_url" && c.image_url?.url.startsWith("data:image/png;base64,"))).toBe(true);
  });
});

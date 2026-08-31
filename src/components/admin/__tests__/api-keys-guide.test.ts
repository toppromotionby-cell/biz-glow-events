// Инструкция по ключам должна совпадать с реальными переменными окружения провайдеров.
import { describe, expect, it } from "vitest";
import { KEY_GUIDE } from "../ApiKeysGuide";
import { HELP_ARTICLES } from "@/content/help/registry";

const EXPECTED = ["GROQ_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY", "MISTRAL_API_KEY", "GITHUB_MODELS_TOKEN"];

describe("инструкция по API-ключам", () => {
  it("перечисляет все поддерживаемые провайдеры", () => {
    expect(KEY_GUIDE.map((k) => k.env)).toEqual(EXPECTED);
  });

  it("у каждой строки есть рабочая https-ссылка и подсказка", () => {
    for (const k of KEY_GUIDE) {
      expect(k.url.startsWith("https://")).toBe(true);
      expect(k.where.length).toBeGreaterThan(10);
      expect(k.note.length).toBeGreaterThan(10);
    }
  });

  it("в справке есть статья про ключи с именами переменных", () => {
    const article = HELP_ARTICLES.find((a) => a.id === "settings-ai-keys");
    expect(article).toBeTruthy();
    const text = JSON.stringify(article);
    for (const env of EXPECTED) expect(text).toContain(env);
  });
});

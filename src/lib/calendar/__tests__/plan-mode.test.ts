import { describe, expect, it } from "vitest";
import { wantsPlanMode } from "@/lib/calendar/persona";
import { wantsWeb } from "@/lib/calendar/research.server";
import { AI_PORTALS, portalsHtml } from "@/lib/calendar/ai-portals";

describe("режим плана", () => {
  it("включается по команде и ключевым фразам", () => {
    expect(wantsPlanMode("/plan неделя по EventHub")).toBe(true);
    expect(wantsPlanMode("подумай, как разложить подготовку")).toBe(true);
    expect(wantsPlanMode("составь план на пятницу")).toBe(true);
  });

  it("не включается на обычной диктовке", () => {
    expect(wantsPlanMode("завтра в 15 встреча с подрядчиком")).toBe(false);
    expect(wantsPlanMode("что у меня сегодня?")).toBe(false);
  });

  it("поиск в интернете только по явной просьбе", () => {
    expect(wantsWeb("поищи в интернете идеи тимбилдинга")).toBe(true);
    expect(wantsWeb("подумай, как разложить неделю")).toBe(false);
  });

  it("справочник AI-сервисов отдаётся ссылками", () => {
    const html = portalsHtml();
    expect(AI_PORTALS.length).toBeGreaterThan(5);
    expect(html).toContain("https://perplexity.ai");
  });
});

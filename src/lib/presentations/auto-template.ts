// Автоподбор шаблона презентации и варианта оформления по данным КП.
//
// Решение принимается по сигналам КП: тематика позиций, количество фото,
// объём сметы и число позиций. Возвращается шаблон каталога плюс понятные
// объяснения — менеджер видит, почему выбран именно этот сценарий.
import {
  DECK_TEMPLATES, deckTemplateById, type DeckTemplate, type DeckTopic,
} from "@/lib/presentations/deck-templates";

export type QuoteSignals = {
  title: string;
  /** Названия разделов/позиций КП — по ним определяем тематику. */
  labels: string[];
  itemsCount: number;
  photosCount: number;
  total: number;
};

export type AutoPick = {
  templateId: string;
  template: DeckTemplate;
  /** Богатый фото-сценарий: варианты с крупными визуалами. */
  photoRich: boolean;
  score: number;
  reasons: string[];
};

const TOPIC_WORDS: Record<DeckTopic, string[]> = {
  wedding: ["свадьб", "невест", "жених", "выездн", "регистрац", "банкет"],
  concert: ["концерт", "шоу", "артист", "сцена", "фестивал", "диджей", "dj"],
  tech: ["звук", "свет", "экран", "led", "проектор", "ферм", "оборудован", "техник", "райдер"],
  exhibition: ["выставк", "стенд", "застройк", "экспо", "презентац продукт"],
  corporate: ["корпоратив", "конференц", "тимбилдинг", "компан", "сотрудник", "новогодн"],
  minimal: [],
};

function topicScores(labels: string[]): Record<DeckTopic, number> {
  const hay = labels.join(" ").toLowerCase();
  const out = {
    corporate: 0, wedding: 0, concert: 0, tech: 0, exhibition: 0, minimal: 0,
  } as Record<DeckTopic, number>;
  for (const [topic, words] of Object.entries(TOPIC_WORDS) as [DeckTopic, string[]][]) {
    for (const w of words) if (hay.includes(w)) out[topic] += 1;
  }
  return out;
}

/** Подбирает лучший шаблон каталога под данные КП. */
export function autoPickTemplate(q: QuoteSignals): AutoPick {
  const topics = topicScores([q.title, ...q.labels]);
  const photoRich = q.photosCount >= Math.max(4, q.itemsCount);
  const short = q.itemsCount <= 3;

  const scored = DECK_TEMPLATES.map((t) => {
    const reasons: string[] = [];
    let score = 0;

    for (const topic of t.topics) {
      const hits = topics[topic];
      if (hits > 0) {
        score += hits * 3;
        reasons.push(`тематика позиций совпадает с блоком «${topic}»`);
      }
    }
    if (photoRich && t.id === "event-showcase") {
      score += 5;
      reasons.push(`много фотографий (${q.photosCount}) — подойдёт визуальный сценарий`);
    }
    if (short && t.id === "one-pager") {
      score += 4;
      reasons.push(`в КП всего ${q.itemsCount} позиц. — хватит короткого предложения`);
    }
    if (!short && q.itemsCount >= 8 && t.id === "corporate-pitch") {
      score += 4;
      reasons.push(`${q.itemsCount} позиций — нужна полная структура с оглавлением и сметой`);
    }
    if (q.total >= 30000 && (t.id === "corporate-pitch" || t.id === "event-showcase")) {
      score += 2;
      reasons.push("крупный бюджет — презентация с доказательствами и командой");
    }
    if (t.id === "corporate-pitch") score += 1; // безопасный дефолт
    return { t, score, reasons };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  return {
    templateId: best.t.id,
    template: best.t,
    photoRich,
    score: best.score,
    reasons: best.reasons.length ? Array.from(new Set(best.reasons)) : ["универсальная структура по умолчанию"],
  };
}

/** Варианты оформления, усиленные под «фотографичный» сценарий. */
export function tuneVariant(templateId: string, type: string, variant: string, photoRich: boolean): string {
  if (!photoRich) return variant;
  if (type === "title") return "hero";
  if (type === "gallery") return "mosaic";
  if (type === "section") return "bold";
  void deckTemplateById(templateId);
  return variant;
}

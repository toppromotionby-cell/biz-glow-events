// Справочник внешних AI-сервисов, о которых ассистент знает и может рекомендовать.
// Клиент-безопасно: только данные, без сети.

export interface AiPortal {
  name: string;
  url: string;
  /** Для чего лучше всего подходит. */
  best: string;
}

export const AI_PORTALS: AiPortal[] = [
  { name: "ChatGPT", url: "https://chat.openai.com", best: "универсальные тексты, разбор данных, код" },
  { name: "Claude", url: "https://claude.ai", best: "длинные документы, аккуратные тексты и договоры" },
  { name: "Google Gemini", url: "https://gemini.google.com", best: "работа с Google-сервисами, видео и картинками" },
  { name: "Perplexity", url: "https://perplexity.ai", best: "поиск фактов со ссылками на источники" },
  { name: "NotebookLM", url: "https://notebooklm.google.com", best: "конспекты и вопросы по своим файлам" },
  { name: "Midjourney", url: "https://midjourney.com", best: "визуалы и референсы для мероприятий" },
  { name: "Ideogram", url: "https://ideogram.ai", best: "картинки с читаемым текстом, афиши" },
  { name: "Runway", url: "https://runwayml.com", best: "короткие видео и промо-ролики" },
  { name: "ElevenLabs", url: "https://elevenlabs.io", best: "озвучка и голосовые ролики" },
  { name: "Suno", url: "https://suno.com", best: "музыкальные джинглы и подложки" },
  { name: "Gamma", url: "https://gamma.app", best: "быстрые презентации по тексту" },
  { name: "Canva Magic", url: "https://canva.com", best: "макеты, баннеры, соцсети" },
  { name: "Whisper / Deepgram", url: "https://deepgram.com", best: "расшифровка встреч и голосовых" },
  { name: "DeepL", url: "https://deepl.com", best: "качественный перевод документов" },
];

/** Компактный блок для системного промпта. */
export function portalsBlock(): string {
  return AI_PORTALS.map((p) => `- ${p.name} (${p.url}) — ${p.best}`).join("\n");
}

/** Готовый ответ для Telegram на вопрос «какие есть нейросети». */
export function portalsHtml(): string {
  const rows = AI_PORTALS.map((p) => `• <b>${p.name}</b> — ${p.best}\n   <a href="${p.url}">${p.url}</a>`).join("\n");
  return `🤖 <b>Полезные AI-сервисы</b>\n${rows}\n\nСкажите «подумай, как…» — соберу план с учётом этих инструментов и пришлю на утверждение.`;
}

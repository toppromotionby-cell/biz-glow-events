// Транспорт к Google Docs через Lovable connector gateway.
// Только серверный код: читает LOVABLE_API_KEY и GOOGLE_DOCS_API_KEY.

const GATEWAY = "https://connector-gateway.lovable.dev/google_docs/v1";

export class GDocError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function keys() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conn = process.env["GOOGLE_DOCS_API_KEY"];
  if (!lovable || !conn) throw new GDocError("Подключение к Google Документам не настроено", 400);
  return { lovable, conn };
}

export async function gdocs<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const { lovable, conn } = keys();
  const res = await fetch(`${GATEWAY}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": conn,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[gdocs] gateway ${res.status}: ${text}`);
    if (res.status === 404) throw new GDocError("Документ не найден — возможно, он удалён. Создайте заново.", 404);
    if (res.status === 403) throw new GDocError("Нет доступа к документу. Проверьте подключение Google-аккаунта.", 403);
    if (res.status === 429) throw new GDocError("Google временно ограничил запросы. Повторите через минуту.", 429);
    throw new GDocError(`Google Документы вернули ошибку (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export type GDocResponse = {
  documentId: string;
  body?: { content?: GDocElement[] };
};

export type GDocElement = {
  startIndex?: number;
  endIndex?: number;
  paragraph?: unknown;
  table?: {
    tableRows?: Array<{
      tableCells?: Array<{ startIndex?: number; endIndex?: number }>;
    }>;
  };
};

export async function createDoc(title: string): Promise<{ id: string; url: string }> {
  const res = await gdocs<{ documentId: string }>("/documents", { method: "POST", body: { title } });
  return { id: res.documentId, url: `https://docs.google.com/document/d/${res.documentId}/edit` };
}

export async function getDoc(documentId: string) {
  return gdocs<GDocResponse>(`/documents/${documentId}`);
}

export async function batchUpdate(documentId: string, requests: unknown[]) {
  if (!requests.length) return;
  await gdocs(`/documents/${documentId}:batchUpdate`, { method: "POST", body: { requests } });
}

/** Полностью очищает тело документа (последний перевод строки удалить нельзя). */
export async function clearDoc(documentId: string) {
  const doc = await getDoc(documentId);
  const content = doc.body?.content ?? [];
  const end = content.length ? (content[content.length - 1]!.endIndex ?? 2) : 2;
  if (end > 2) {
    await batchUpdate(documentId, [
      { deleteContentRange: { range: { startIndex: 1, endIndex: end - 1 } } },
    ]);
  }
}

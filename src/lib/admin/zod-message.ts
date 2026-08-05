// Превращает технический ответ валидации (ZodError / его JSON) в человеческий текст.
// Нужен, чтобы в UI не появлялся сырой JSON вида
// [ { "code": "custom", "message": "Формат ЧЧ:ММ", "path": ["patch","event_time_end"] } ].

const FIELD_LABELS: Record<string, string> = {
  event_time_start: "Время начала",
  event_time_end: "Время окончания",
  event_date: "Дата мероприятия",
  doc_date: "Дата документа",
  validity_days: "Срок действия",
  client_name: "Контактное лицо",
  client_company: "Компания",
  client_email: "E-mail",
  client_phone: "Телефон",
  client_unp: "УНП",
  client_address: "Адрес",
  guests_count: "Количество гостей",
  venue: "Площадка",
  event_format: "Формат",
  discount_value: "Скидка",
  prepayment_value: "Предоплата",
  delivery_amount: "Доставка",
  title: "Название",
  qty: "Количество",
  price: "Цена",
  cost: "Себестоимость",
  contact_email: "E-mail контакта",
  contact_phone: "Телефон контакта",
  project: "Проект",
  period: "Период",
};

type Issue = { message?: string; path?: (string | number)[] };

function labelFor(path: (string | number)[] | undefined): string | null {
  if (!path?.length) return null;
  for (let i = path.length - 1; i >= 0; i--) {
    const key = String(path[i]);
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  }
  const last = String(path[path.length - 1]);
  return last === "patch" || last === "data" ? null : last;
}

function fromIssues(issues: Issue[]): string {
  const parts = issues.slice(0, 3).map((i) => {
    const label = labelFor(i.path);
    const msg = i.message ?? "некорректное значение";
    return label ? `${label}: ${msg}` : msg;
  });
  const extra = issues.length > 3 ? ` и ещё ${issues.length - 3}` : "";
  return parts.join("; ") + extra;
}

/** Человеческое сообщение из ошибки валидации (или исходный текст, если это не она). */
export function friendlyZodMessage(err: unknown): string {
  const raw =
    typeof err === "string" ? err : err instanceof Error ? err.message : String(err ?? "Неизвестная ошибка");

  const issues = (err as { issues?: Issue[] } | null)?.issues;
  if (Array.isArray(issues) && issues.length) return fromIssues(issues);

  const start = raw.indexOf("[");
  const jsonPart = start >= 0 ? raw.slice(start) : raw;
  try {
    const parsed = JSON.parse(jsonPart) as Issue[] | { issues?: Issue[] };
    const list = Array.isArray(parsed) ? parsed : parsed.issues;
    if (Array.isArray(list) && list.length) return fromIssues(list);
  } catch {
    // не JSON — отдаём как есть
  }
  return raw;
}

// Единые правила: что можно показать в предпросмотре, а что только скачивать,
// и проверка сигнатуры файла, чтобы не отдавать пользователю битые байты.

export const ZIP_MIMES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
] as const;

/** Может ли браузер показать такой файл внутри iframe/просмотрщика. */
export function isPreviewableMime(mime: string): boolean {
  const m = (mime || "").split(";", 1)[0].trim().toLowerCase();
  if (!m) return false;
  if (m === "application/pdf") return true;
  if (m === "text/html" || m.startsWith("text/")) return true;
  if (m.startsWith("image/")) return true;
  return false;
}

/** Ожидаемая сигнатура (magic bytes) для типа файла, если она известна. */
export function expectedSignature(mime: string, filename = ""): string | null {
  const m = (mime || "").split(";", 1)[0].trim().toLowerCase();
  const name = filename.toLowerCase();
  if (m === "application/pdf" || name.endsWith(".pdf")) return "%PDF-";
  if ((ZIP_MIMES as readonly string[]).includes(m) || /\.(docx|xlsx|pptx|zip)$/.test(name)) {
    return "PK\u0003\u0004";
  }
  return null;
}

/** Проверяет первые байты файла на соответствие сигнатуре. */
export function matchesSignature(head: string, signature: string): boolean {
  return head.startsWith(signature);
}

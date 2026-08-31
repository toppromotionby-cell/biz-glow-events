// Безопасный разбор ?redirect=... — принимаем только внутренние пути.
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return undefined;
  if (v.toLowerCase().includes("javascript:")) return undefined;
  return v;
}

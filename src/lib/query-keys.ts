// Единый реестр ключей кэша админки.
// Зачем: раньше строки ключей дублировались по файлам, и опечатка тихо ломала
// обновление списка после сохранения. Теперь ключ у списка и у инвалидации один.
export const adminKeys = {
  cases: ["admin-cases"] as const,
  testimonials: ["admin-testimonials"] as const,
  blog: ["admin-blog"] as const,
  catalog: (table: string) => ["catalog", table] as const,
  catalogAll: ["catalog"] as const,
  promo: ["admin-promo"] as const,
  documents: ["admin-documents-overview"] as const,
  presentations: ["presentations"] as const,
  users: ["admin", "users"] as const,
  siteSettings: ["admin", "site-settings"] as const,
};

// Реквизиты компании для конкретного документа.
// Пустое значение в переопределениях → берём из общих настроек документов.
import type { DocumentSettings } from "@/lib/document-settings.functions";

export const COMPANY_OVERRIDE_FIELDS = [
  ["company_legal_name", "Юр. название"],
  ["company_brand", "Бренд"],
  ["company_unp", "УНП"],
  ["company_address", "Адрес"],
  ["company_phone", "Телефон"],
  ["company_email", "E-mail"],
  ["company_website", "Сайт"],
  ["bank_name", "Банк"],
  ["bank_bic", "БИК"],
  ["bank_account", "Расчётный счёт"],
  ["signer_name", "Подписант"],
  ["signer_title", "Должность подписанта"],
  ["signer_basis", "Основание подписи"],
] as const;

export type CompanyField = (typeof COMPANY_OVERRIDE_FIELDS)[number][0];

export type CompanyOverrides = Partial<Record<CompanyField, string>>;

/** Приводит произвольное значение из БД к набору переопределений. */
export function normalizeCompanyOverrides(value: unknown): CompanyOverrides {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const out: CompanyOverrides = {};
  for (const [key] of COMPANY_OVERRIDE_FIELDS) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) out[key] = v.slice(0, 500);
  }
  return out;
}

/** Итоговые реквизиты документа: переопределения поверх общих настроек. */
export function resolveCompany(
  overrides: CompanyOverrides | null | undefined,
  settings: DocumentSettings,
): Record<CompanyField, string> {
  const o = overrides ?? {};
  const out = {} as Record<CompanyField, string>;
  for (const [key] of COMPANY_OVERRIDE_FIELDS) {
    const own = o[key];
    out[key] = (own && own.trim()) || String(settings[key] ?? "");
  }
  return out;
}

/** Настройки документа с подставленными реквизитами конкретного документа. */
export function applyCompanyOverrides(
  settings: DocumentSettings,
  overrides: CompanyOverrides | null | undefined,
): DocumentSettings {
  return { ...settings, ...resolveCompany(overrides, settings) };
}

// Профиль компании (несколько юрлиц): реквизиты, логотип, подпись, печать, НДС.
// Профиль накладывается на общие настройки документов и служит источником данных
// для КП, промо-КП, счетов, договоров и актов.
import type { DocumentSettings } from "@/lib/document-settings.functions";
import { normalizeLogoLayout, type LogoLayout } from "@/lib/documents/logo-layout";
import { normalizeVatMode, DEFAULT_VAT_RATE, type VatMode } from "@/lib/documents/vat";

export type CompanyProfile = {
  id: string;
  name: string;
  is_default: boolean;
  sort_order: number;
  company_legal_name: string;
  company_brand: string;
  company_unp: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  logo_url: string | null;
  signature_url: string | null;
  stamp_url: string | null;
  logo_layout: LogoLayout;
  accent_color: string;
  bank_name: string;
  bank_bic: string;
  bank_account: string;
  signer_name: string;
  signer_title: string;
  signer_basis: string;
  vat_mode: VatMode;
  vat_rate: number;
  vat_as_line: boolean;
  vat_note: string;
};

export type CompanyProfileInput = Omit<CompanyProfile, "id"> & { id?: string };

const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" && v.trim() ? v : fallback;

/** Приводит строку БД к профилю компании. */
export function normalizeCompanyProfile(row: Record<string, unknown>): CompanyProfile {
  return {
    id: String(row.id ?? ""),
    name: str(row.name, "Без названия"),
    is_default: row.is_default === true,
    sort_order: Number(row.sort_order ?? 0) || 0,
    company_legal_name: str(row.company_legal_name),
    company_brand: str(row.company_brand),
    company_unp: str(row.company_unp),
    company_address: str(row.company_address),
    company_phone: str(row.company_phone),
    company_email: str(row.company_email),
    company_website: str(row.company_website),
    logo_url: typeof row.logo_url === "string" && row.logo_url ? row.logo_url : null,
    signature_url:
      typeof row.signature_url === "string" && row.signature_url ? row.signature_url : null,
    stamp_url: typeof row.stamp_url === "string" && row.stamp_url ? row.stamp_url : null,
    logo_layout: normalizeLogoLayout(row.logo_layout),
    accent_color: str(row.accent_color, "#FF7500"),
    bank_name: str(row.bank_name),
    bank_bic: str(row.bank_bic),
    bank_account: str(row.bank_account),
    signer_name: str(row.signer_name),
    signer_title: str(row.signer_title),
    signer_basis: str(row.signer_basis),
    vat_mode: normalizeVatMode(row.vat_mode),
    vat_rate: Number(row.vat_rate) || DEFAULT_VAT_RATE,
    vat_as_line: row.vat_as_line === true,
    vat_note: str(row.vat_note),
  };
}

/** Пустой профиль для формы создания новой компании. */
export function emptyCompanyProfile(settings?: Partial<DocumentSettings>): CompanyProfileInput {
  return {
    name: "",
    is_default: false,
    sort_order: 0,
    company_legal_name: "",
    company_brand: "",
    company_unp: "",
    company_address: "",
    company_phone: "",
    company_email: "",
    company_website: "",
    logo_url: null,
    signature_url: null,
    stamp_url: null,
    logo_layout: normalizeLogoLayout(settings?.logo_layout),
    accent_color: settings?.accent_color ?? "#FF7500",
    bank_name: "",
    bank_bic: "",
    bank_account: "",
    signer_name: "",
    signer_title: "",
    signer_basis: "",
    vat_mode: settings?.vat_mode ?? "none",
    vat_rate: settings?.vat_rate ?? DEFAULT_VAT_RATE,
    vat_as_line: settings?.vat_as_line ?? false,
    vat_note: settings?.vat_note ?? "",
  };
}

/**
 * Накладывает профиль компании на общие настройки документов.
 * Пустые поля профиля не затирают значения из настроек.
 */
export function applyCompanyProfile(
  settings: DocumentSettings,
  profile: CompanyProfile | null | undefined,
): DocumentSettings {
  if (!profile) return settings;
  const pick = (v: string, fallback: string) => (v && v.trim() ? v : fallback);
  return {
    ...settings,
    company_legal_name: pick(profile.company_legal_name, settings.company_legal_name),
    company_brand: pick(profile.company_brand, settings.company_brand),
    company_unp: pick(profile.company_unp, settings.company_unp),
    company_address: pick(profile.company_address, settings.company_address),
    company_phone: pick(profile.company_phone, settings.company_phone),
    company_email: pick(profile.company_email, settings.company_email),
    company_website: pick(profile.company_website, settings.company_website),
    logo_url: profile.logo_url ?? settings.logo_url,
    logo_layout: profile.logo_layout,
    accent_color: pick(profile.accent_color, settings.accent_color),
    bank_name: pick(profile.bank_name, settings.bank_name),
    bank_bic: pick(profile.bank_bic, settings.bank_bic),
    bank_account: pick(profile.bank_account, settings.bank_account),
    signer_name: pick(profile.signer_name, settings.signer_name),
    signer_title: pick(profile.signer_title, settings.signer_title),
    signer_basis: pick(profile.signer_basis, settings.signer_basis),
    vat_mode: profile.vat_mode,
    vat_rate: profile.vat_rate,
    vat_as_line: profile.vat_as_line,
    vat_note: pick(profile.vat_note, settings.vat_note),
  };
}

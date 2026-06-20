// Настройки документов (одна строка). Чтение/обновление через server fns.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DocumentSettings = {
  company_legal_name: string;
  company_brand: string;
  company_unp: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  logo_url: string | null;
  accent_color: string;
  bank_name: string;
  bank_bic: string;
  bank_account: string;
  signer_name: string;
  signer_title: string;
  signer_basis: string;
  quote_validity_days: number;
  quote_footer: string;
  vat_note: string;
  invoice_validity_days: number;
  invoice_footer: string;
  contract_prepayment_pct: number;
  contract_prepayment_days: number;
  contract_cancel_days: number;
  contract_late_fee_pct: number;
  contract_jurisdiction_city: string;
  contract_sections: { title: string; paragraphs: string[] }[];
};

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  company_legal_name: "Event Hub",
  company_brand: "event-hub.by",
  company_unp: "000000000",
  company_address: "г. Минск, ул. Примерная, 1",
  company_phone: "+375 29 000-00-00",
  company_email: "hello@event-hub.by",
  company_website: "event-hub.by",
  logo_url: null,
  accent_color: "#6d28d9",
  bank_name: "",
  bank_bic: "",
  bank_account: "BY00 OLMP 0000 0000 0000 0000 0000",
  signer_name: "Иванов И. И.",
  signer_title: "директор",
  signer_basis: "Устава",
  quote_validity_days: 14,
  quote_footer:
    "Предложение действительно 14 дней. Цены указаны без НДС, если иное не оговорено отдельно. Для подтверждения заказа свяжитесь с менеджером.",
  vat_note: "НДС не облагается (УСН)",
  invoice_validity_days: 5,
  invoice_footer:
    "Счёт действителен 5 банковских дней. Оплата подтверждает согласие с условиями договора оказания услуг.",
  contract_prepayment_pct: 50,
  contract_prepayment_days: 3,
  contract_cancel_days: 7,
  contract_late_fee_pct: 0.1,
  contract_jurisdiction_city: "Минск",
  contract_sections: [],
};

const SectionSchema = z.object({
  title: z.string().trim().max(200),
  paragraphs: z.array(z.string().trim().max(2000)).max(20),
});

const SettingsSchema = z.object({
  company_legal_name: z.string().trim().min(1).max(200),
  company_brand: z.string().trim().min(1).max(200),
  company_unp: z.string().trim().max(50),
  company_address: z.string().trim().max(300),
  company_phone: z.string().trim().max(50),
  company_email: z.string().trim().email().max(200),
  company_website: z.string().trim().max(200),
  logo_url: z.string().trim().max(500).nullable().optional(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Ожидается hex-цвет, напр. #6d28d9"),
  bank_name: z.string().trim().max(200),
  bank_bic: z.string().trim().max(50),
  bank_account: z.string().trim().max(100),
  signer_name: z.string().trim().min(1).max(200),
  signer_title: z.string().trim().min(1).max(100),
  signer_basis: z.string().trim().min(1).max(100),
  quote_validity_days: z.coerce.number().int().min(1).max(365),
  quote_footer: z.string().trim().max(1000),
  vat_note: z.string().trim().max(200),
  invoice_validity_days: z.coerce.number().int().min(1).max(365),
  invoice_footer: z.string().trim().max(1000),
  contract_prepayment_pct: z.coerce.number().min(0).max(100),
  contract_prepayment_days: z.coerce.number().int().min(0).max(365),
  contract_cancel_days: z.coerce.number().int().min(0).max(365),
  contract_late_fee_pct: z.coerce.number().min(0).max(100),
  contract_jurisdiction_city: z.string().trim().min(1).max(100),
  contract_sections: z.array(SectionSchema).max(20),
});

export const getDocumentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DocumentSettings> => {
    const { data, error } = await context.supabase
      .from("document_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return DEFAULT_DOCUMENT_SETTINGS;
    return normalize(data);
  });

export const updateDocumentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SettingsSchema.parse(d))
  .handler(async ({ data, context }): Promise<DocumentSettings> => {
    // Проверяем admin-роль: RLS-политика тоже сработает, но даём явную ошибку.
    const { data: isAdmin, error: rErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (rErr) throw new Error(rErr.message);
    if (!isAdmin) throw new Error("Доступ запрещён: требуется роль admin");

    const { data: updated, error } = await context.supabase
      .from("document_settings")
      .update({ ...data, updated_by: context.userId })
      .eq("singleton", true)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return normalize(updated);
  });

function normalize(row: Record<string, unknown>): DocumentSettings {
  const sections = row.contract_sections;
  return {
    ...(row as unknown as DocumentSettings),
    contract_sections: Array.isArray(sections)
      ? (sections as { title: string; paragraphs: string[] }[])
      : [],
  };
}

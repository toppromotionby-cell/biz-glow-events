// Server fns для справочника компаний (несколько юрлиц).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertDocumentsStaff, assertPermission, hasPermission } from "@/lib/authz";
import { normalizeCompanyProfile, type CompanyProfile } from "@/lib/documents/company-profile";
import { normalizeLogoLayout } from "@/lib/documents/logo-layout";
import { DEFAULT_VAT_RATE } from "@/lib/documents/vat";

const ProfileSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Укажите название компании").max(160),
  is_default: z.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  company_legal_name: z.string().trim().max(200).default(""),
  company_brand: z.string().trim().max(200).default(""),
  company_unp: z.string().trim().max(50).default(""),
  company_address: z.string().trim().max(300).default(""),
  company_phone: z.string().trim().max(50).default(""),
  company_email: z.string().trim().max(200).default(""),
  company_website: z.string().trim().max(200).default(""),
  logo_url: z.string().trim().max(500).nullable().default(null),
  signature_url: z.string().trim().max(500).nullable().default(null),
  stamp_url: z.string().trim().max(500).nullable().default(null),
  logo_layout: z.unknown().optional().transform(normalizeLogoLayout),
  accent_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Ожидается hex-цвет")
    .default("#FF7500"),
  bank_name: z.string().trim().max(200).default(""),
  bank_bic: z.string().trim().max(50).default(""),
  bank_account: z.string().trim().max(100).default(""),
  signer_name: z.string().trim().max(200).default(""),
  signer_title: z.string().trim().max(100).default(""),
  signer_basis: z.string().trim().max(100).default(""),
  vat_mode: z.enum(["none", "add", "included"]).default("none"),
  vat_rate: z.coerce.number().min(0).max(30).default(DEFAULT_VAT_RATE),
  vat_as_line: z.boolean().default(false),
  vat_note: z.string().trim().max(200).default(""),
});

/** Список компаний — доступен всем, кто работает с документами. */
export const listCompanyProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompanyProfile[]> => {
    const canDocs = await hasPermission(context as never, "documents.manage");
    if (!canDocs) await assertPermission(context as never, "documents.finance");

    const { data, error } = await context.supabase
      .from("company_profiles")
      .select("*")
      .order("sort_order")
      .order("created_at");
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map(normalizeCompanyProfile);
  });

/** Создание или обновление компании. */
export const saveCompanyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProfileSchema.parse(d))
  .handler(async ({ data, context }): Promise<CompanyProfile> => {
    await assertPermission(context as never, "documents.settings");
    const { id, ...payload } = data;

    if (payload.is_default) {
      // Уникальный частичный индекс не даст двум компаниям быть основными.
      let reset = context.supabase
        .from("company_profiles")
        .update({ is_default: false })
        .eq("is_default", true);
      if (id) reset = reset.neq("id", id);
      const { error: rErr } = await reset;
      if (rErr) throw new Error(rErr.message);
    }

    const q = id
      ? context.supabase.from("company_profiles").update(payload).eq("id", id).select("*").single()
      : context.supabase.from("company_profiles").insert(payload).select("*").single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);

    // Основная компания — источник запасных реквизитов для документов,
    // где компания не выбрана. Синхронизируем общие настройки.
    if (payload.is_default) {
      const { error: sErr } = await context.supabase
        .from("document_settings")
        .update({
          company_legal_name: payload.company_legal_name,
          company_brand: payload.company_brand,
          company_unp: payload.company_unp,
          company_address: payload.company_address,
          company_phone: payload.company_phone,
          company_email: payload.company_email,
          company_website: payload.company_website,
          logo_url: payload.logo_url,
          logo_layout: payload.logo_layout as never,
          accent_color: payload.accent_color,
          bank_name: payload.bank_name,
          bank_bic: payload.bank_bic,
          bank_account: payload.bank_account,
          signer_name: payload.signer_name,
          signer_title: payload.signer_title,
          signer_basis: payload.signer_basis,
          updated_by: context.userId,
        })
        .eq("singleton", true);
      if (sErr) console.warn("company->document_settings sync failed", sErr.message);
    }

    return normalizeCompanyProfile(row as Record<string, unknown>);
  });


/** Удаление компании. Документы, где она выбрана, вернутся к общим настройкам. */
export const deleteCompanyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertPermission(context as never, "documents.settings");
    const { error } = await context.supabase.from("company_profiles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Сделать компанию основной (подставляется в новые документы). */
export const setDefaultCompanyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertPermission(context as never, "documents.settings");
    const { error: rErr } = await context.supabase
      .from("company_profiles")
      .update({ is_default: false })
      .eq("is_default", true)
      .neq("id", data.id);
    if (rErr) throw new Error(rErr.message);
    const { error } = await context.supabase
      .from("company_profiles")
      .update({ is_default: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------- Участники общества (для протоколов) --------------------- */

const ParticipantSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  birthDate: z.string().trim().max(20).default(""),
  passport: z.string().trim().max(40).default(""),
  passportIssued: z.string().trim().max(20).default(""),
  passportAuthority: z.string().trim().max(200).default(""),
  passportValid: z.string().trim().max(20).default(""),
  personalNumber: z.string().trim().max(40).default(""),
  address: z.string().trim().max(300).default(""),
  share: z.string().trim().max(20).default(""),
});
export type CompanyParticipant = z.infer<typeof ParticipantSchema>;

/** Участники (учредители) компании — источник блока «ПРИСУТСТВОВАЛИ» в протоколах. */
export const listCompanyParticipants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ companyId: z.string().uuid().nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ companyId: string | null; participants: CompanyParticipant[] }> => {
    await assertDocumentsStaff(context as never);
    let q = context.supabase.from("company_profiles").select("id,participants");
    q = data.companyId
      ? q.eq("id", data.companyId)
      : q.order("is_default", { ascending: false }).order("sort_order");
    const { data: rows, error } = await q.limit(1);
    if (error) throw new Error(error.message);
    const row = (rows ?? [])[0] as { id?: string; participants?: unknown } | undefined;
    const parsed = Array.isArray(row?.participants)
      ? row!.participants.flatMap((p) => {
          const r = ParticipantSchema.safeParse(p);
          return r.success ? [r.data] : [];
        })
      : [];
    return { companyId: row?.id ? String(row.id) : null, participants: parsed };
  });

/** Сохранение состава участников компании. */
export const saveCompanyParticipants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        companyId: z.string().uuid(),
        participants: z.array(ParticipantSchema).max(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertPermission(context as never, "documents.settings");
    const { error } = await context.supabase
      .from("company_profiles")
      .update({ participants: data.participants as never })
      .eq("id", data.companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

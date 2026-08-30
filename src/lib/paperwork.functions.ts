// Серверные функции раздела «Документы и шаблоны» (корпоративные документы).
// Доступ — staff с правом documents.manage.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertDocumentsStaff } from "@/lib/authz";
import {
  DEFAULT_BLANK,
  PW_CATEGORIES,
  PW_DOC_TYPES,
  PW_STATUSES,
  PW_TYPE_CATEGORY,
  normalizeBlank,
  normalizeBlocks,
  normalizeDocument,
  normalizeTemplate,
  normalizeVariables,
  type PwBlank,
  type PwDocument,
  type PwDocumentListRow,
  type PwTemplate,
} from "@/lib/paperwork/model";
import { emptyBlock } from "@/lib/paperwork/model";
import { pwKind } from "@/lib/paperwork/kinds";
import { PW_PRESETS } from "@/lib/paperwork/preset-templates";

type Row = Record<string, unknown>;

const blocksInput = z.unknown().transform(normalizeBlocks);
const varsInput = z.unknown().transform(normalizeVariables);

/* ------------------------------- Документы ------------------------------- */

export const listPaperworkDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().max(160).optional(),
        companyId: z.string().uuid().nullable().optional(),
        docType: z.string().max(20).optional(),
        status: z.string().max(20).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<PwDocumentListRow[]> => {
    await assertDocumentsStaff(context as never);

    let q = context.supabase
      .from("paperwork_documents")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(300);

    const term = (data.search ?? "").trim();
    if (term) q = q.ilike("title", `%${term}%`);
    if (data.companyId) q = q.eq("company_profile_id", data.companyId);
    if (data.docType && data.docType !== "all") q = q.eq("doc_type", data.docType);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as Row[];
    const companyIds = [...new Set(list.map((r) => r.company_profile_id).filter(Boolean))] as string[];
    const authorIds = [...new Set(list.map((r) => r.author_id).filter(Boolean))] as string[];

    const [companies, authors] = await Promise.all([
      companyIds.length
        ? context.supabase.from("company_profiles").select("id,name").in("id", companyIds)
        : Promise.resolve({ data: [] as Row[] }),
      authorIds.length
        ? context.supabase.from("profiles").select("id,full_name").in("id", authorIds)
        : Promise.resolve({ data: [] as Row[] }),
    ]);
    const companyMap = new Map(((companies.data ?? []) as Row[]).map((c) => [String(c.id), String(c.name ?? "")]));
    const authorMap = new Map(((authors.data ?? []) as Row[]).map((c) => [String(c.id), String(c.full_name ?? "")]));

    return list.map((r) => ({
      ...normalizeDocument(r),
      company_name: r.company_profile_id ? (companyMap.get(String(r.company_profile_id)) ?? null) : null,
      author_name: r.author_id ? (authorMap.get(String(r.author_id)) ?? null) : null,
    }));
  });

export type PaperworkDetail = {
  document: PwDocument;
  blank: PwBlank;
  companies: { id: string; name: string }[];
};

export const getPaperworkDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PaperworkDetail> => {
    await assertDocumentsStaff(context as never);

    const { data: row, error } = await context.supabase
      .from("paperwork_documents")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Документ не найден");

    const doc = normalizeDocument(row as Row);
    const [{ data: blankRow }, { data: companyRows }] = await Promise.all([
      doc.company_profile_id
        ? context.supabase
            .from("paperwork_brand_blanks")
            .select("settings")
            .eq("company_profile_id", doc.company_profile_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      context.supabase.from("company_profiles").select("id,name").order("name"),
    ]);

    return {
      document: doc,
      blank: normalizeBlank((blankRow as Row | null)?.settings ?? DEFAULT_BLANK),
      companies: ((companyRows ?? []) as Row[]).map((c) => ({ id: String(c.id), name: String(c.name ?? "") })),
    };
  });

export const savePaperworkDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        template_id: z.string().uuid().nullable().optional(),
        company_profile_id: z.string().uuid().nullable().optional(),
        doc_type: z.enum(PW_DOC_TYPES).default("letter"),
        title: z.string().max(300).default("Без названия"),
        doc_number: z.string().max(80).default(""),
        doc_date: z.string().max(20).default(new Date().toISOString().slice(0, 10)),
        blocks: blocksInput,
        values: z.record(z.string(), z.string().max(4000)).default({}),
        status: z.enum(PW_STATUSES).default("draft"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertDocumentsStaff(context as never);

    const payload = {
      template_id: data.template_id ?? null,
      company_profile_id: data.company_profile_id ?? null,
      doc_type: data.doc_type,
      title: data.title.trim() || "Без названия",
      doc_number: data.doc_number,
      doc_date: data.doc_date,
      blocks: data.blocks,
      values: data.values,
      status: data.status,
    };

    if (data.id) {
      const { error } = await context.supabase.from("paperwork_documents").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: row, error } = await context.supabase
      .from("paperwork_documents")
      .insert({ ...payload, author_id: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: String((row as Row).id) };
  });

export const deletePaperworkDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertDocumentsStaff(context as never);
    const { error } = await context.supabase.from("paperwork_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------- Шаблоны -------------------------------- */

export const listPaperworkTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().max(160).optional(),
        category: z.string().max(30).optional(),
        docType: z.string().max(20).optional(),
        includeArchived: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<PwTemplate[]> => {
    await assertDocumentsStaff(context as never);

    let q = context.supabase
      .from("paperwork_templates")
      .select("*")
      .order("is_favorite", { ascending: false })
      .order("name")
      .limit(300);
    if (!data.includeArchived) q = q.eq("is_archived", false);
    if (data.category && data.category !== "all") q = q.eq("category", data.category);
    if (data.docType && data.docType !== "all") q = q.eq("doc_type", data.docType);
    const term = (data.search ?? "").trim();
    if (term) q = q.ilike("name", `%${term}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Row[]).map(normalizeTemplate);
  });

export const savePaperworkTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable().optional(),
        company_profile_id: z.string().uuid().nullable().optional(),
        category: z.enum(PW_CATEGORIES).default("custom"),
        doc_type: z.enum(PW_DOC_TYPES).default("custom"),
        name: z.string().max(200).default("Новый шаблон"),
        description: z.string().max(600).default(""),
        blocks: blocksInput,
        variables: varsInput.optional(),
        background_url: z.string().max(1000).nullable().optional(),
        is_archived: z.boolean().optional(),
        is_favorite: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertDocumentsStaff(context as never);
    const payload = {
      company_profile_id: data.company_profile_id ?? null,
      category: data.category,
      doc_type: data.doc_type,
      name: data.name.trim() || "Новый шаблон",
      description: data.description,
      blocks: data.blocks,
      variables: data.variables ?? [],
      background_url: data.background_url ?? null,
      is_archived: data.is_archived ?? false,
      is_favorite: data.is_favorite ?? false,
    };
    if (data.id) {
      const { error } = await context.supabase.from("paperwork_templates").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("paperwork_templates")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: String((row as Row).id) };
  });

export const deletePaperworkTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertDocumentsStaff(context as never);
    const { error } = await context.supabase.from("paperwork_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Доустановка встроенных пресетов: добавляет только отсутствующие (сверка по имени). */
export const installPaperworkPresets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ added: number; names: string[] }> => {
    await assertDocumentsStaff(context as never);
    const { data: rows } = await context.supabase.from("paperwork_templates").select("name");
    const existing = new Set(((rows ?? []) as Row[]).map((r) => String(r.name ?? "").trim().toLowerCase()));

    const missing = PW_PRESETS.filter((p) => !existing.has(p.name.trim().toLowerCase()));
    const toAdd = missing.map((p) => ({
      company_profile_id: null,
      category: p.category,
      doc_type: p.doc_type,
      name: p.name,
      description: p.description,
      blocks: normalizeBlocks(p.blocks),
      variables: [],
      is_archived: false,
      is_favorite: false,
    }));
    if (!toAdd.length) return { added: 0, names: [] };

    const { error } = await context.supabase.from("paperwork_templates").insert(toAdd);
    if (error) throw new Error(error.message);
    return { added: toAdd.length, names: missing.map((p) => p.name) };
  });

/** Новый документ из шаблона (или пустой). */
export const createDocumentFromTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        templateId: z.string().uuid().nullable().optional(),
        presetId: z.string().max(60).nullable().optional(),
        kind: z.enum(PW_DOC_TYPES).nullable().optional(),
        companyId: z.string().uuid().nullable().optional(),
        title: z.string().max(300).optional(),
        /** Стартовые значения переменных {{...}} (мастер создания документа). */
        values: z.record(z.string().max(120), z.string().max(2000)).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertDocumentsStaff(context as never);

    let blocks = normalizeBlocks([]);
    let docType: (typeof PW_DOC_TYPES)[number] = "letter";
    let title = data.title?.trim() || "Новый документ";
    let templateId: string | null = null;

    if (data.templateId) {
      const { data: row, error } = await context.supabase
        .from("paperwork_templates")
        .select("*")
        .eq("id", data.templateId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (row) {
        const tpl = normalizeTemplate(row as Row);
        blocks = tpl.blocks;
        docType = tpl.doc_type;
        templateId = tpl.id;
        if (!data.title) title = tpl.name;
      }
    } else if (data.presetId) {
      const preset = PW_PRESETS.find((p) => p.id === data.presetId);
      if (preset) {
        blocks = normalizeBlocks(preset.blocks);
        docType = preset.doc_type;
        if (!data.title) title = preset.name;
      }
    } else if (data.kind) {
      const kind = pwKind(data.kind);
      docType = kind.type;
      blocks = normalizeBlocks(kind.starterBlocks.map((t) => emptyBlock(t)));
      if (!data.title) title = kind.label;
    }

    // Без компании документ остаётся без шапки и бланка — берём основную.
    let companyId = data.companyId ?? null;
    if (!companyId) {
      const { data: companies } = await context.supabase
        .from("company_profiles")
        .select("id,is_default")
        .order("is_default", { ascending: false })
        .order("sort_order")
        .limit(1);
      companyId = (companies?.[0] as Row | undefined)?.id ? String((companies![0] as Row).id) : null;
    }

    const { data: row, error } = await context.supabase
      .from("paperwork_documents")
      .insert({
        template_id: templateId,
        company_profile_id: companyId,
        doc_type: docType,
        title,
        doc_date: new Date().toISOString().slice(0, 10),
        blocks,
        values: {},
        status: "draft",
        author_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: String((row as Row).id) };
  });

/* ---------------------------- Фирменные бланки ---------------------------- */

export const getPaperworkBlank = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ companyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PwBlank> => {
    await assertDocumentsStaff(context as never);
    const { data: row } = await context.supabase
      .from("paperwork_brand_blanks")
      .select("settings")
      .eq("company_profile_id", data.companyId)
      .maybeSingle();
    return normalizeBlank((row as Row | null)?.settings ?? DEFAULT_BLANK);
  });

export const savePaperworkBlank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ companyId: z.string().uuid(), settings: z.unknown().transform(normalizeBlank) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertDocumentsStaff(context as never);
    const { error } = await context.supabase
      .from("paperwork_brand_blanks")
      .upsert(
        { company_profile_id: data.companyId, settings: data.settings },
        { onConflict: "company_profile_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------------- Импорт --------------------------------- */

export const importPaperworkDocx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ fileBase64: z.string().min(4).max(12_000_000), fileName: z.string().max(300).default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertDocumentsStaff(context as never);
    const { parseDocxToBlocks } = await import("@/lib/paperwork/import.server");
    const binary = Uint8Array.from(atob(data.fileBase64.replace(/^data:[^,]+,/, "")), (c) => c.charCodeAt(0));
    const report = parseDocxToBlocks(binary);
    return report;
  });

/* ------------------------------ AI-помощник ------------------------------ */

export const draftPaperworkWithAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        prompt: z.string().min(3).max(2000),
        docType: z.enum(PW_DOC_TYPES).default("letter"),
        companyName: z.string().max(200).default(""),
        mode: z.enum(["create", "rewrite"]).default("create"),
        currentText: z.string().max(8000).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertDocumentsStaff(context as never);
    const { draftDocument } = await import("@/lib/paperwork/ai.server");
    return draftDocument(data);
  });

export const PW_DEFAULT_CATEGORY = PW_TYPE_CATEGORY;

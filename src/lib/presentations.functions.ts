// Серверные функции раздела «Документы → Презентации».
// Доступ — staff с правом documents.manage. Каталог читается admin-клиентом.
import { createServerFn } from "@tanstack/react-start";
import { normalizeDocFontChoice } from "@/lib/documents/doc-font";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertDocumentsStaff } from "@/lib/authz";
import {
  normalizePresentation,
  PRESENTATION_TEMPLATES,
  PRESENTATION_STATUSES,
  SLIDE_TYPES,
  normalizePresentationLogoLayout,
  normalizeSlide,
  normalizeContent,
  EMPTY_CONTENT,
  type Presentation,
  type PresentationListRow,
  type PresentationSlide,
  type SlideType,
} from "@/lib/presentations/model";
import type { QuoteItemLite } from "@/lib/presentations/check";
import { toCardExcerpt } from "@/lib/rich-text";


const CATALOG_TABLES = ["zones", "tech_equipment", "services", "production_items", "attractions"] as const;

type Row = Record<string, unknown>;

const slideInput = z.object({
  id: z.string().optional(),
  position: z.number().int().min(0),
  type: z.enum(SLIDE_TYPES),
  title: z.string().max(300).default(""),
  subtitle: z.string().max(400).default(""),
  image_url: z.string().max(1000).nullable().default(null),
  content: z.unknown().default({}),
  entity_type: z.string().max(40).nullable().default(null),
  entity_id: z.string().uuid().nullable().default(null),
  quote_item_id: z.string().uuid().nullable().default(null),
  is_visible: z.boolean().default(true),
});

/* ---------------- Список ---------------- */

export const listPresentations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().max(160).optional(),
        companyId: z.string().uuid().nullable().optional(),
        quoteId: z.string().uuid().nullable().optional(),
        status: z.string().max(20).optional(),
        sort: z.enum(["updated", "created", "title"]).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<PresentationListRow[]> => {
    await assertDocumentsStaff(context as never);

    const sort = data.sort ?? "updated";
    const orderCol = sort === "title" ? "title" : sort === "created" ? "created_at" : "updated_at";

    let q = context.supabase
      .from("presentations")
      .select("*, presentation_slides(id)")
      .order(orderCol, { ascending: sort === "title" })
      .limit(200);


    const term = (data.search ?? "").trim();
    if (term) q = q.ilike("title", `%${term}%`);
    if (data.companyId) q = q.eq("company_id", data.companyId);
    if (data.quoteId) q = q.eq("quote_id", data.quoteId);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as Row[];
    const companyIds = [...new Set(list.map((r) => r.company_id).filter(Boolean))] as string[];
    const quoteIds = [...new Set(list.map((r) => r.quote_id).filter(Boolean))] as string[];

    const [companies, quotes] = await Promise.all([
      companyIds.length
        ? context.supabase.from("company_profiles").select("id,name").in("id", companyIds)
        : Promise.resolve({ data: [] as Row[] }),
      quoteIds.length
        ? context.supabase.from("quotes").select("id,quote_number,title").in("id", quoteIds)
        : Promise.resolve({ data: [] as Row[] }),
    ]);

    const companyMap = new Map(
      ((companies.data ?? []) as Row[]).map((c) => [String(c.id), String(c.name ?? "")]),
    );
    const quoteMap = new Map(
      ((quotes.data ?? []) as Row[]).map((c) => [String(c.id), String(c.quote_number ?? c.title ?? "")]),
    );

    return list.map((r) => ({
      ...normalizePresentation(r),
      company_name: r.company_id ? (companyMap.get(String(r.company_id)) ?? null) : null,
      quote_number: r.quote_id ? (quoteMap.get(String(r.quote_id)) ?? null) : null,
      slides_count: Array.isArray(r.presentation_slides) ? r.presentation_slides.length : 0,
    }));
  });

/* ---------------- Одна презентация ---------------- */

export type PresentationDetail = {
  presentation: Presentation;
  slides: PresentationSlide[];
  quote: { id: string; number: string; title: string; client: string } | null;
  quoteItems: QuoteItemLite[];
};

async function loadQuoteItems(
  supabase: { from: (t: string) => never },
  quoteId: string,
): Promise<QuoteItemLite[]> {
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => { order: (c: string) => Promise<{ data: Row[] | null }> };
      };
    };
  };
  const { data } = await client.from("quote_items").select("*").eq("quote_id", quoteId).order("sort_order");
  return ((data ?? []) as Row[]).map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    qty: Number(r.qty ?? 1) || 1,
    unit: String(r.unit ?? "шт."),
    price: Number(r.price ?? 0) || 0,
    includes: Array.isArray(r.includes) ? (r.includes as unknown[]).map((i) => String(i)) : [],
    entity_type: r.entity_type ? String(r.entity_type) : null,
    entity_id: r.entity_id ? String(r.entity_id) : null,
  }));
}

export const getPresentation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PresentationDetail> => {
    await assertDocumentsStaff(context as never);

    const { data: row, error } = await context.supabase
      .from("presentations")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Презентация не найдена");

    const presentation = normalizePresentation(row as Row);

    const { data: slideRows } = await context.supabase
      .from("presentation_slides")
      .select("*")
      .eq("presentation_id", data.id)
      .order("position");

    const slides = ((slideRows ?? []) as Row[]).map((r, i) => normalizeSlide(r, i));

    let quote: PresentationDetail["quote"] = null;
    let quoteItems: QuoteItemLite[] = [];
    if (presentation.quote_id) {
      const { data: qrow } = await context.supabase
        .from("quotes")
        .select("id,quote_number,title,client_name")
        .eq("id", presentation.quote_id)
        .maybeSingle();
      if (qrow) {
        const q = qrow as Row;
        quote = {
          id: String(q.id),
          number: String(q.quote_number ?? "").replaceAll("/", "."),
          title: String(q.title ?? ""),
          client: String(q.client_name ?? ""),
        };
        quoteItems = await loadQuoteItems(context.supabase as never, presentation.quote_id);
      }
    }

    return { presentation, slides, quote, quoteItems };
  });

/* ---------------- Сборка слайдов из КП ---------------- */

type CatalogCard = {
  title: string;
  description: string;
  image: string | null;
  features: string[];
  unit: string;
  price: number | null;
};

async function loadCatalogCards(
  items: QuoteItemLite[],
): Promise<Map<string, CatalogCard>> {
  const map = new Map<string, CatalogCard>();
  const byTable = new Map<string, string[]>();
  for (const it of items) {
    if (!it.entity_type || !it.entity_id) continue;
    if (!(CATALOG_TABLES as readonly string[]).includes(it.entity_type)) continue;
    const arr = byTable.get(it.entity_type) ?? [];
    arr.push(it.entity_id);
    byTable.set(it.entity_type, arr);
  }
  if (!byTable.size) return map;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await Promise.all(
    [...byTable.entries()].map(async ([table, ids]) => {
      const { data } = await supabaseAdmin
        .from(table as "zones")
        .select("id,title,description,photo_urls,features,pricing")
        .in("id", ids);
      for (const r of ((data ?? []) as unknown as Row[])) {
        const pricing = (r.pricing ?? {}) as { from?: number; unit?: string };
        const photos = Array.isArray(r.photo_urls) ? (r.photo_urls as unknown[]).map(String) : [];
        const features = Array.isArray(r.features)
          ? (r.features as unknown[])
              .map((f) =>
                typeof f === "string" ? f : String((f as Record<string, unknown>)?.title ?? ""),
              )
              .filter(Boolean)
          : [];
        map.set(`${table}:${String(r.id)}`, {
          title: String(r.title ?? ""),
          description: toCardExcerpt(r.description as string | null, 220),
          image: photos[0] ?? null,
          features: features.slice(0, 6),
          unit: String(pricing.unit ?? "шт."),
          price: Number(pricing.from ?? 0) || null,
        });
      }
    }),
  );
  return map;
}

type SlideDraft = {
  position: number;
  type: SlideType;
  title: string;
  subtitle: string;
  image_url: string | null;
  content_json: Record<string, unknown>;
  entity_type: string | null;
  entity_id: string | null;
  quote_item_id: string | null;
  is_visible: boolean;
};

function productSlideFromItem(
  item: QuoteItemLite,
  card: CatalogCard | undefined,
  position: number,
): SlideDraft {
  return {
    position,
    type: "product",
    title: item.title || card?.title || "Позиция",
    subtitle: "",
    image_url: card?.image ?? null,
    content_json: {
      ...EMPTY_CONTENT,
      description: item.description || card?.description || "",
      includes: item.includes.length ? item.includes : (card?.features ?? []),
      specs: [],
      price: item.price || card?.price || null,
      priceUnit: item.unit || card?.unit || "шт.",
      qty: item.qty,
    },
    entity_type: item.entity_type,
    entity_id: item.entity_id,
    quote_item_id: item.id,
    is_visible: true,
  };
}

/** Черновики слайдов по позициям КП — используется при создании и при досборке. */
export const buildSlidesFromQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { quoteId: string; itemIds?: string[] }) =>
    z.object({ quoteId: z.string().uuid(), itemIds: z.array(z.string().uuid()).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PresentationSlide[]> => {
    await assertDocumentsStaff(context as never);
    let items = await loadQuoteItems(context.supabase as never, data.quoteId);
    if (data.itemIds?.length) {
      const wanted = new Set(data.itemIds);
      items = items.filter((i) => wanted.has(i.id));
    }
    const cards = await loadCatalogCards(items);
    return items.map((item, i) => {
      const draft = productSlideFromItem(item, cards.get(`${item.entity_type}:${item.entity_id}`), i);
      return normalizeSlide({ ...draft, id: `new-quote-${item.id}` }, i);
    });
  });

/* ---------------- Создание ---------------- */

export const createPresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(1, "Укажите название").max(200),
        companyId: z.string().uuid().nullable().default(null),
        template: z.enum(PRESENTATION_TEMPLATES).default("light"),
        quoteId: z.string().uuid().nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertDocumentsStaff(context as never);

    const { data: created, error } = await context.supabase
      .from("presentations")
      .insert({
        title: data.title,
        company_id: data.companyId,
        quote_id: data.quoteId,
        template: data.template,
        status: "draft",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = String((created as Row).id);

    const slides: SlideDraft[] = [
      {
        position: 0,
        type: "title",
        title: data.title,
        subtitle: "",
        image_url: null,
        content_json: { ...EMPTY_CONTENT },
        entity_type: null,
        entity_id: null,
        quote_item_id: null,
        is_visible: true,
      },
    ];

    if (data.quoteId) {
      const items = await loadQuoteItems(context.supabase as never, data.quoteId);
      const cards = await loadCatalogCards(items);
      items.forEach((item, i) => {
        slides.push(
          productSlideFromItem(item, cards.get(`${item.entity_type}:${item.entity_id}`), i + 1),
        );
      });
    }

    slides.push({
      position: slides.length,
      type: "contacts",
      title: "Свяжитесь с нами",
      subtitle: "Ответим на вопросы и подготовим смету",
      image_url: null,
      content_json: { ...EMPTY_CONTENT },
      entity_type: null,
      entity_id: null,
      quote_item_id: null,
      is_visible: true,
    });

    const { error: slidesError } = await context.supabase
      .from("presentation_slides")
      .insert(slides.map((s) => ({ ...s, presentation_id: id })) as never);
    if (slidesError) throw new Error(slidesError.message);

    return { id };
  });

/* ---------------- Сохранение ---------------- */

export const savePresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        status: z.enum(PRESENTATION_STATUSES),
        template: z.enum(PRESENTATION_TEMPLATES),
        companyId: z.string().uuid().nullable().default(null),
        logoUrl: z.string().max(1000).nullable().default(null),
        clientLogoUrl: z.string().max(1000).nullable().default(null),
        logoLayout: z.unknown().optional().transform(normalizePresentationLogoLayout),
        fontFamily: z.unknown().optional().transform(normalizeDocFontChoice),
        slides: z.array(slideInput).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertDocumentsStaff(context as never);

    const { error: upErr } = await context.supabase
      .from("presentations")
      .update({
        title: data.title,
        status: data.status,
        template: data.template,
        company_id: data.companyId,
        logo_url: data.logoUrl,
        client_logo_url: data.clientLogoUrl,
        logo_layout: data.logoLayout,
        font_family: data.fontFamily,
      })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    // Слайды сохраняем точечно: существующие обновляем по id (id не меняются,
    // ссылки и история остаются валидными), новые вставляем, лишние удаляем.
    const isUuid = (v: unknown): v is string =>
      typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    const toRow = (s: (typeof data.slides)[number], i: number) => ({
      presentation_id: data.id,
      position: i,
      type: s.type,
      title: s.title,
      subtitle: s.subtitle,
      image_url: s.image_url,
      content_json: normalizeContent(s.content) as unknown as Record<string, unknown>,
      entity_type: s.entity_type,
      entity_id: s.entity_id,
      quote_item_id: s.quote_item_id,
      is_visible: s.is_visible,
    });

    const keepIds = data.slides.map((s) => s.id).filter(isUuid);
    let delQuery = context.supabase.from("presentation_slides").delete().eq("presentation_id", data.id);
    if (keepIds.length) delQuery = delQuery.not("id", "in", `(${keepIds.join(",")})`);
    const { error: delErr } = await delQuery;
    if (delErr) throw new Error(delErr.message);

    const existing = data.slides.flatMap((s, i) => (isUuid(s.id) ? [{ id: s.id, ...toRow(s, i) }] : []));
    if (existing.length) {
      const { error } = await context.supabase
        .from("presentation_slides")
        .upsert(existing as never, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }

    const fresh = data.slides.flatMap((s, i) => (isUuid(s.id) ? [] : [toRow(s, i)]));
    if (fresh.length) {
      const { error } = await context.supabase.from("presentation_slides").insert(fresh as never);
      if (error) throw new Error(error.message);
    }

    // База знаний: тексты слайдов становятся подсказками в документах.
    try {
      const { harvestFromPresentation } = await import("@/lib/doc-knowledge.server");
      await harvestFromPresentation(data.slides.map((sl) => ({ title: sl.title, subtitle: sl.subtitle })));
    } catch (e) {
      console.error("[savePresentation] knowledge harvest failed:", e);
    }

    return { ok: true };

  });

/* ---------------- Дублирование и удаление ---------------- */

export const duplicatePresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertDocumentsStaff(context as never);

    const { data: row } = await context.supabase
      .from("presentations")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Презентация не найдена");
    const src = normalizePresentation(row as Row);

    const { data: created, error } = await context.supabase
      .from("presentations")
      .insert({
        title: `${src.title} (копия)`,
        company_id: src.company_id,
        quote_id: src.quote_id,
        template: src.template,
        status: "draft",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = String((created as Row).id);

    const { data: slideRows } = await context.supabase
      .from("presentation_slides")
      .select("*")
      .eq("presentation_id", data.id)
      .order("position");

    const rows = ((slideRows ?? []) as Row[]).map((r, i) => ({
      presentation_id: id,
      position: i,
      type: r.type,
      title: r.title,
      subtitle: r.subtitle,
      image_url: r.image_url,
      content_json: r.content_json,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      quote_item_id: r.quote_item_id,
      is_visible: r.is_visible,
    }));
    if (rows.length) await context.supabase.from("presentation_slides").insert(rows as never);

    return { id };
  });

export const deletePresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertDocumentsStaff(context as never);
    const { error } = await context.supabase.from("presentations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Переименование из списка — без пересохранения слайдов. */
export const renamePresentation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; title: string }) =>
    z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(200) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertDocumentsStaff(context as never);
    const { error } = await context.supabase
      .from("presentations")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



/* ---------------- Справочник КП для селектов ---------------- */

export type QuoteOption = {
  id: string;
  number: string;
  title: string;
  client: string;
  company_id: string | null;
};

export const listQuotesForPresentation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ companyId: z.string().uuid().nullable().optional(), q: z.string().max(120).optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<QuoteOption[]> => {
    await assertDocumentsStaff(context as never);
    let query = context.supabase
      .from("quotes")
      .select("id,quote_number,title,client_name,company_id")
      .eq("is_template", false)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.companyId) query = query.eq("company_id", data.companyId);
    const term = (data.q ?? "").trim();
    if (term) query = query.or(`title.ilike.%${term}%,client_name.ilike.%${term}%,quote_number.ilike.%${term}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      number: String(r.quote_number ?? "").replaceAll("/", "."),
      title: String(r.title ?? ""),
      client: String(r.client_name ?? ""),
      company_id: r.company_id ? String(r.company_id) : null,
    }));
  });

/* ---------------- Публичная ссылка ---------------- */

export const setPresentationShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ token: string; enabled: boolean }> => {
    await assertDocumentsStaff(context as never);
    const { data: row, error } = await context.supabase
      .from("presentations")
      .update({ share_enabled: data.enabled })
      .eq("id", data.id)
      .select("public_token, share_enabled")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Презентация не найдена");
    const r = row as Row;
    return { token: String(r.public_token ?? ""), enabled: r.share_enabled === true };
  });

/* ---------------- Версии (снимки) ---------------- */

export type PresentationVersion = {
  id: string;
  label: string;
  created_at: string;
};

export const listPresentationVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<PresentationVersion[]> => {
    await assertDocumentsStaff(context as never);
    const { data: rows, error } = await context.supabase
      .from("presentation_versions")
      .select("id,label,created_at")
      .eq("presentation_id", data.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Row[]).map((r) => ({
      id: String(r.id),
      label: String(r.label ?? ""),
      created_at: String(r.created_at ?? ""),
    }));
  });

/** Снимок текущего состояния презентации (шапка + слайды). */
export const createPresentationVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), label: z.string().trim().max(120).default("") }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertDocumentsStaff(context as never);
    const [{ data: head, error: headErr }, { data: slides, error: slidesErr }] = await Promise.all([
      context.supabase.from("presentations").select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from("presentation_slides").select("*").eq("presentation_id", data.id).order("position"),
    ]);
    if (headErr) throw new Error(headErr.message);
    if (slidesErr) throw new Error(slidesErr.message);
    if (!head) throw new Error("Презентация не найдена");

    const { data: row, error } = await context.supabase
      .from("presentation_versions")
      .insert({
        presentation_id: data.id,
        label: data.label || new Date().toLocaleString("ru-RU"),
        snapshot: { presentation: head, slides: slides ?? [] } as never,
        created_by: context.userId,
      } as never)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { id: String((row as Row | null)?.id ?? "") };
  });

/** Откат к версии: шапка и слайды заменяются содержимым снимка. */
export const restorePresentationVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), versionId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertDocumentsStaff(context as never);
    const { data: row, error } = await context.supabase
      .from("presentation_versions")
      .select("snapshot")
      .eq("id", data.versionId)
      .eq("presentation_id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Версия не найдена");

    const snap = ((row as Row).snapshot ?? {}) as { presentation?: Row; slides?: Row[] };
    const head = snap.presentation ?? {};
    const { error: upErr } = await context.supabase
      .from("presentations")
      .update({
        title: head.title ?? "Без названия",
        status: head.status ?? "draft",
        template: head.template ?? "light",
        company_id: head.company_id ?? null,
        logo_url: head.logo_url ?? null,
        client_logo_url: head.client_logo_url ?? null,
        logo_layout: head.logo_layout ?? {},
        font_family: head.font_family ?? "inherit",
      } as never)
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    const { error: delErr } = await context.supabase
      .from("presentation_slides").delete().eq("presentation_id", data.id);
    if (delErr) throw new Error(delErr.message);

    const slides = (snap.slides ?? []).map((s, i) => ({
      presentation_id: data.id,
      position: Number(s.position ?? i) || i,
      type: s.type ?? "text",
      title: s.title ?? "",
      subtitle: s.subtitle ?? "",
      image_url: s.image_url ?? null,
      content_json: s.content_json ?? {},
      entity_type: s.entity_type ?? null,
      entity_id: s.entity_id ?? null,
      quote_item_id: s.quote_item_id ?? null,
      is_visible: s.is_visible !== false,
    }));
    if (slides.length) {
      const { error: insErr } = await context.supabase
        .from("presentation_slides").insert(slides as never);
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

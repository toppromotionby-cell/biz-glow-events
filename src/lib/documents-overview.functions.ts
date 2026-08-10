// Сводный список всех документов раздела «Документы»: обычные КП + КП промо.
// Используется экраном /admin/documents (единая точка входа со счётчиками).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
  ]);
  if (!isAdmin && !isManager) throw new Error("Forbidden");
}

export type DocKind = "quote" | "promo";

export type DocumentRow = {
  kind: DocKind;
  id: string;
  number: string;
  title: string;
  client: string;
  status: string;
  total: number;
  event_date: string | null;
  updated_at: string;
  created_at: string;
  sent_at: string | null;
  viewed_at: string | null;
  client_response: string;
  valid_until: string | null;
};

export type DocumentsOverview = {
  rows: DocumentRow[];
  counts: {
    total: number;
    draft: number;
    sent: number;
    accepted: number;
    rejected: number;
    awaiting: number; // отправлено, но клиент ещё не отвечал
    expired: number; // срок действия истёк, решения нет
  };
  sum: number;
};

const num = (v: unknown) => Number(v ?? 0) || 0;
const str = (v: unknown) => (typeof v === "string" ? v : "");

function isExpired(validUntil: string | null, status: string): boolean {
  if (!validUntil) return false;
  if (status === "accepted" || status === "rejected") return false;
  return new Date(validUntil).getTime() < Date.now();
}

export const listAllDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; status?: string; kind?: string } | undefined) =>
    z
      .object({
        search: z.string().max(200).optional(),
        status: z.string().max(30).optional(),
        kind: z.enum(["all", "quote", "promo"]).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<DocumentsOverview> => {
    await assertStaff(context as never);

    const kind = data.kind ?? "all";
    const search = (data.search ?? "").trim().toLowerCase();

    const wantQuotes = kind === "all" || kind === "quote";
    const wantPromo = kind === "all" || kind === "promo";

    const [quotesRes, promoRes] = await Promise.all([
      wantQuotes
        ? context.supabase
            .from("quotes")
            .select(
              "id,quote_number,status,title,client_name,client_company,event_date,total,updated_at,created_at,sent_at,viewed_at,client_response,valid_until_override,doc_date,validity_days",
            )
            .eq("is_template", false)
            .order("created_at", { ascending: false })
            .limit(300)
        : Promise.resolve({ data: [] as unknown[] }),
      wantPromo
        ? context.supabase
            .from("promo_quotes")
            .select(
              "id,doc_number,status,project,client_name,period,total,updated_at,created_at,sent_at,viewed_at,client_response,valid_until",
            )
            .eq("is_template", false)
            .order("created_at", { ascending: false })
            .limit(300)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

    const rows: DocumentRow[] = [];

    for (const raw of ((quotesRes.data ?? []) as Record<string, unknown>[])) {
      const validity = Number(raw.validity_days ?? 0);
      const base = str(raw.doc_date);
      const computed =
        str(raw.valid_until_override) ||
        (base && validity
          ? new Date(new Date(base).getTime() + validity * 86400000).toISOString().slice(0, 10)
          : "");
      rows.push({
        kind: "quote",
        id: String(raw.id),
        number: str(raw.quote_number) || String(raw.id).slice(0, 8),
        title: str(raw.title) || "Коммерческое предложение",
        client: str(raw.client_company) || str(raw.client_name) || "Без клиента",
        status: str(raw.status) || "draft",
        total: num(raw.total),
        event_date: str(raw.event_date) || null,
        updated_at: str(raw.updated_at),
        created_at: str(raw.created_at),
        sent_at: str(raw.sent_at) || null,
        viewed_at: str(raw.viewed_at) || null,
        client_response: str(raw.client_response),
        valid_until: computed || null,
      });
    }

    for (const raw of ((promoRes.data ?? []) as Record<string, unknown>[])) {
      rows.push({
        kind: "promo",
        id: String(raw.id),
        number: str(raw.doc_number) || String(raw.id).slice(0, 8),
        title: str(raw.project) || "КП промо",
        client: str(raw.client_name) || "Без клиента",
        status: str(raw.status) || "draft",
        total: num(raw.total),
        event_date: null,
        updated_at: str(raw.updated_at),
        created_at: str(raw.created_at),
        sent_at: str(raw.sent_at) || null,
        viewed_at: str(raw.viewed_at) || null,
        client_response: str(raw.client_response),
        valid_until: str(raw.valid_until) || null,
      });
    }

    const counts = {
      total: rows.length,
      draft: rows.filter((r) => r.status === "draft").length,
      sent: rows.filter((r) => r.status === "sent").length,
      accepted: rows.filter((r) => r.status === "accepted").length,
      rejected: rows.filter((r) => r.status === "rejected").length,
      awaiting: rows.filter((r) => r.status === "sent" && !r.client_response).length,
      expired: rows.filter((r) => isExpired(r.valid_until, r.status)).length,
    };

    let visible = rows;
    if (data.status && data.status !== "all") {
      visible = visible.filter((r) =>
        data.status === "expired" ? isExpired(r.valid_until, r.status) : r.status === data.status,
      );
    }
    if (search) {
      visible = visible.filter((r) =>
        `${r.number} ${r.title} ${r.client}`.toLowerCase().includes(search),
      );
    }

    visible = [...visible].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    return {
      rows: visible,
      counts,
      sum: visible.reduce((s, r) => s + r.total, 0),
    };
  });

// ---- Единые действия над документом любого типа (КП / КП промо) ----

const kindSchema = z.enum(["quote", "promo"]);
const idSchema = z.object({ kind: kindSchema, id: z.string().uuid() });

type Tbl = { doc: "quotes" | "promo_quotes"; items: "quote_items" | "promo_quote_items"; fk: "quote_id" };
const TABLES: Record<DocKind, Tbl> = {
  quote: { doc: "quotes", items: "quote_items", fk: "quote_id" },
  promo: { doc: "promo_quotes", items: "promo_quote_items", fk: "quote_id" },
};

export const duplicateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: DocKind; id: string }) => idSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string; kind: DocKind }> => {
    await assertStaff(context as never);
    const t = TABLES[data.kind];
    const [{ data: src }, { data: items }] = await Promise.all([
      context.supabase.from(t.doc).select("*").eq("id", data.id).maybeSingle(),
      context.supabase.from(t.items).select("*").eq(t.fk, data.id).order("sort_order"),
    ]);
    if (!src) throw new Error("Документ не найден");

    const row = { ...(src as Record<string, unknown>) };
    for (const k of ["id", "created_at", "updated_at", "public_token", "sent_at", "viewed_at", "responded_at"]) delete row[k];
    row.status = "draft";
    row.created_by = context.userId;
    row.is_template = false;
    row.template_name = "";
    row.client_response = "";
    row.client_comment = "";
    if (data.kind === "quote") {
      row.quote_number = null;
      row.title = `${str(row.title) || "КП"} (копия)`;
    } else {
      row.doc_number = null;
      row.project = `${str(row.project) || "КП промо"} (копия)`;
    }

    const { data: created, error } = await context.supabase.from(t.doc).insert(row as never).select("id").single();
    if (error) throw new Error(error.message);
    const newId = (created as { id: string }).id;

    const copies = ((items ?? []) as Record<string, unknown>[]).map((it, i) => {
      const c: Record<string, unknown> = { ...it, [t.fk]: newId, sort_order: i };
      delete c.id;
      delete c.created_at;
      return c;
    });
    if (copies.length) await context.supabase.from(t.items).insert(copies as never);

    return { id: newId, kind: data.kind };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: DocKind; id: string }) => idSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertStaff(context as never);
    const { error } = await context.supabase.from(TABLES[data.kind].doc).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDocumentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: DocKind; id: string; status: string }) =>
    idSchema.extend({ status: z.enum(["draft", "sent", "accepted", "rejected"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertStaff(context as never);
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "sent") patch.sent_at = new Date().toISOString();
    const { error } = await context.supabase
      .from(TABLES[data.kind].doc)
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

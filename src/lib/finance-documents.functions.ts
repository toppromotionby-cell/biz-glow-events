// Этап 3 плана «Документы»: счета, договоры и акты как полноценные
// сохраняемые документы — со своими номерами, статусами, суммами,
// привязкой к заказу/КП и историей версий.
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

export type FinanceKind = "invoice" | "contract" | "act";

export type FinanceItem = { title: string; qty: number; price: number };

export type FinanceDocument = {
  id: string;
  kind: FinanceKind;
  doc_number: string;
  status: string;
  doc_date: string;
  due_date: string | null;
  client_name: string;
  client_company: string;
  client_unp: string;
  client_phone: string;
  client_email: string;
  client_address: string;
  event_date: string | null;
  items: FinanceItem[];
  total: number;
  paid: number;
  notes: string;
  order_id: string | null;
  quote_id: string | null;
  order_number: string | null;
  versions_count: number;
  created_at: string;
  updated_at: string;
};

export const FINANCE_STATUSES: Record<FinanceKind, Array<{ key: string; label: string }>> = {
  invoice: [
    { key: "draft", label: "Черновик" },
    { key: "issued", label: "Выставлен" },
    { key: "paid", label: "Оплачен" },
    { key: "cancelled", label: "Отменён" },
  ],
  contract: [
    { key: "draft", label: "Черновик" },
    { key: "sent", label: "Отправлен" },
    { key: "signed", label: "Подписан" },
    { key: "cancelled", label: "Отменён" },
  ],
  act: [
    { key: "draft", label: "Черновик" },
    { key: "sent", label: "Отправлен" },
    { key: "signed", label: "Подписан" },
    { key: "closed", label: "Закрыт" },
  ],
};

export const FINANCE_KIND_LABELS: Record<FinanceKind, string> = {
  invoice: "Счёт",
  contract: "Договор",
  act: "Акт",
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => Number(v ?? 0) || 0;

function toItems(raw: unknown): FinanceItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const it = (r ?? {}) as Record<string, unknown>;
    return { title: str(it.title), qty: num(it.qty) || 1, price: num(it.price) };
  });
}

function mapRow(raw: Record<string, unknown>): FinanceDocument {
  const order = (raw.orders ?? null) as Record<string, unknown> | null;
  return {
    id: String(raw.id),
    kind: (str(raw.kind) || "invoice") as FinanceKind,
    doc_number: str(raw.doc_number) || String(raw.id).slice(0, 8),
    status: str(raw.status) || "draft",
    doc_date: str(raw.doc_date),
    due_date: str(raw.due_date) || null,
    client_name: str(raw.client_name),
    client_company: str(raw.client_company),
    client_unp: str(raw.client_unp),
    client_phone: str(raw.client_phone),
    client_email: str(raw.client_email),
    client_address: str(raw.client_address),
    event_date: str(raw.event_date) || null,
    items: toItems(raw.items),
    total: num(raw.total),
    paid: num(raw.paid),
    notes: str(raw.notes),
    order_id: raw.order_id ? String(raw.order_id) : null,
    quote_id: raw.quote_id ? String(raw.quote_id) : null,
    order_number: order ? str(order.order_number) || null : null,
    versions_count: Array.isArray(raw.versions) ? raw.versions.length : 0,
    created_at: str(raw.created_at),
    updated_at: str(raw.updated_at),
  };
}

const SELECT = "*,orders(order_number)";

export const listFinanceDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; kind?: string; status?: string } | undefined) =>
    z
      .object({
        search: z.string().max(200).optional(),
        kind: z.enum(["all", "invoice", "contract", "act"]).optional(),
        status: z.string().max(30).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: FinanceDocument[]; sum: number; unpaid: number }> => {
    await assertStaff(context as never);

    let q = context.supabase.from("finance_documents").select(SELECT).order("created_at", { ascending: false }).limit(300);
    if (data.kind && data.kind !== "all") q = q.eq("kind", data.kind);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    let list = ((rows ?? []) as Record<string, unknown>[]).map(mapRow);
    const search = (data.search ?? "").trim().toLowerCase();
    if (search) {
      list = list.filter((r) =>
        `${r.doc_number} ${r.client_company} ${r.client_name} ${r.order_number ?? ""}`.toLowerCase().includes(search),
      );
    }

    return {
      rows: list,
      sum: list.reduce((s, r) => s + r.total, 0),
      unpaid: list
        .filter((r) => r.kind === "invoice" && r.status !== "paid" && r.status !== "cancelled")
        .reduce((s, r) => s + Math.max(0, r.total - r.paid), 0),
    };
  });

export const getFinanceDocument = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<FinanceDocument> => {
    await assertStaff(context as never);
    const { data: row, error } = await context.supabase
      .from("finance_documents")
      .select(SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Документ не найден");
    return mapRow(row as Record<string, unknown>);
  });

export const createFinanceDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: FinanceKind; orderId?: string | null; quoteId?: string | null }) =>
    z
      .object({
        kind: z.enum(["invoice", "contract", "act"]),
        orderId: z.string().uuid().nullish(),
        quoteId: z.string().uuid().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertStaff(context as never);

    const row: Record<string, unknown> = {
      kind: data.kind,
      status: "draft",
      created_by: context.userId,
      order_id: data.orderId ?? null,
      quote_id: data.quoteId ?? null,
    };

    if (data.orderId) {
      const [{ data: order }, { data: items }] = await Promise.all([
        context.supabase.from("orders").select("*").eq("id", data.orderId).maybeSingle(),
        context.supabase.from("order_items").select("title,qty,price").eq("order_id", data.orderId),
      ]);
      if (!order) throw new Error("Заказ не найден");
      const o = order as Record<string, unknown>;
      const list = ((items ?? []) as Record<string, unknown>[]).map((it) => ({
        title: str(it.title),
        qty: num(it.qty) || 1,
        price: num(it.price),
      }));
      Object.assign(row, {
        client_name: str(o.client_name),
        client_company: str(o.client_company),
        client_phone: str(o.client_phone),
        client_email: str(o.client_email),
        event_date: str(o.event_date) || null,
        notes: str(o.notes),
        items: list,
        total: list.reduce((s, it) => s + it.qty * it.price, 0),
        paid: num(o.paid),
      });
    } else if (data.quoteId) {
      const [{ data: quote }, { data: items }] = await Promise.all([
        context.supabase.from("quotes").select("*").eq("id", data.quoteId).maybeSingle(),
        context.supabase.from("quote_items").select("title,qty,price").eq("quote_id", data.quoteId).order("sort_order"),
      ]);
      if (!quote) throw new Error("КП не найдено");
      const q = quote as Record<string, unknown>;
      const list = ((items ?? []) as Record<string, unknown>[]).map((it) => ({
        title: str(it.title),
        qty: num(it.qty) || 1,
        price: num(it.price),
      }));
      Object.assign(row, {
        client_name: str(q.client_name),
        client_company: str(q.client_company),
        client_unp: str(q.client_unp),
        client_phone: str(q.client_phone),
        client_email: str(q.client_email),
        client_address: str(q.client_address),
        event_date: str(q.event_date) || null,
        order_id: q.order_id ? String(q.order_id) : null,
        items: list,
        total: list.reduce((s, it) => s + it.qty * it.price, 0),
      });
    }

    const { data: created, error } = await context.supabase
      .from("finance_documents")
      .insert(row as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (created as { id: string }).id };
  });

const itemSchema = z.object({ title: z.string().max(300), qty: z.number(), price: z.number() });

export const updateFinanceDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      patch: Partial<{
        status: string;
        paid: number;
        notes: string;
        due_date: string | null;
        doc_date: string;
        client_name: string;
        client_company: string;
        client_unp: string;
        client_phone: string;
        client_email: string;
        client_address: string;
        items: FinanceItem[];
      }>;
      snapshot?: boolean;
    }) =>
      z
        .object({
          id: z.string().uuid(),
          snapshot: z.boolean().optional(),
          patch: z.object({
            status: z.string().max(30).optional(),
            paid: z.number().optional(),
            notes: z.string().max(4000).optional(),
            due_date: z.string().nullish(),
            doc_date: z.string().optional(),
            client_name: z.string().max(200).optional(),
            client_company: z.string().max(200).optional(),
            client_unp: z.string().max(50).optional(),
            client_phone: z.string().max(50).optional(),
            client_email: z.string().max(200).optional(),
            client_address: z.string().max(300).optional(),
            items: z.array(itemSchema).optional(),
          }),
        })
        .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertStaff(context as never);

    const { data: current } = await context.supabase
      .from("finance_documents")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!current) throw new Error("Документ не найден");

    const patch: Record<string, unknown> = { ...data.patch };
    if (data.patch.items) {
      patch.total = data.patch.items.reduce((s, it) => s + (it.qty || 0) * (it.price || 0), 0);
    }

    if (data.snapshot) {
      const cur = current as Record<string, unknown>;
      const versions = Array.isArray(cur.versions) ? (cur.versions as unknown[]) : [];
      patch.versions = [
        ...versions.slice(-19),
        {
          at: new Date().toISOString(),
          status: str(cur.status),
          total: num(cur.total),
          paid: num(cur.paid),
          items: toItems(cur.items),
        },
      ];
    }

    const { error } = await context.supabase.from("finance_documents").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFinanceDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertStaff(context as never);
    const { error } = await context.supabase.from("finance_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

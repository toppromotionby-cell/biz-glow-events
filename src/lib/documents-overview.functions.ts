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

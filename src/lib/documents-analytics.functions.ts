// Этап 4 плана «Документы»: мини-аналитика и напоминания по документам.
import { createServerFn } from "@tanstack/react-start";
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

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => Number(v ?? 0) || 0;
const DAY = 86400000;

export type DocReminder = {
  id: string;
  kind: "quote" | "promo" | "invoice";
  severity: "info" | "warn" | "danger";
  title: string;
  detail: string;
};

export type DocumentsAnalytics = {
  stats: {
    quotesTotal: number;
    quotesSent: number;
    quotesAccepted: number;
    conversion: number; // % принятых от отправленных
    avgCheck: number;
    revenueAccepted: number;
    margin: number; // % маржи по позициям с себестоимостью
    marginProfit: number;
    invoicesUnpaid: number;
    invoicesUnpaidSum: number;
  };
  reminders: DocReminder[];
};

export const getDocumentsAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DocumentsAnalytics> => {
    await assertStaff(context as never);

    const [quotesRes, promoRes, itemsRes, financeRes] = await Promise.all([
      context.supabase
        .from("quotes")
        .select("id,quote_number,title,client_name,client_company,status,total,sent_at,viewed_at,client_response,doc_date,validity_days,valid_until_override")
        .eq("is_template", false)
        .limit(500),
      context.supabase
        .from("promo_quotes")
        .select("id,doc_number,project,client_name,status,total,sent_at,viewed_at,client_response,valid_until")
        .eq("is_template", false)
        .limit(500),
      context.supabase.from("quote_items").select("qty,price,cost").limit(5000),
      context.supabase.from("finance_documents").select("id,kind,doc_number,status,total,paid,due_date,client_name,client_company").limit(500),
    ]);

    const quotes = (quotesRes.data ?? []) as Record<string, unknown>[];
    const promos = (promoRes.data ?? []) as Record<string, unknown>[];
    const items = (itemsRes.data ?? []) as Record<string, unknown>[];
    const finance = (financeRes.data ?? []) as Record<string, unknown>[];

    const all = [...quotes, ...promos];
    const sent = all.filter((r) => str(r.sent_at) || str(r.status) !== "draft");
    const accepted = all.filter((r) => str(r.status) === "accepted");
    const revenueAccepted = accepted.reduce((s, r) => s + num(r.total), 0);

    let revenue = 0;
    let cost = 0;
    for (const it of items) {
      const line = num(it.qty) * num(it.price);
      const lineCost = num(it.qty) * num(it.cost);
      if (lineCost > 0) {
        revenue += line;
        cost += lineCost;
      }
    }

    const unpaid = finance.filter((f) => str(f.kind) === "invoice" && str(f.status) !== "paid" && str(f.status) !== "cancelled");

    const now = Date.now();
    const reminders: DocReminder[] = [];

    const pushQuoteReminders = (
      rows: Record<string, unknown>[],
      kind: "quote" | "promo",
      label: (r: Record<string, unknown>) => string,
      validUntil: (r: Record<string, unknown>) => string,
    ) => {
      for (const r of rows) {
        const sentAt = str(r.sent_at);
        const status = str(r.status);
        if (sentAt && !str(r.viewed_at) && status === "sent") {
          const days = Math.floor((now - new Date(sentAt).getTime()) / DAY);
          if (days >= 3) {
            reminders.push({
              id: String(r.id),
              kind,
              severity: days >= 7 ? "danger" : "warn",
              title: label(r),
              detail: `Отправлено ${days} дн. назад, клиент ещё не открыл`,
            });
          }
        }
        const vu = validUntil(r);
        if (vu && status !== "accepted" && status !== "rejected") {
          const left = Math.ceil((new Date(vu).getTime() - now) / DAY);
          if (left <= 5) {
            reminders.push({
              id: String(r.id),
              kind,
              severity: left < 0 ? "danger" : "warn",
              title: label(r),
              detail: left < 0 ? `Срок действия истёк ${-left} дн. назад` : `Срок действия истекает через ${left} дн.`,
            });
          }
        }
      }
    };

    pushQuoteReminders(
      quotes,
      "quote",
      (r) => `КП ${str(r.quote_number) || ""} · ${str(r.client_company) || str(r.client_name) || "без клиента"}`.trim(),
      (r) => {
        const override = str(r.valid_until_override);
        if (override) return override;
        const base = str(r.doc_date);
        const days = num(r.validity_days);
        return base && days ? new Date(new Date(base).getTime() + days * DAY).toISOString().slice(0, 10) : "";
      },
    );

    pushQuoteReminders(
      promos,
      "promo",
      (r) => `КП промо ${str(r.doc_number) || ""} · ${str(r.client_name) || "без клиента"}`.trim(),
      (r) => str(r.valid_until),
    );

    for (const f of unpaid) {
      const due = str(f.due_date);
      if (!due) continue;
      const left = Math.ceil((new Date(due).getTime() - now) / DAY);
      if (left <= 3) {
        reminders.push({
          id: String(f.id),
          kind: "invoice",
          severity: left < 0 ? "danger" : "warn",
          title: `Счёт ${str(f.doc_number)} · ${str(f.client_company) || str(f.client_name) || "без клиента"}`,
          detail: left < 0 ? `Просрочен на ${-left} дн.` : `Оплата ожидается через ${left} дн.`,
        });
      }
    }

    const order = { danger: 0, warn: 1, info: 2 } as const;
    reminders.sort((a, b) => order[a.severity] - order[b.severity]);

    return {
      stats: {
        quotesTotal: all.length,
        quotesSent: sent.length,
        quotesAccepted: accepted.length,
        conversion: sent.length ? Math.round((accepted.length / sent.length) * 100) : 0,
        avgCheck: accepted.length ? Math.round(revenueAccepted / accepted.length) : 0,
        revenueAccepted,
        margin: revenue ? Math.round(((revenue - cost) / revenue) * 100) : 0,
        marginProfit: Math.max(0, revenue - cost),
        invoicesUnpaid: unpaid.length,
        invoicesUnpaidSum: unpaid.reduce((s, f) => s + Math.max(0, num(f.total) - num(f.paid)), 0),
      },
      reminders: reminders.slice(0, 30),
    };
  });

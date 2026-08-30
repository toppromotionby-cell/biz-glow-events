// Серверные функции реестровых документов (приказы, протоколы, заявления):
// нумерация по журналам и годам, создание из мастера и выборка реестра.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertDocumentsStaff } from "@/lib/authz";
import { normalizeBlocks } from "@/lib/paperwork/model";
import { REGISTRY_DOC_TYPES, registrySpec } from "@/lib/paperwork/registry-docs";

export type OrderJournalRow = {
  id: string;
  title: string;
  doc_number: string;
  doc_date: string;
  status: string;
  order_journal: string;
  order_kind: string;
  order_year: number | null;
  employee_id: string | null;
  employee_name: string;
  updated_at: string;
};

const DocTypeSchema = z.enum(REGISTRY_DOC_TYPES).default("order");

/** Следующий свободный номер в журнале за год: 05-к, 12-л, 7. */
export const nextOrderNumber = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        docType: DocTypeSchema,
        journal: z.string().min(1).max(20),
        year: z.number().int().min(2000).max(2100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ number: string; seq: number }> => {
    await assertDocumentsStaff(context as never);
    const spec = registrySpec(data.docType);
    if (!spec) throw new Error("Неизвестный вид документа");

    const { data: rows, error } = await context.supabase
      .from("paperwork_documents")
      .select("doc_number")
      .eq("doc_type", data.docType)
      .eq("order_journal", data.journal)
      .eq("order_year", data.year);
    if (error) throw new Error(error.message);

    const seq =
      (rows ?? []).reduce((max, row) => {
        const n = Number(/^(\d+)/.exec(String((row as { doc_number?: string }).doc_number ?? ""))?.[1] ?? 0);
        return Number.isFinite(n) && n > max ? n : max;
      }, 0) + 1;

    const suffix = spec.journals.find((j) => j.code === data.journal)?.suffix ?? "";
    const body = data.docType === "order" ? String(seq).padStart(2, "0") : String(seq);
    return { seq, number: `${body}${suffix}` };
  });


/** Создание приказа мастером: блоки берём из вида, значения — из формы. */
export const createOrderDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.string().min(1).max(40),
        docNumber: z.string().max(40).default(""),
        docDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        title: z.string().max(300).default(""),
        companyId: z.string().uuid().nullable().optional(),
        employeeId: z.string().uuid().nullable().optional(),
        values: z.record(z.string().max(120), z.string().max(4000)).default({}),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertDocumentsStaff(context as never);
    const kind = ORDER_KIND_MAP[data.kind];
    if (!kind) throw new Error("Неизвестный вид приказа");

    let companyId = data.companyId ?? null;
    if (!companyId) {
      const { data: companies } = await context.supabase
        .from("company_profiles")
        .select("id,is_default")
        .order("is_default", { ascending: false })
        .order("sort_order")
        .limit(1);
      const firstCompany = companies?.[0] as { id?: string } | undefined;
      companyId = firstCompany?.id ? String(firstCompany.id) : null;
    }

    const title =
      data.title.trim() ||
      `Приказ №${data.docNumber} — ${kind.label.replace(/^О\s/, "о ")}`;

    const { data: row, error } = await context.supabase
      .from("paperwork_documents")
      .insert({
        company_profile_id: companyId,
        doc_type: "order",
        title,
        doc_number: data.docNumber,
        doc_date: data.docDate,
        blocks: normalizeBlocks(orderBlocks(kind)),
        values: data.values,
        status: "draft",
        author_id: context.userId,
        order_journal: kind.journal,
        order_kind: kind.code,
        order_year: Number(data.docDate.slice(0, 4)),
        employee_id: data.employeeId ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: String((row as { id: string }).id) };
  });

/** Реестр приказов с фильтрами по журналу, году, виду и работнику. */
export const listOrderJournal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        journal: z.string().max(10).optional(),
        year: z.number().int().min(2000).max(2100).nullable().optional(),
        kind: z.string().max(40).optional(),
        employeeId: z.string().uuid().nullable().optional(),
        search: z.string().max(160).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: OrderJournalRow[]; years: number[] }> => {
    await assertDocumentsStaff(context as never);

    let q = context.supabase
      .from("paperwork_documents")
      .select("id,title,doc_number,doc_date,status,order_journal,order_kind,order_year,employee_id,updated_at")
      .eq("doc_type", "order")
      .order("doc_date", { ascending: false })
      .limit(1000);

    if (data.journal && data.journal !== "all") q = q.eq("order_journal", data.journal);
    if (data.year) q = q.eq("order_year", data.year);
    if (data.kind && data.kind !== "all") q = q.eq("order_kind", data.kind);
    if (data.employeeId) q = q.eq("employee_id", data.employeeId);
    const term = (data.search ?? "").trim();
    if (term) q = q.or(`title.ilike.%${term}%,doc_number.ilike.%${term}%`);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as Record<string, unknown>[];
    const ids = [...new Set(list.map((r) => r.employee_id).filter(Boolean).map(String))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: emps } = await context.supabase
        .from("hr_employees")
        .select("id,full_name")
        .in("id", ids);
      for (const e of (emps ?? []) as Record<string, unknown>[]) {
        names.set(String(e.id), String(e.full_name ?? ""));
      }
    }

    const out: OrderJournalRow[] = list.map((r) => ({
      id: String(r.id),
      title: String(r.title ?? ""),
      doc_number: String(r.doc_number ?? ""),
      doc_date: String(r.doc_date ?? ""),
      status: String(r.status ?? "draft"),
      order_journal: String(r.order_journal ?? "main"),
      order_kind: String(r.order_kind ?? ""),
      order_year: r.order_year == null ? null : Number(r.order_year),
      employee_id: r.employee_id ? String(r.employee_id) : null,
      employee_name: r.employee_id ? (names.get(String(r.employee_id)) ?? "") : "",
      updated_at: String(r.updated_at ?? ""),
    }));

    const years = [...new Set(out.map((r) => r.order_year).filter((y): y is number => !!y))].sort(
      (a, b) => b - a,
    );
    return { rows: out, years };
  });

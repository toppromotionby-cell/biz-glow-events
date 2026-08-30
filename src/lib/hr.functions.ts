// Серверные функции реестра сотрудников (кадровые документы).
// Доступ — staff с правом documents.manage, как и остальной раздел КП/документов.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertDocumentsStaff } from "@/lib/authz";
import { normalizeEmployee, shortName, type HrEmployee } from "@/lib/paperwork/hr/model";

type Row = Record<string, unknown>;

const employeeInput = z.object({
  id: z.string().uuid().nullable().optional(),
  company_profile_id: z.string().uuid().nullable().optional(),
  tab_number: z.string().max(20).default(""),
  full_name: z.string().min(1).max(200),
  short_name: z.string().max(120).default(""),
  position: z.string().max(200).default(""),
  position_code: z.string().max(40).default(""),
  unit: z.string().max(160).default("Основное"),
  tariff: z.number().min(0).max(1_000_000).default(0),
  raise_pct: z.number().min(0).max(1000).default(0),
  rate: z.number().min(0).max(100).default(1),
  hired_on: z.string().max(10).nullable().optional(),
  fired_on: z.string().max(10).nullable().optional(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(10_000).default(0),
  notes: z.string().max(500).default(""),
});

export const listHrEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        companyId: z.string().uuid().nullable().optional(),
        includeInactive: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<HrEmployee[]> => {
    await assertDocumentsStaff(context as never);

    let q = context.supabase
      .from("hr_employees")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("full_name", { ascending: true })
      .limit(500);
    if (data.companyId) q = q.eq("company_profile_id", data.companyId);
    if (!data.includeInactive) q = q.eq("is_active", true);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Row[]).map(normalizeEmployee);
  });

export const saveHrEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => employeeInput.parse(d))
  .handler(async ({ data, context }): Promise<HrEmployee> => {
    await assertDocumentsStaff(context as never);

    const payload = {
      company_profile_id: data.company_profile_id ?? null,
      tab_number: data.tab_number.trim(),
      full_name: data.full_name.trim(),
      short_name: (data.short_name || shortName(data.full_name)).trim(),
      position: data.position.trim(),
      position_code: data.position_code.trim(),
      unit: data.unit.trim() || "Основное",
      tariff: data.tariff,
      raise_pct: data.raise_pct,
      rate: data.rate,
      hired_on: data.hired_on || null,
      fired_on: data.fired_on || null,
      is_active: data.is_active,
      sort_order: data.sort_order,
      notes: data.notes,
    };

    const q = data.id
      ? context.supabase.from("hr_employees").update(payload).eq("id", data.id).select("*").maybeSingle()
      : context.supabase.from("hr_employees").insert(payload).select("*").maybeSingle();

    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Не удалось сохранить сотрудника");
    return normalizeEmployee(row as Row);
  });

export const deleteHrEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertDocumentsStaff(context as never);
    const { error } = await context.supabase.from("hr_employees").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Массовый импорт сотрудников (из XLSX штатного расписания). */
export const importHrEmployees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        companyId: z.string().uuid().nullable().optional(),
        replace: z.boolean().default(false),
        employees: z.array(employeeInput.omit({ id: true })).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<{ inserted: number }> => {
    await assertDocumentsStaff(context as never);

    if (data.replace && data.companyId) {
      const { error } = await context.supabase
        .from("hr_employees")
        .delete()
        .eq("company_profile_id", data.companyId);
      if (error) throw new Error(error.message);
    }

    const rows = data.employees.map((e, i) => ({
      company_profile_id: data.companyId ?? null,
      tab_number: e.tab_number.trim() || String(i + 1),
      full_name: e.full_name.trim(),
      short_name: (e.short_name || shortName(e.full_name)).trim(),
      position: e.position.trim(),
      position_code: e.position_code.trim(),
      unit: e.unit.trim() || "Основное",
      tariff: e.tariff,
      raise_pct: e.raise_pct,
      rate: e.rate,
      hired_on: e.hired_on || null,
      fired_on: e.fired_on || null,
      is_active: e.is_active,
      sort_order: e.sort_order || i,
      notes: e.notes,
    }));
    if (!rows.length) return { inserted: 0 };

    const { error } = await context.supabase.from("hr_employees").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

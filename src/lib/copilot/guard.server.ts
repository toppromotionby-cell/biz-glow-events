// Гвардия помощника: кто имеет доступ, какие инструменты разрешены, какие лимиты.
import {
  COPILOT_SETTINGS_DEFAULTS,
  RISK_ORDER,
  type CopilotModule,
  type CopilotOp,
  type CopilotSettings,
} from "@/lib/copilot/types";
import { TOOL_LIST, toolMeta } from "@/lib/copilot/registry";

export class CopilotDenied extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CopilotDenied";
  }
}

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Доступ к помощнику: только роль admin (плюс явный список операторов). */
export async function assertCopilotAccess(ctx: {
  supabase: { rpc: (name: string, args: unknown) => Promise<{ data: unknown }> };
  userId: string;
}): Promise<void> {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (data === true) return;
  const settings = await getCopilotSettings();
  if (settings.operators.includes(ctx.userId)) return;
  throw new CopilotDenied("Помощник доступен только главному администратору");
}

export async function getCopilotSettings(): Promise<CopilotSettings> {
  const db = await admin();
  const { data } = await db.from("copilot_settings").select("*").eq("id", 1).maybeSingle();
  const row = (data ?? {}) as Partial<CopilotSettings>;
  return {
    ...COPILOT_SETTINGS_DEFAULTS,
    ...row,
    enabled_modules: Array.isArray(row.enabled_modules)
      ? (row.enabled_modules as CopilotModule[])
      : COPILOT_SETTINGS_DEFAULTS.enabled_modules,
    operators: Array.isArray(row.operators) ? (row.operators as string[]) : [],
  };
}

export async function patchCopilotSettings(patch: Partial<CopilotSettings>): Promise<CopilotSettings> {
  const db = await admin();
  const { error } = await db
    .from("copilot_settings")
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() } as never, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return getCopilotSettings();
}

/** Имена инструментов, разрешённых текущими настройками. */
export function allowedTools(settings: CopilotSettings): string[] {
  return TOOL_LIST.filter((t) => {
    if (t.module !== "web" && !settings.enabled_modules.includes(t.module)) return false;
    if (t.module === "web" && !settings.allow_web_search) return false;
    if (t.risk === "destructive" && !settings.allow_destructive) return false;
    return true;
  }).map((t) => t.name);
}

export function assertToolAllowed(name: string, settings: CopilotSettings): void {
  const meta = toolMeta(name);
  if (!meta) throw new CopilotDenied(`Неизвестный инструмент: ${name}`);
  if (!allowedTools(settings).includes(name)) {
    throw new CopilotDenied(`Инструмент «${meta.title}» отключён настройками помощника`);
  }
}

/** Лимиты на объём одного плана. */
export function assertOpsWithinLimits(ops: readonly CopilotOp[], settings: CopilotSettings): void {
  if (ops.length > settings.max_rows_per_run) {
    throw new CopilotDenied(
      `Слишком много записей в одной операции: ${ops.length}, разрешено ${settings.max_rows_per_run}. Разбейте задачу на части.`,
    );
  }
  const deletes = ops.filter((o) => o.op === "delete");
  if (deletes.length && !settings.allow_destructive) {
    throw new CopilotDenied("Удаление записей выключено в настройках помощника");
  }
  if (deletes.length > 10) {
    throw new CopilotDenied("Массовое удаление ограничено: не больше 10 записей за раз");
  }
}

export function riskAtLeast(a: string, b: string): boolean {
  return (RISK_ORDER[a as keyof typeof RISK_ORDER] ?? 0) >= (RISK_ORDER[b as keyof typeof RISK_ORDER] ?? 0);
}

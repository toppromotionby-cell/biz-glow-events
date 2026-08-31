// Инструменты ассистента: то, что модель может реально сделать с календарём.
// Каждый инструмент возвращает текст ответа (Telegram-HTML) и затронутые записи.
import type { AssistantPrefs, CalDirection, CalItem } from "@/lib/calendar/model";
import { freeSlots, isOverdue, priorityScore } from "@/lib/calendar/model";
import {
  deleteItem,
  getItem,
  listItemsBetween,
  listOpenTail,
  rescheduleItem,
  saveItem,
  searchItems,
  setStatus,
} from "@/lib/calendar/store.server";
import { dayLabel, dayRange, parseDayToken } from "@/lib/calendar/when";
import { renderDay, renderItemCard, renderRange, esc, plural } from "@/lib/calendar/render";
import { forgetByQuery, rememberMemory, type MemoryKind } from "@/lib/calendar/memory.server";
import { splitTaskIntoSteps } from "@/lib/calendar/parse.server";

type Db = Awaited<ReturnType<typeof import("@/lib/calendar/store.server").admin>>;

export interface ToolCtx {
  db: Db;
  prefs: AssistantPrefs;
  dirs: CalDirection[];
  now: Date;
  chatKey: string;
  /** Запись, о которой шла речь в диалоге. */
  focusItemId: string | null;
}

export interface ToolResult {
  text: string;
  items: CalItem[];
  focusItemId?: string | null;
}

type Args = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const iso = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// ——— Журнал действий (для «отмени») ———

async function logAction(
  ctx: ToolCtx,
  action: string,
  item: CalItem | null,
  before: Partial<CalItem> | null,
): Promise<void> {
  const { error } = await ctx.db.from("assistant_actions").insert({
    chat_key: ctx.chatKey,
    action,
    item_id: item?.id ?? null,
    before_state: (before ?? null) as never,
    after_state: (item ?? null) as never,
  });
  if (error) console.error("[planner] action log failed", error.message);
}

async function resolveTarget(ctx: ToolCtx, args: Args): Promise<CalItem | null> {
  const id = str(args.item_id);
  if (id) {
    const found = await getItem(ctx.db, id);
    if (found) return found;
  }
  const query = str(args.query) ?? str(args.title);
  if (query) {
    const list = await searchItems(ctx.db, query, 5);
    return list.find((i) => i.status !== "done" && i.status !== "canceled") ?? list[0] ?? null;
  }
  if (ctx.focusItemId) return getItem(ctx.db, ctx.focusItemId);
  return null;
}

function notFound(args: Args): ToolResult {
  const q = str(args.query) ?? str(args.title);
  return { text: q ? `Не нашёл запись «${esc(q)}». Уточните название?` : "Не понял, о какой записи речь. Назовите её.", items: [] };
}

// ——— Инструменты ———

async function toolCreate(ctx: ToolCtx, args: Args): Promise<ToolResult> {
  const title = str(args.title);
  if (!title) return { text: "Что записать? Назовите дело.", items: [] };
  const dir = ctx.dirs.find((d) => d.key === str(args.direction_key)) ?? null;
  const startsAt = iso(args.starts_at);
  const endsAt =
    iso(args.ends_at) ??
    (startsAt && str(args.kind) !== "task" ? new Date(new Date(startsAt).getTime() + 60 * 60_000).toISOString() : null);

  const item = await saveItem(ctx.db, {
    kind: str(args.kind) === "meeting" ? "meeting" : "task",
    title,
    notes: str(args.notes),
    direction_id: dir?.id ?? null,
    starts_at: startsAt,
    ends_at: endsAt,
    due_at: iso(args.due_at),
    all_day: args.all_day === true,
    tz: ctx.prefs.tz,
    importance: str(args.importance) === "hard" ? "hard" : "normal",
    location: str(args.location),
    participants: Array.isArray(args.participants) ? (args.participants as unknown[]).filter((p): p is string => typeof p === "string") : [],
    source: ctx.chatKey.startsWith("alice") ? "alice" : "telegram",
  });
  await logAction(ctx, "create", item, null);

  // Предупреждение о накладке — ничего не двигаем сами.
  let clashNote = "";
  if (item.starts_at) {
    const around = await listItemsBetween(
      ctx.db,
      new Date(new Date(item.starts_at).getTime() - 3 * 3_600_000).toISOString(),
      new Date(new Date(item.starts_at).getTime() + 3 * 3_600_000).toISOString(),
    );
    const clash = around.find(
      (o) => o.id !== item.id && o.starts_at && Math.abs(new Date(o.starts_at).getTime() - new Date(item.starts_at as string).getTime()) < 30 * 60_000,
    );
    if (clash) clashNote = `\n\n⚠️ Рядом уже стоит: <b>${esc(clash.title)}</b>. Оставляем как есть?`;
  }
  return { text: `${renderItemCard(item, ctx.dirs, ctx.prefs.tz, "Записал:\n")}${clashNote}`, items: [item], focusItemId: item.id };
}

async function toolList(ctx: ToolCtx, args: Args): Promise<ToolResult> {
  const range = str(args.range) ?? "today";
  const now = ctx.now;
  const tz = ctx.prefs.tz;
  const sorted = (list: CalItem[]) => list.sort((a, b) => priorityScore(b, now) - priorityScore(a, now));

  if (range === "overdue") {
    const tail = (await listOpenTail(ctx.db, now.toISOString())).filter((i) => isOverdue(i, now));
    return { text: sorted(tail).length ? renderRange("Просрочено", sorted(tail), ctx.dirs, tz, now) : "⚠️ <b>Просрочено</b>\nНичего — всё под контролем 👌", items: tail };
  }
  if (range === "open") {
    const tail = sorted(await listOpenTail(ctx.db, now.toISOString())).slice(0, 15);
    return { text: renderRange("Незакрытые хвосты", tail, ctx.dirs, tz, now), items: tail };
  }
  if (range === "week" || range === "next") {
    const days = range === "week" ? 7 : 14;
    const items = await listItemsBetween(ctx.db, now.toISOString(), new Date(now.getTime() + days * 86_400_000).toISOString());
    const limited = range === "next" ? items.slice(0, 5) : items;
    return { text: renderRange(range === "week" ? "Ближайшие 7 дней" : "Ближайшее", limited, ctx.dirs, tz, now), items: limited };
  }

  const dayToken = str(args.day);
  const day =
    range === "day" && dayToken
      ? parseDayToken(dayToken, tz, now) ?? dayRange(now, tz, 0).from
      : dayRange(now, tz, range === "tomorrow" ? 1 : 0).from;
  const items = sorted(
    await listItemsBetween(ctx.db, day.toISOString(), new Date(day.getTime() + 86_400_000).toISOString()),
  );
  return { text: renderDay(`План на ${dayLabel(day, tz, now)}`, items, ctx.dirs, tz, now), items };
}

async function toolFind(ctx: ToolCtx, args: Args): Promise<ToolResult> {
  const q = str(args.query);
  if (!q) return { text: "Что искать?", items: [] };
  const found = await searchItems(ctx.db, q, 10);
  return {
    text: found.length ? renderRange(`Нашёл по «${q}»`, found, ctx.dirs, ctx.prefs.tz, ctx.now) : `По «${esc(q)}» ничего нет.`,
    items: found,
    focusItemId: found[0]?.id ?? null,
  };
}

async function toolUpdate(ctx: ToolCtx, args: Args): Promise<ToolResult> {
  const target = await resolveTarget(ctx, args);
  if (!target) return notFound(args);
  const dirKey = str(args.direction_key);
  const dir = dirKey ? ctx.dirs.find((d) => d.key === dirKey) ?? null : null;
  const startsAt = iso(args.starts_at) ?? target.starts_at;
  const durationMs =
    target.starts_at && target.ends_at ? new Date(target.ends_at).getTime() - new Date(target.starts_at).getTime() : 60 * 60_000;
  const extraMin = typeof args.add_minutes === "number" ? args.add_minutes : 0;

  const item = await saveItem(ctx.db, {
    id: target.id,
    kind: str(args.kind) === "meeting" ? "meeting" : str(args.kind) === "task" ? "task" : target.kind,
    title: str(args.title) ?? target.title,
    notes: str(args.notes) ?? target.notes,
    direction_id: dir ? dir.id : target.direction_id,
    starts_at: startsAt,
    ends_at:
      iso(args.ends_at) ??
      (extraMin
        ? new Date(new Date(target.ends_at ?? startsAt ?? Date.now()).getTime() + extraMin * 60_000).toISOString()
        : startsAt
          ? new Date(new Date(startsAt).getTime() + durationMs).toISOString()
          : target.ends_at),
    due_at: iso(args.due_at) ?? target.due_at,
    all_day: typeof args.all_day === "boolean" ? args.all_day : target.all_day,
    tz: ctx.prefs.tz,
    status: target.status,
    importance: str(args.importance) === "hard" ? "hard" : str(args.importance) === "normal" ? "normal" : target.importance,
    location: str(args.location) ?? target.location,
    participants: Array.isArray(args.participants)
      ? (args.participants as unknown[]).filter((p): p is string => typeof p === "string")
      : target.participants,
    source: target.source,
  });
  await logAction(ctx, "update", item, target);
  return { text: renderItemCard(item, ctx.dirs, ctx.prefs.tz, "Обновил:\n"), items: [item], focusItemId: item.id };
}

async function toolReschedule(ctx: ToolCtx, args: Args): Promise<ToolResult> {
  const target = await resolveTarget(ctx, args);
  if (!target) return notFound(args);
  const when = iso(args.starts_at);
  if (!when) return { text: `На когда перенести «${esc(target.title)}»?`, items: [target], focusItemId: target.id };
  const updated = await rescheduleItem(ctx.db, target.id, when);
  if (!updated) return notFound(args);
  await logAction(ctx, "reschedule", updated, target);
  return { text: renderItemCard(updated, ctx.dirs, ctx.prefs.tz, "Перенёс:\n"), items: [updated], focusItemId: updated.id };
}

async function toolStatus(ctx: ToolCtx, args: Args): Promise<ToolResult> {
  const target = await resolveTarget(ctx, args);
  if (!target) return notFound(args);
  const status = str(args.status);
  const next: CalItem["status"] = status === "planned" || status === "in_progress" || status === "canceled" ? status : "done";
  const updated = await setStatus(ctx.db, target.id, next);
  if (!updated) return notFound(args);
  await logAction(ctx, "status", updated, target);
  const label = next === "done" ? "✅ Готово:" : next === "in_progress" ? "▶️ В работе:" : next === "canceled" ? "🚫 Отменил:" : "↩️ Вернул в план:";
  return { text: `${label} <b>${esc(updated.title)}</b>`, items: [updated], focusItemId: updated.id };
}

async function toolDelete(ctx: ToolCtx, args: Args): Promise<ToolResult> {
  const target = await resolveTarget(ctx, args);
  if (!target) return notFound(args);
  await deleteItem(ctx.db, target.id);
  await logAction(ctx, "delete", null, target);
  return { text: `🗑 Удалил: <b>${esc(target.title)}</b>`, items: [], focusItemId: null };
}

async function toolSlots(ctx: ToolCtx, args: Args): Promise<ToolResult> {
  const duration = typeof args.duration_min === "number" ? args.duration_min : 60;
  const days = typeof args.days === "number" ? args.days : 5;
  const busy = await listItemsBetween(
    ctx.db,
    ctx.now.toISOString(),
    new Date(ctx.now.getTime() + days * 86_400_000).toISOString(),
  );
  const dirKey = str(args.direction_key);
  const dir = dirKey ? ctx.dirs.find((d) => d.key === dirKey) ?? null : null;
  const slots = freeSlots(busy, {
    from: new Date(ctx.now.getTime() + 30 * 60_000),
    days,
    durationMin: duration,
    tz: ctx.prefs.tz,
    workStart: dir?.work_start,
    workEnd: dir?.work_end,
    limit: 5,
  });
  if (!slots.length) return { text: "Свободных окон в рабочие часы не нашёл.", items: [] };
  const fmt = new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: ctx.prefs.tz,
  });
  return {
    text: `🕒 Свободные окна на ${duration} мин:\n${slots.map((s, i) => `${i + 1}. ${esc(fmt.format(s))}`).join("\n")}`,
    items: [],
  };
}

async function toolNote(ctx: ToolCtx, args: Args): Promise<ToolResult> {
  const target = await resolveTarget(ctx, args);
  if (!target) return notFound(args);
  const note = str(args.note) ?? str(args.notes);
  if (!note) return { text: "Что дописать в заметку?", items: [target], focusItemId: target.id };
  const merged = [target.notes, note].filter(Boolean).join("\n");
  const item = await saveItem(ctx.db, { ...target, id: target.id, notes: merged });
  await logAction(ctx, "note", item, target);
  return { text: renderItemCard(item, ctx.dirs, ctx.prefs.tz, "Дописал:\n"), items: [item], focusItemId: item.id };
}

async function toolSplit(ctx: ToolCtx, args: Args): Promise<ToolResult> {
  const target = await resolveTarget(ctx, args);
  if (!target) return notFound(args);
  const steps = await splitTaskIntoSteps(target.title, target.notes);
  if (!steps.length) return { text: "Не смог разбить эту задачу на шаги.", items: [target], focusItemId: target.id };
  const base = new Date(target.due_at ?? target.starts_at ?? ctx.now.getTime() + 86_400_000).getTime();
  const created: CalItem[] = [];
  for (let i = 0; i < steps.length; i += 1) {
    const due = new Date(base - (steps.length - 1 - i) * 86_400_000);
    created.push(
      await saveItem(ctx.db, {
        kind: "task",
        title: steps[i] as string,
        notes: `Шаг задачи: ${target.title}`,
        direction_id: target.direction_id,
        due_at: due.toISOString(),
        tz: ctx.prefs.tz,
        importance: target.importance,
        source: "assistant",
      }),
    );
  }
  await logAction(ctx, "split", target, target);
  return {
    text: `Разбил «${esc(target.title)}» на ${created.length} ${plural(created.length, "шаг", "шага", "шагов")}:\n${created
      .map((c, i) => `${i + 1}. ${esc(c.title)}`)
      .join("\n")}`,
    items: created,
    focusItemId: target.id,
  };
}

async function toolRemember(ctx: ToolCtx, args: Args): Promise<ToolResult> {
  const kindRaw = str(args.kind);
  const kind: MemoryKind = kindRaw === "alias" || kindRaw === "habit" || kindRaw === "fact" ? kindRaw : "rule";
  const key = str(args.key);
  const value = str(args.value);
  if (!key || !value) return { text: "Что именно запомнить?", items: [] };
  await rememberMemory(ctx.db, { kind, key, value, source: "user" });
  return { text: `🧠 Запомнил: ${esc(key)} — ${esc(value)}`, items: [] };
}

async function toolForget(ctx: ToolCtx, args: Args): Promise<ToolResult> {
  const q = str(args.query);
  if (!q) return { text: "Что забыть?", items: [] };
  const n = await forgetByQuery(ctx.db, q);
  return { text: n ? `Забыл ${n} ${plural(n, "пункт", "пункта", "пунктов")} про «${esc(q)}».` : `Ничего похожего на «${esc(q)}» в памяти нет.`, items: [] };
}

async function toolUndo(ctx: ToolCtx): Promise<ToolResult> {
  const { data } = await ctx.db
    .from("assistant_actions")
    .select("*")
    .is("undone_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as unknown as {
    id: string;
    action: string;
    item_id: string | null;
    before_state: CalItem | null;
    after_state: CalItem | null;
  } | null;
  if (!row) return { text: "Отменять нечего.", items: [] };

  const markDone = async () => {
    await ctx.db.from("assistant_actions").update({ undone_at: new Date().toISOString() }).eq("id", row.id);
  };

  if (row.action === "create" && row.item_id) {
    await deleteItem(ctx.db, row.item_id);
    await markDone();
    return { text: `Отменил создание: <b>${esc(row.after_state?.title ?? "запись")}</b>`, items: [], focusItemId: null };
  }
  const before = row.before_state;
  if (!before) return { text: "Это действие отменить нельзя.", items: [] };
  const restored = await saveItem(ctx.db, {
    id: row.action === "delete" ? undefined : before.id,
    kind: before.kind,
    title: before.title,
    notes: before.notes,
    direction_id: before.direction_id,
    starts_at: before.starts_at,
    ends_at: before.ends_at,
    due_at: before.due_at,
    all_day: before.all_day,
    tz: before.tz,
    status: before.status,
    importance: before.importance,
    location: before.location,
    participants: before.participants,
    source: before.source,
  });
  await markDone();
  return { text: renderItemCard(restored, ctx.dirs, ctx.prefs.tz, "Вернул как было:\n"), items: [restored], focusItemId: restored.id };
}

// ——— Реестр ———

export type ToolName =
  | "create_item"
  | "list_items"
  | "find_items"
  | "update_item"
  | "reschedule_item"
  | "set_status"
  | "delete_item"
  | "free_slots"
  | "add_note"
  | "split_task"
  | "remember"
  | "forget"
  | "undo_last";

const HANDLERS: Record<ToolName, (ctx: ToolCtx, args: Args) => Promise<ToolResult>> = {
  create_item: toolCreate,
  list_items: toolList,
  find_items: toolFind,
  update_item: toolUpdate,
  reschedule_item: toolReschedule,
  set_status: toolStatus,
  delete_item: toolDelete,
  free_slots: toolSlots,
  add_note: toolNote,
  split_task: toolSplit,
  remember: toolRemember,
  forget: toolForget,
  undo_last: (ctx) => toolUndo(ctx),
};

export function isToolName(name: string): name is ToolName {
  return name in HANDLERS;
}

export async function runTool(ctx: ToolCtx, name: ToolName, args: Args): Promise<ToolResult> {
  return HANDLERS[name](ctx, args);
}

/** Описание инструментов для модели (OpenAI-совместимый формат). */
export function toolSchemas(dirKeys: string[]): unknown[] {
  const dirEnum = dirKeys.length ? { type: "string", enum: dirKeys } : { type: "string" };
  const target = {
    item_id: { type: "string", description: "ID записи, если известен из контекста" },
    query: { type: "string", description: "Название или его часть, если ID неизвестен" },
  };
  const def = (name: ToolName, description: string, properties: Record<string, unknown>, required: string[] = []) => ({
    type: "function",
    function: { name, description, parameters: { type: "object", properties, required } },
  });

  return [
    def(
      "create_item",
      "Создать задачу или встречу в календаре",
      {
        kind: { type: "string", enum: ["task", "meeting"] },
        title: { type: "string" },
        starts_at: { type: "string", description: "ISO8601 с офсетом" },
        ends_at: { type: "string" },
        due_at: { type: "string", description: "Срок для задачи, ISO8601" },
        all_day: { type: "boolean" },
        direction_key: dirEnum,
        importance: { type: "string", enum: ["normal", "hard"] },
        location: { type: "string" },
        participants: { type: "array", items: { type: "string" } },
        notes: { type: "string" },
      },
      ["title"],
    ),
    def("list_items", "Показать план на период", {
      range: { type: "string", enum: ["today", "tomorrow", "day", "week", "next", "overdue", "open"] },
      day: { type: "string", description: "Для range=day: «5.09», «пятница», «послезавтра»" },
    }),
    def("find_items", "Найти записи по тексту", { query: { type: "string" } }, ["query"]),
    def("update_item", "Изменить запись: название, время, длительность, направление, важность, место", {
      ...target,
      title: { type: "string" },
      kind: { type: "string", enum: ["task", "meeting"] },
      starts_at: { type: "string" },
      ends_at: { type: "string" },
      due_at: { type: "string" },
      all_day: { type: "boolean" },
      add_minutes: { type: "number", description: "Продлить/сократить на N минут" },
      direction_key: dirEnum,
      importance: { type: "string", enum: ["normal", "hard"] },
      location: { type: "string" },
      participants: { type: "array", items: { type: "string" } },
      notes: { type: "string" },
    }),
    def("reschedule_item", "Перенести запись на новое время", { ...target, starts_at: { type: "string" } }),
    def("set_status", "Отметить выполненной, вернуть в работу или отменить", {
      ...target,
      status: { type: "string", enum: ["done", "planned", "in_progress", "canceled"] },
    }),
    def("delete_item", "Удалить запись навсегда", target),
    def("free_slots", "Найти свободные окна в календаре", {
      duration_min: { type: "number" },
      days: { type: "number" },
      direction_key: dirEnum,
    }),
    def("add_note", "Дописать заметку к записи", { ...target, note: { type: "string" } }),
    def("split_task", "Разбить задачу на шаги и поставить их по дням", target),
    def(
      "remember",
      "Запомнить правило, сокращение, привычку или факт о пользователе",
      {
        kind: { type: "string", enum: ["rule", "alias", "habit", "fact"] },
        key: { type: "string", description: "О чём это: «обращение», «Кузнец», «длительность встреч»" },
        value: { type: "string" },
      },
      ["key", "value"],
    ),
    def("forget", "Забыть запомненное по ключевому слову", { query: { type: "string" } }, ["query"]),
    def("undo_last", "Отменить последнее действие ассистента", {}),
  ];
}

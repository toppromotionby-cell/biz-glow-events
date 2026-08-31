import { describe, expect, it } from "vitest";
import { TOOL_LIST, TOOLS, isToolName, toolSchemas } from "@/lib/copilot/registry";
import { formatValue, invertOps, meaningfulOps, opDiff, summarizeOps } from "@/lib/copilot/diff";
import { allowedTools, assertOpsWithinLimits, assertToolAllowed, CopilotDenied } from "@/lib/copilot/guard.server";
import { COPILOT_SETTINGS_DEFAULTS, maxRisk, type CopilotOp, type CopilotSettings } from "@/lib/copilot/types";
import { buildCopilotPersona } from "@/lib/copilot/persona";
import { WRITABLE_TABLES } from "@/lib/copilot/tools.server";

const settings: CopilotSettings = { ...COPILOT_SETTINGS_DEFAULTS };

const op = (over: Partial<CopilotOp> = {}): CopilotOp => ({
  op: "update",
  table: "zones",
  id: "z1",
  label: "Фотозона",
  before: { title: "Старое" },
  after: { title: "Новое" },
  ...over,
});

describe("реестр инструментов", () => {
  it("каждый инструмент уникален и описан", () => {
    const names = TOOL_LIST.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of TOOL_LIST) {
      expect(t.title.length).toBeGreaterThan(3);
      expect(t.description.length).toBeGreaterThan(10);
      expect(Object.keys(TOOLS)).toContain(t.name);
    }
  });

  it("пишущие инструменты работают только с разрешёнными таблицами", () => {
    const writable = new Set(Object.keys(WRITABLE_TABLES));
    for (const t of TOOL_LIST.filter((x) => x.writes)) {
      expect(t.risk === "read").toBe(false);
    }
    expect(writable.has("zones")).toBe(true);
    expect(writable.has("user_roles")).toBe(false);
    expect(writable.has("profiles")).toBe(false);
  });

  it("схемы для модели содержат обязательные поля", () => {
    const schemas = toolSchemas() as { function: { name: string; parameters: { required: string[] } } }[];
    const search = schemas.find((s) => s.function.name === "search_records");
    expect(search?.function.parameters.required).toContain("table");
    expect(isToolName("catalog_update")).toBe(true);
    expect(isToolName("drop_database")).toBe(false);
  });
});

describe("превью изменений", () => {
  it("показывает только реально изменённые поля", () => {
    const rows = opDiff(op({ before: { title: "A", published: true }, after: { title: "B", published: true } }));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.before).toBe("A");
    expect(rows[0]!.after).toBe("B");
  });

  it("отбрасывает пустые операции", () => {
    const same = op({ before: { title: "A" }, after: { title: "A" } });
    expect(meaningfulOps([same, op()])).toHaveLength(1);
  });

  it("форматирует цену и логические значения", () => {
    expect(formatValue({ from: 800, currency: "BYN", unit: "проект" })).toBe("от 800 BYN / проект");
    expect(formatValue(true)).toBe("да");
    expect(formatValue(null)).toBe("—");
  });

  it("сводка склоняется по-русски", () => {
    expect(summarizeOps([op()])).toContain("1 изменение");
    expect(summarizeOps([op({ id: "a" }), op({ id: "b" }), op({ id: "c" })])).toContain("3 изменения");
  });

  it("откат разворачивает операции", () => {
    const [back] = invertOps([op()]);
    expect(back!.before).toEqual({ title: "Новое" });
    expect(back!.after).toEqual({ title: "Старое" });
    const [undoInsert] = invertOps([op({ op: "insert", before: null, after: { title: "X" } })]);
    expect(undoInsert!.op).toBe("delete");
  });
});

describe("ограничения безопасности", () => {
  it("удаление выключено по умолчанию", () => {
    expect(allowedTools(settings)).not.toContain("catalog_delete");
    expect(() => assertToolAllowed("catalog_delete", settings)).toThrow(CopilotDenied);
  });

  it("выключенный модуль закрывает инструменты", () => {
    const noMail = { ...settings, enabled_modules: settings.enabled_modules.filter((m) => m !== "mail") };
    expect(allowedTools(noMail)).not.toContain("mail_template_update");
  });

  it("лимит массовых операций соблюдается", () => {
    const many = Array.from({ length: 51 }, (_, i) => op({ id: `z${i}` }));
    expect(() => assertOpsWithinLimits(many, settings)).toThrow(/Слишком много/);
    expect(() => assertOpsWithinLimits([op()], settings)).not.toThrow();
  });

  it("удаление не проходит без разрешения", () => {
    expect(() => assertOpsWithinLimits([op({ op: "delete" })], settings)).toThrow(CopilotDenied);
  });

  it("максимальный риск считается по шагам", () => {
    expect(maxRisk([{ risk: "read" }, { risk: "write" }])).toBe("write");
    expect(maxRisk([{ risk: "read" }])).toBe("read");
  });
});

describe("роль помощника", () => {
  const persona = buildCopilotPersona({
    now: new Date("2026-03-01T10:00:00Z"),
    context: { path: "/admin/orders/1", section: "Заявки", recordType: "order", recordId: "1", recordLabel: "01/03/2026-01" },
    memory: "",
    allowedTools: allowedTools(settings),
    allowWebSearch: true,
    maxRows: 50,
    allowDestructive: false,
  });

  it("запрещает объявлять изменения применёнными до утверждения", () => {
    expect(persona).toMatch(/пока человек не нажал «Утвердить»/);
  });

  it("передаёт контекст открытой записи", () => {
    expect(persona).toContain("Заявки");
    expect(persona).toContain("01/03/2026-01");
  });

  it("не перечисляет отключённые инструменты", () => {
    expect(persona).not.toContain("catalog_delete");
  });
});

describe("персона: конкретика на реальных данных", () => {
  const base = {
    now: new Date("2026-08-31T08:00:00Z"),
    context: null,
    memory: "",
    allowedTools: ["search_records"],
    allowWebSearch: false,
    maxRows: 50,
    allowDestructive: false,
  } as const;

  it("требует опираться на реальные записи, а не общие советы", () => {
    const p = buildCopilotPersona({ ...base });
    expect(p).toContain("Правило конкретики");
    expect(p).toMatch(/id\/номером/);
  });

  it("подмешивает фактическую сводку в промпт", () => {
    const p = buildCopilotPersona({ ...base, briefing: "Заявки за 90 дн.: 12, средний чек 4200 BYN." });
    expect(p).toContain("средний чек 4200 BYN");
    expect(p).toContain("Фактическая картина");
  });
});

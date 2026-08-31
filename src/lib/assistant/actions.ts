// Реестр разрешённых действий помощника. Клиентобезопасный модуль (используется в тестах и в админке).
// Всё, чего здесь нет, бот НЕ выполняет сам — только описывает в плане и просит сделать руками.

export const ALLOWED_ACTIONS = {
  kb_add: {
    title: "Записать факт в базу знаний",
    args: ["subject", "fact"],
    adminOnly: false,
  },
  kb_archive: {
    title: "Убрать устаревший факт из базы знаний",
    args: ["id"],
    adminOnly: true,
  },
  hygiene_fix: {
    title: "Закрыть замечание гигиены данных",
    args: ["id"],
    adminOnly: true,
  },
  hygiene_dismiss: {
    title: "Отклонить замечание гигиены данных",
    args: ["id"],
    adminOnly: true,
  },
  send_doc: {
    title: "Прислать документ в чат",
    args: ["kind", "id"],
    adminOnly: false,
  },
  order_note: {
    title: "Добавить внутреннюю заметку к заявке",
    args: ["orderId", "note"],
    adminOnly: false,
  },
  manual: {
    title: "Сделать вручную в админке",
    args: ["where"],
    adminOnly: false,
  },
} as const;

export type ActionName = keyof typeof ALLOWED_ACTIONS;

export function isAllowedAction(name: string): name is ActionName {
  return Object.prototype.hasOwnProperty.call(ALLOWED_ACTIONS, name);
}

/** Выполнимые автоматически (всё, кроме ручного шага). */
export function isExecutable(name: string): boolean {
  return isAllowedAction(name) && name !== "manual";
}

/** Подсказка модели: что бот вправе выполнить сам. */
export function actionsPrompt(): string {
  const rows = (Object.keys(ALLOWED_ACTIONS) as ActionName[])
    .map((k) => `- ${k}: ${ALLOWED_ACTIONS[k].title} (аргументы: ${ALLOWED_ACTIONS[k].args.join(", ") || "нет"})`)
    .join("\n");
  return [
    "Помощник вправе выполнить сам только эти действия:",
    rows,
    'Любой другой шаг оформляй действием "manual" с аргументом where — где в админке это сделать руками.',
  ].join("\n");
}

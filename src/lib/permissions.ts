// Единая матрица прав админки. Используется и на клиенте (меню, гейты страниц),
// и на сервере (assertPermission) — файл не должен импортировать серверный код.

export type AppRole = "admin" | "manager" | "accountant" | "content_editor" | "dj_admin" | "client";

export type Permission =
  | "orders.manage"        // раздел заказов/CRM
  | "orders.view_all"      // видеть чужие заказы (иначе только свои)
  | "orders.payments"      // отметка оплаты
  | "documents.manage"     // КП и промо-КП
  | "documents.finance"    // счета, договоры, акты
  | "documents.settings"   // реквизиты и шаблоны документов
  | "documents.knowledge"  // база знаний документов
  | "documents.cost_margin"// себестоимость и маржа
  | "content.manage"       // каталог, кейсы, отзывы, блог, разделы
  | "marketing.manage"     // рассылки, промокоды, почтовые ящики
  | "system.manage"        // системные настройки, шаблоны писем, соцсети, уведомления
  | "users.manage"         // пользователи и роли
  | "dj.manage"            // закрытый DJ-раздел: треки, софт, участники, модерация
  | "audit.view";          // журнал аудита

export const STAFF_ROLES: AppRole[] = ["admin", "manager", "accountant", "content_editor", "dj_admin"];

export const ROLE_LABEL: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  accountant: "Бухгалтер",
  content_editor: "Контент-редактор",
  dj_admin: "Администратор DJ-раздела",
  client: "Клиент",
};

export const ROLE_DESCRIPTION: Record<string, string> = {
  admin: "Полный доступ ко всем разделам, включая пользователей, аудит и системные настройки.",
  manager: "Продажи: заказы и заявки, КП, счета, рассылки и промокоды. Без себестоимости/маржи, пользователей и системных настроек.",
  accountant: "Финансы: все документы, счета, договоры, акты, оплаты и реквизиты. Без каталога и системных настроек.",
  content_editor: "Наполнение сайта: каталог, разделы, кейсы, отзывы, блог. Без заказов, документов и настроек.",
  dj_admin: "Только закрытый DJ-раздел: участники, библиотека треков, софт, модерация и обсуждения. Других разделов админки не видит.",
  client: "Обычный пользователь сайта, доступа к админке нет.",
};

const MATRIX: Record<AppRole, Permission[]> = {
  admin: [
    "orders.manage", "orders.view_all", "orders.payments",
    "documents.manage", "documents.finance", "documents.settings", "documents.knowledge", "documents.cost_margin",
    "content.manage", "marketing.manage", "system.manage", "users.manage", "audit.view", "dj.manage",
  ],
  manager: [
    "orders.manage", "orders.view_all", "orders.payments",
    "documents.manage", "documents.finance", "documents.knowledge",
    "marketing.manage",
  ],

  accountant: [
    "orders.manage", "orders.view_all", "orders.payments",
    "documents.manage", "documents.finance", "documents.settings", "documents.knowledge", "documents.cost_margin",
  ],
  content_editor: ["content.manage"],
  dj_admin: ["dj.manage"],
  client: [],
};

export function permissionsForRoles(roles: readonly string[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const r of roles) {
    const list = MATRIX[r as AppRole];
    if (list) for (const p of list) out.add(p);
  }
  return out;
}

export function roleHasPermission(roles: readonly string[], perm: Permission): boolean {
  return permissionsForRoles(roles).has(perm);
}

export function isStaffRoles(roles: readonly string[]): boolean {
  return roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
}

/** Правила доступа к маршрутам админки: первый совпавший префикс определяет право. */
export const ROUTE_PERMISSIONS: { match: RegExp; perm: Permission }[] = [
  { match: /^\/admin\/dj/, perm: "dj.manage" },
  { match: /^\/admin\/users/, perm: "users.manage" },
  { match: /^\/admin\/audit/, perm: "audit.view" },
  { match: /^\/admin\/sections/, perm: "system.manage" },
  { match: /^\/admin\/notifications/, perm: "system.manage" },
  { match: /^\/admin\/settings\/documents/, perm: "documents.settings" },
  { match: /^\/admin\/settings/, perm: "system.manage" },
  { match: /^\/admin\/documents\/knowledge/, perm: "documents.knowledge" },
  { match: /^\/admin\/documents\/(invoices|contracts|acts|finance)/, perm: "documents.finance" },
  { match: /^\/admin\/documents\/(quotes|promo|presentations)/, perm: "documents.manage" },
  { match: /^\/admin\/documents/, perm: "documents.manage" },
  // Корпоративные документы и их шаблоны — те же права, что и у КП.
  { match: /^\/admin\/paperwork/, perm: "documents.manage" },
  { match: /^\/admin\/orders/, perm: "orders.manage" },
  { match: /^\/admin\/calendar/, perm: "orders.manage" },
  { match: /^\/admin\/planner/, perm: "orders.manage" },
  { match: /^\/admin\/(catalog|catalog-structure|cases|testimonials|blog)/, perm: "content.manage" },
  { match: /^\/admin\/(campaigns|mail-accounts|promo)/, perm: "marketing.manage" },
];

export function permissionForPath(pathname: string): Permission | null {
  return ROUTE_PERMISSIONS.find((r) => r.match.test(pathname))?.perm ?? null;
}

/** Куда отправить пользователя, если текущий раздел ему недоступен. */
export function firstAllowedAdminPath(perms: Set<Permission>): string {
  if (perms.has("orders.manage")) return "/admin/orders";
  if (perms.has("documents.manage") || perms.has("documents.finance")) return "/admin/documents";
  if (perms.has("content.manage")) return "/admin/catalog-structure";
  if (perms.has("marketing.manage")) return "/admin/campaigns";
  if (perms.has("users.manage")) return "/admin/users";
  if (perms.has("dj.manage")) return "/admin/dj";
  return "/profile";
}

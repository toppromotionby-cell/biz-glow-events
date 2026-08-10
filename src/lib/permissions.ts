// Единая матрица прав админки. Используется и на клиенте (меню, гейты страниц),
// и на сервере (assertPermission) — файл не должен импортировать серверный код.

export type AppRole = "admin" | "manager" | "accountant" | "content_editor" | "client";

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
  | "audit.view";          // журнал аудита

export const STAFF_ROLES: AppRole[] = ["admin", "manager", "accountant", "content_editor"];

export const ROLE_LABEL: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  accountant: "Бухгалтер",
  content_editor: "Контент-редактор",
  client: "Клиент",
};

export const ROLE_DESCRIPTION: Record<string, string> = {
  admin: "Полный доступ ко всем разделам, включая пользователей, аудит и системные настройки.",
  manager: "Продажи: свои заказы, КП, счета по своим заказам, рассылки и промокоды. Без себестоимости, чужих заказов и системных настроек.",
  accountant: "Финансы: все документы, счета, договоры, акты, оплаты и реквизиты. Без каталога и системных настроек.",
  content_editor: "Наполнение сайта: каталог, разделы, кейсы, отзывы, блог. Без заказов, документов и настроек.",
  client: "Обычный пользователь сайта, доступа к админке нет.",
};

const MATRIX: Record<AppRole, Permission[]> = {
  admin: [
    "orders.manage", "orders.view_all", "orders.payments",
    "documents.manage", "documents.finance", "documents.settings", "documents.knowledge", "documents.cost_margin",
    "content.manage", "marketing.manage", "system.manage", "users.manage", "audit.view",
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
  { match: /^\/admin\/users/, perm: "users.manage" },
  { match: /^\/admin\/audit/, perm: "audit.view" },
  { match: /^\/admin\/sections/, perm: "system.manage" },
  { match: /^\/admin\/notifications/, perm: "system.manage" },
  { match: /^\/admin\/settings\/documents/, perm: "documents.settings" },
  { match: /^\/admin\/settings/, perm: "system.manage" },
  { match: /^\/admin\/documents\/knowledge/, perm: "documents.knowledge" },
  { match: /^\/admin\/documents\/(invoices|contracts|acts|finance)/, perm: "documents.finance" },
  { match: /^\/admin\/documents/, perm: "documents.manage" },
  { match: /^\/admin\/orders/, perm: "orders.manage" },
  { match: /^\/admin\/calendar/, perm: "orders.manage" },
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
  return "/profile";
}

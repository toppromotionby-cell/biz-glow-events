/**
 * Единый флаг для отключения любых debug- / editor-оверлеев в production.
 *
 * Управляется переменной окружения `VITE_DISABLE_DEV_OVERLAYS`:
 *   - "true"  → все оверлеи (TanStack Router/Query Devtools, ProdHealthBanner,
 *               будущие debug-панели) принудительно скрыты.
 *   - "false" → оверлеи показываются по обычным правилам (dev-режим и т.п.).
 *
 * По умолчанию в production-сборке (`import.meta.env.PROD === true`) оверлеи
 * выключены даже без явного флага — это safety net для деплоя.
 *
 * Используйте `DEV_OVERLAYS_ENABLED` как единственный гейт во всех новых
 * компонентах вместо разрозненных `process.env.NODE_ENV` проверок.
 */

const explicitDisable =
  String(import.meta.env.VITE_DISABLE_DEV_OVERLAYS ?? "").toLowerCase() === "true";

const explicitEnable =
  String(import.meta.env.VITE_DISABLE_DEV_OVERLAYS ?? "").toLowerCase() === "false";

export const DEV_OVERLAYS_ENABLED: boolean = explicitEnable
  ? true
  : explicitDisable
    ? false
    : !import.meta.env.PROD;

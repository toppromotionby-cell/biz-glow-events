// Единая точка инвалидации кэша админки и публичной части.
// Зачем: после сохранения в настройках правка должна быть видна и в админке,
// и на сайте. Раньше каждый экран сам перечислял ключи и что-то забывал.
import type { QueryClient } from "@tanstack/react-query";
import { adminKeys } from "@/lib/query-keys";

export type AdminEntity =
  | "social"
  | "site-settings"
  | "catalog-structure"
  | "emails"
  | "paperwork"
  | "documents"
  | "company-profiles";

type Keys = readonly (readonly unknown[])[];

const ENTITY_KEYS: Record<AdminEntity, Keys> = {
  // Соцсети живут в общих настройках сайта: админский и публичный кэш.
  social: [adminKeys.siteSettings, adminKeys.siteSettingsPublic],
  "site-settings": [adminKeys.siteSettings, adminKeys.siteSettingsPublic],
  // Структура каталога кормит мега-меню и страницу /catalog.
  "catalog-structure": [adminKeys.catalogStructure, adminKeys.catalogNav],
  emails: [adminKeys.emailTemplates],
  paperwork: [adminKeys.paperwork, adminKeys.paperworkTemplates],
  documents: [adminKeys.documents],
  "company-profiles": [adminKeys.companyProfiles],
};

/** Ключи, которые нужно сбросить после сохранения сущности. */
export function entityKeys(entity: AdminEntity): Keys {
  return ENTITY_KEYS[entity];
}

/** Сбросить кэш админки и публичной части после сохранения. */
export function invalidateEntity(qc: QueryClient, ...entities: AdminEntity[]) {
  for (const entity of entities) {
    for (const key of entityKeys(entity)) {
      qc.invalidateQueries({ queryKey: key as unknown[] });
    }
  }
}

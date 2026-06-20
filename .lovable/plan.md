## Что добавляем

Иконки **Instagram** и **TikTok** появятся в публичных местах сайта, а в админке — новый раздел «Соцсети», где менеджер/админ сможет вписать ссылки. Если ссылка не задана — иконка просто не показывается (никаких битых ссылок).

## Где появятся иконки на сайте

1. **Подвал (футер)** — отдельная строка с иконками рядом с блоком контактов. Видна на всех страницах. Каждую иконку можно отдельно скрыть через существующий раздел «Видимость секций» (ключи `footer.social.instagram`, `footer.social.tiktok`).
2. **Страница «Контакты»** — карточки в сетке вместе с Telegram/телефоном/почтой.
3. **Плавающий виджет связи** (`FloatingContacts`) — Instagram-иконка добавляется компактной кнопкой только если ссылка задана (TikTok туда не пихаем, чтобы не перегружать).

Иконки: `Instagram` из `lucide-react`; для TikTok добавим маленький собственный SVG-компонент `src/components/icons/TikTokIcon.tsx` (в lucide такой иконки нет).

## Админ-раздел «Соцсети»

- Новый пункт в сайдбаре админки (рядом с «Документы»): **Настройки → Соцсети**, маршрут `/admin/settings/social`.
- Форма с двумя полями: Instagram URL и TikTok URL, валидация формата `https://…`, кнопка «Сохранить». Доступ — `admin` или `manager`.
- Подсказка-превью: показываем как иконка выглядит и куда ведёт.

## Технические детали

**База:**
- Новая singleton-таблица `public.site_settings` (id boolean PK = true, `instagram_url text`, `tiktok_url text`, `updated_at`, `updated_by`).
- RLS: `SELECT` для `anon` + `authenticated` (публично, читается на каждой странице), `UPDATE`/`INSERT` — только `admin`/`manager` через `has_role()`. GRANT-ы выставим в той же миграции.
- Сидим одну строку с пустыми ссылками.

**Серверные функции** (`src/lib/site-settings.functions.ts`):
- `getSiteSettings` — `createServerFn GET`, читает через серверный publishable-клиент (можно вызывать в SSR публичных роутов).
- `updateSiteSettings` — `createServerFn POST` с `requireSupabaseAuth`, проверяет роль, валидирует URL через Zod, апдейт через `supabaseAdmin`.

**Клиент:**
- Хук `useSiteSettings()` (React Query, `staleTime: 5 мин`) — используется в `SiteChrome` (футер), `FloatingContacts`, `contacts.tsx`.
- Компонент `SocialIcons` (`src/components/SocialIcons.tsx`) — рендерит только те иконки, для которых задан URL, с `aria-label`, `target="_blank" rel="noopener noreferrer"`, иконки в стиле существующих glass-кнопок.

**Видимость:**
- Добавим два ключа в seed `site_sections`: `footer.social.instagram`, `footer.social.tiktok` (по умолчанию enabled), оборачиваем иконки в `<Toggleable>`.

## Файлы

Новые:
- `supabase/migrations/<ts>_site_settings.sql`
- `src/lib/site-settings.functions.ts`
- `src/hooks/use-site-settings.ts`
- `src/components/SocialIcons.tsx`
- `src/components/icons/TikTokIcon.tsx`
- `src/routes/admin.settings.social.tsx`

Правки:
- `src/components/SiteChrome.tsx` — вставка `<SocialIcons>` в футер (две колонки футера).
- `src/components/FloatingContacts.tsx` — опциональная кнопка Instagram.
- `src/routes/contacts.tsx` — карточки Instagram/TikTok при наличии URL.
- `src/components/admin/AdminSidebar.tsx` — пункт «Соцсети».

## Что НЕ меняем

- `src/lib/contacts.ts` (статичный CONTACT) оставляем как есть — соц.ссылки управляются из БД, телефон/email — статикой.
- Существующие иконки Telegram не трогаем.

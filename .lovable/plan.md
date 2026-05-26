## Что удаляем

Весь функционал email-подписки и рассылок: форма подписки в подвале, exit-intent модалка, страницы админки «Рассылка», «Email-кампании», все серверные функции и связанные таблицы в базе.

## Изменения по файлам

**Удалить файлы:**
- `src/components/NewsletterSignup.tsx`
- `src/components/ExitIntentModal.tsx`
- `src/routes/admin.newsletter.index.tsx`
- `src/routes/admin.newsletter.campaigns.tsx`
- `src/routes/admin.newsletter.campaigns.$id.tsx`
- `src/lib/newsletter.functions.ts`
- `src/lib/campaigns.functions.ts`

**Почистить ссылки:**
- `src/components/SiteChrome.tsx` — убрать `<NewsletterSignup />` (2 места) и импорт.
- `src/components/DeferredGlobals.tsx` — убрать `ExitIntentModal` и его lazy-импорт.
- `src/components/admin/AdminSidebar.tsx` — убрать пункт «Рассылка» (`/admin/newsletter`).
- `src/routes/admin.tsx` — убрать запись breadcrumbs `^/admin/newsletter`.
- `src/lib/site-sections.tsx` — убрать секцию `footer.newsletter` и (если есть) `global.exit_intent`.

## База данных

Дроп таблиц с RLS-политиками и связанными индексами:
- `public.newsletter_subscribers`
- `public.email_campaigns`
- `public.email_campaign_recipients`

Записи в `site_sections` с ключами `footer.newsletter` и `global.exit_intent` (если присутствуют) удалить через миграцию вместе с дропом таблиц.

## Проверка

После изменений: типы Supabase обновятся автоматически, билд должен проходить без ссылок на удалённые модули.

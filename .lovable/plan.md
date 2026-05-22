
# event-hub.by — план реализации

Спецификация огромная (по объёму это 3–5 полноценных проектов: публичный сайт + каталоги + auth + CRM + календарь + маркетинг + Telegram + PDF + compliance). За один проход качественно всё не уместить — получится «каркас без мяса». Предлагаю реалистичный поэтапный план, начиная с прочного фундамента.

## Важные расхождения со стеком

Шаблон Lovable — **TanStack Start** (не React Router DOM, не Vite-SPA). Адаптирую без потери функциональности:

- Роутинг: TanStack Router (file-based в `src/routes/`) вместо React Router DOM v6
- SEO/мета: встроенный `head()` API в роутах вместо `react-helmet-async`
- Backend: **TanStack server functions + Lovable Cloud (Supabase под капотом)**. Edge Functions использую только там, где действительно нужно (webhook от внешних сервисов). Telegram и PDF реализую через server functions — проще, быстрее, дешевле.
- Бэкенд называется «Lovable Cloud» в коммуникации с пользователем

Остальное (Supabase БД, Auth, Storage, RLS, Zustand, React Query, shadcn, framer-motion, FullCalendar, react-dropzone, hCaptcha, pdf-lib) — без изменений.

## Этап 1 (этот заход) — Фундамент

**Design system + публичная часть + auth + база данных + защита медиа**

1. Включить Lovable Cloud
2. Design system в `src/styles.css`: dark tech-lux, фиолетовое свечение `#7C3AED → #A855F7`, glass, glow, shimmer, prefers-reduced-motion
3. Структура роутов: `/`, `/zones`, `/equipment`, `/services`, `/production`, `/blog`, `/contacts`, `/login`, `/register`, `/profile`, `/privacy`, `/offer`
4. Главная: hero с анимированным градиентом, преимущества, CTA, отзывы, footer, partners
5. Schema БД (миграция): `profiles`, `zones`, `tech_equipment`, `services`, `production_items`, `orders`, `order_items`, `order_timeline`, `availability`, `audit_log`, `telegram_logs`, `campaigns`, `marketing_logs` + RLS политики + storage bucket `media`
6. User roles: enum `app_role` (`admin`, `manager`, `content_editor`, `marketer`), таблица `user_roles`, функция `has_role()`
7. Auth flow: `/register` (RHF + Zod, валидация телефона `^(\+7|375)\d{9,10}$`, пароль ≥8+символ, чекбокс согласия на ПД, email confirm), `/login`, `/profile` с историей заявок
8. Защищённые роуты через `_authenticated` layout
9. `PriceGate` компонент: цены только для авторизованных, JSON-LD `aggregateOffer` для SEO, `data-nosnippet` на контейнерах
10. `MediaShield` компонент: оверлей, блок contextmenu/dragstart, `controlsList="nodownload"`, signed URLs (15 мин)
11. `UniversalMediaUploader`: react-dropzone, Zod-валидация, ≤5 фото / ≤5 видео, MIME/размер чек, загрузка в Storage
12. SEO базис: `head()` метаданные на всех роутах, `sitemap.xml`, `robots.txt`, JSON-LD `LocalBusiness` + `Organization` в `__root.tsx`
13. Cookie consent баннер
14. Каталоги — публичные страницы списка для всех 4 сущностей с моковыми данными для демонстрации (CRUD-админка — следующий этап)

## Этап 2 (следующий заход) — Админка и CRM

- `/admin` layout с защитой по роли
- CRUD интерфейсы для всех каталогов (zones, equipment, services, production)
- CRM: таблица заказов, фильтры, экспорт CSV, карточка заказа, таймлайн
- Канбан-доска (статусы new → paid)
- FullCalendar (month/week/day, drag&drop, dark-override)
- Управление пользователями и ролями

## Этап 3 — Маркетинг и интеграции

- UTM-парсер (захват в leads/orders)
- ScriptInjector (GTM, Метрика, Ads, Direct)
- Marketing Dashboard (CPL/ROI, бюджеты, цели)
- Telegram-уведомления (server function + retry + telegram_logs)
- TelegramSettings UI (BOT_TOKEN в Secrets, тестовая отправка)

## Этап 4 — Enterprise модули

- GuestEstimator (диапазон цен без регистрации)
- Availability checker (блок при пересечении дат, фон в календаре)
- hCaptcha на чувствительных эндпоинтах
- audit_log триггеры для изменений цен/статусов
- PDF-генерация (server function + pdf-lib, счёт/договор/акт)
- i18n заготовка (RU + EN + BY)
- Блог/Новости с CMS

## Этап 5 — Production polish

- Core Web Vitals оптимизация (LCP <2s, CLS <0.05, INP <150ms)
- Реальный медиа-контент через imagegen
- Финальный SEO-аудит и rich snippets
- Тестирование RLS политик
- Деплой-чеклист

---

После одобрения сразу приступаю к Этапу 1. Если хочешь — могу сместить акценты (например, начать с админки вместо публички, или включить Telegram уже сейчас).

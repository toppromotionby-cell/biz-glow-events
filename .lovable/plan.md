# Что меняем

Сейчас в Telegram-ссылках в качестве подписи показывается номер `+375 44 709-91-22`. По всему сайту нужно показывать текст **«event-hub.by»**, а кликом — открывать существующую Telegram-ссылку (`CONTACT.telegramUrl` → `https://t.me/+375447099122`).

# Один источник правды

`src/lib/contacts.ts` — добавить поле `telegramLabel: "event-hub.by"` к `CONTACT`. Сам `telegramUrl` не трогаем — переадресация в Telegram продолжит работать на тот же номер, что и сейчас.

# Где поменять подпись на `CONTACT.telegramLabel`

Меняем только видимый текст возле Telegram-иконки/блока. Сам `href={CONTACT.telegramUrl}` остаётся.

1. **`src/routes/contacts.tsx`** (стр. 36) — карточка «Telegram», заменить `{CONTACT.phoneDisplay}` под подписью «Telegram» на `{CONTACT.telegramLabel}`.
2. **`src/routes/order.success.$id.tsx`** (стр. 47) — то же самое в карточке «Telegram».
3. **`src/components/SiteChrome.tsx`** (стр. 273 и 323) — в футере вместо `Telegram: {CONTACT.phoneDisplay}` показывать `Telegram: {CONTACT.telegramLabel}` (две одинаковые правки — desktop и mobile футеры).
4. **`src/routes/index.tsx`** (стр. 336) — в массиве контактов: `{ label: "Telegram", value: CONTACT.telegramLabel, href: CONTACT.telegramUrl, external: true }`.

# Где НЕ меняем

- `src/components/FloatingContacts.tsx` — там Telegram-кнопка без видимой подписи (только иконка), правок не требуется.
- `src/lib/email-templates/client-invite.tsx` — уже показывает `@event-hub.by`, оставляем.
- `CONTACT.phoneDisplay` в карточках «Телефон» — это телефонный канал, его не трогаем.
- Серверные функции / админка / Telegram-вебхуки и поддержка — это техническая интеграция, к UI-ссылке отношения не имеет.

# Проверка

- `/contacts`, `/`, футер на любой странице, страница успеха заказа — под иконкой Telegram отображается «event-hub.by», клик ведёт на `https://t.me/+375447099122` и открывает чат с тем же номером, что и сейчас.
- В письмах ничего не меняется.

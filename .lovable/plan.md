## Цель
Привести 13 email-шаблонов в `src/lib/email-templates/` к единому тёмному визуальному стилю, совпадающему с дизайн-системой сайта (чёрный фон, оранжевый градиент, glass-карточки).

## Дизайн-токены письма (единые для всех шаблонов)

```
BG          #0a0a0a   (основной фон body)
SURFACE     #141414   (карточка-контейнер 600px)
SURFACE_2   #1c1c1c   (вложенные блоки: цитата, list-карточки, totals)
BORDER      #2a2a2a
TEXT        #f5f5f5   (основной текст)
TEXT_MUTED  #a1a1aa   (подписи, футер)
ACCENT      #f59e0b   (оранжевый primary)
ACCENT_2    #f97316   (для градиента)
GRADIENT    linear-gradient(135deg, #f59e0b 0%, #f97316 100%)
SUCCESS     #22c55e   (order-paid/confirmed акценты)
DANGER      #ef4444   (order-cancelled акценты)
```

Шрифт: `'Space Grotesk', system-ui, -apple-system, Segoe UI, Roboto, sans-serif` для заголовков, `'Inter', system-ui, ...` для текста (с web-safe fallback — почтовики игнорируют web-fonts, fallback покрывает).

## Единый каркас письма

Все шаблоны получают одинаковую структуру:

```text
┌─ Body (BG #0a0a0a, padding 24px 0) ────────────────┐
│  ┌─ Container 600px (SURFACE, radius 16px) ─────┐  │
│  │  ▰▰▰ Gradient bar 4px ▰▰▰                    │  │
│  │  Header: "event-hub.by" (ACCENT, uppercase)  │  │
│  │  H1                                          │  │
│  │  Intro paragraph                             │  │
│  │  ── специфичный контент шаблона ──           │  │
│  │  (info-блоки на SURFACE_2 + BORDER 1px)      │  │
│  │  CTA Button (GRADIENT, white text)           │  │
│  │  Hr (BORDER)                                 │  │
│  │  Контакты: tel, Telegram, email              │  │
│  │  Footer muted: © event-hub.by + ссылки       │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

## Реализация

1. **Создать `src/lib/email-templates/_shared.tsx`** — общий каркас:
   - Экспортирует константы токенов (`EMAIL_TOKENS`).
   - Компоненты-обёртки: `EmailShell` (Html+Head+Body+Container+gradient bar+header), `EmailFooter` (Hr+контакты+©), `EmailButton`, `EmailInfoCard` (SURFACE_2), `EmailField` (label/value пара для admin-order/admin-lead), `EmailH1`, `EmailH2`, `EmailText`, `EmailMuted`.
   - Все компоненты принимают `accentVariant?: 'default' | 'success' | 'danger'` где нужно (для status emails).

2. **Переписать 13 шаблонов** на использование `_shared.tsx`, сохранив:
   - props-сигнатуры (`previewData` совместимость),
   - тексты и плейсхолдеры,
   - экспорт `template` объекта (registry не меняется),
   - subject-функции.

   Файлы: `admin-lead.tsx`, `admin-order.tsx`, `client-invite.tsx`, `email-change.tsx`, `invite.tsx`, `magic-link.tsx`, `recovery.tsx`, `reauthentication.tsx`, `signup.tsx`, `order-confirmed.tsx`, `order-paid.tsx`, `order-completed.tsx`, `order-cancelled.tsx`.

3. **Статусные письма** (`order-confirmed/paid/completed/cancelled`) — тот же каркас, но gradient bar и иконка/badge статуса используют соответствующий цвет (ACCENT/SUCCESS/DANGER). Кнопка CTA — всегда оранжевый GRADIENT для согласованности с брендом.

4. **Sanitizer override-HTML.** В `render-with-override.ts` уже есть `sanitizeEmailHtml` через DOMPurify. Тёмный фон применяется только к React-Email дефолтам — если админ через UI вставил свой HTML, он его и увидит. Никаких изменений в render-with-override не требуется.

5. **Превью в админке `/admin/settings/emails`.** iframe-превью отрисует уже тёмный шаблон by default; визуально проверим, что preview-контейнер не накладывает белый фон на iframe (если накладывает — добавим тёмный фон iframe wrapper).

## Что НЕ меняется
- Структура БД, registry, render-with-override, send.ts, webhook.ts.
- Тексты, subject-строки, props, плейсхолдеры.
- Дефолтные React-Email компоненты (`@react-email/components`) — продолжаем их использовать.
- HTML-overrides, сохранённые админом, не трогаются.

## Проверка
- `bun run build` (типы + сборка React-Email компонентов).
- Открыть `/admin/settings/emails`, пройти по всем 13 шаблонам, убедиться в превью что фон тёмный и стиль единый.
- Нажать «Тест-отправка» на 1-2 шаблона.

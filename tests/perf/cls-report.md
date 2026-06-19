# CLS Report — каталог карточек

## Замер до и после

| Device  | Page        | CLS до  | CLS после | Δ       | Verdict |
|---------|-------------|--------:|----------:|--------:|---------|
| mobile  | /equipment  | 0.0290  | 0.0293    | ≈0      | 🟢 good |
| mobile  | /services   | 0.0022  | 0.0022    | 0       | ✅ excellent |
| desktop | /equipment  | 0.0122  | 0.0122    | 0       | ✅ excellent |
| desktop | /services   | 0.0164  | 0.0000    | −0.0164 | ✅ excellent |
| mobile  | /           | 0.9975  | 0.9975    | 0       | 🔴 hero, вне scope (см. ниже) |
| desktop | /           | 1.0242  | 1.0161    | −0.0081 | 🔴 hero, вне scope |

**Бюджет каталога:** CLS < 0.1 ✅ (фактически ≤ 0.03 — «good», близко к «excellent»).
**Заголовки карточек:** обрезка по словам через `useClampedText` + `min-height: calc(2 * 1lh)`
на `.card-title-gradient` → ни одного дополнительного shift при смене длинных названий
(подтверждено `tests/visual/cards.assert.spec.ts` — Δ < 4px).

## Что было сделано

1. **Fallback-метрики шрифтов** (`src/styles.css`): `@font-face` `Space Grotesk Fallback`
   и `Inter Fallback` поверх `local("Arial")` с `size-adjust` / `ascent-override` /
   `descent-override` — рендер до и после загрузки веб-шрифта занимает одну и ту же
   высоту, font-swap больше не вызывает shift текста карточки.
2. **Containment** (`[contain:layout_style]` на `<article>` карточек) — асинхронные
   перерисовки соседних карточек не ретрашат соседей.
3. **`min-h` для chip-row** на каталоге — фильтры рендерятся синхронно, но если
   позже включится дополнительная категория, место уже зарезервировано.
4. **Skeleton ↔ data симметрия** в `FeaturedCardSkeleton` — те же `min-h` блоков, что
   и в живой карточке: переход skeleton → данные без shift'а.
5. **`useClampedText` интегрирован в `FeaturedCard` и `CatalogCard`** — словарная
   обрезка с `…`, полный заголовок в `aria-label`/`title`; CSS `-webkit-line-clamp: 2`
   остаётся safety net. **Не меняли** структуру `.card-title-gradient` (clip:text живёт
   на том же DOM-узле, что и текст — критично для корректного рендеринга градиента).
6. **`1lh` + 1.3em fallback** в `.card-title-gradient` — высота заголовка предсказуема
   даже на браузерах без `lh` (старее Chrome 110 / Safari 16.4).

## Вне scope: главная (CLS ≈ 1.0)

Источник shifts на главной (`div, div.hidden.md:flex, span`) — анимация входа hero
(`opacity-0 translate-y-6` → `opacity-100 translate-y-0`) + responsive layout
переключения. Это не карточки каталога. Если потребуется — отдельным тикетом:
свернуть entrance-translate в `transform`-only анимацию (transform не вызывает
layout-shift) или зарезервировать высоту hero-стека ещё до старта анимации.

## Регрессионная защита

- `tests/visual/cards.assert.spec.ts` — 4 теста × 5 viewports = **18 ассертов**
  (gradient / line-clamp / стабильная высота / выравнивание ряда).
- `tests/visual/cards.spec.ts` — пиксельные снапшоты для:
  short / long / hover / no-font / catalog-long / mixed-row на 5 viewports.
- `tests/perf/measure-cls.ts` — CLS-бюджет в CI (фейлит при > 0.1 на любой странице
  каталога).
- `.github/workflows/visual.yml` — все три шага + verify-untracked, fail-on-diff,
  артефакт `playwright-report` на 14 дней при падении.

Скрипт замера: `bun run tests/perf/measure-cls.ts` (локально или в CI).

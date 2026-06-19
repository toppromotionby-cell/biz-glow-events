# Visual regression tests (Playwright)

Real screenshot tests that snapshot key cards and modals across mobile and
intermediate widths to catch centering / alignment regressions.

## Viewports

Each project is a different viewport — a regression at one width fails its
dedicated snapshot:

| Project        | Width | Why                                            |
| -------------- | ----- | ---------------------------------------------- |
| `mobile-375`   | 375   | Default small phone                            |
| `mobile-414`   | 414   | Large phone                                    |
| `tablet-640`   | 640   | `sm` breakpoint — 2-col grid kicks in          |
| `tablet-768`   | 768   | `md` breakpoint — layout swaps to row-left     |
| `desktop-1024` | 1024  | `lg` desktop                                   |

## Run

```bash
# First time on Linux: install Chromium + system libs (~110 MB).
# --with-deps uses apt-get to pull libglib, libnss, libxkbcommon, etc.
bunx playwright install --with-deps chromium

# macOS / Windows already ship the required system libs.
bunx playwright install chromium

# Run all visual tests (auto-starts `bun run dev` on :8080)
bunx playwright test

# A single viewport
bunx playwright test --project mobile-375

# Update snapshots after an intentional design change
bunx playwright test --update-snapshots

# Run against an already-running preview
PW_BASE_URL=http://localhost:8080 bunx playwright test
```

> **Heads up — Lovable sandbox.** Browsers cannot launch in the Lovable
> editor sandbox (no `apt-get`, missing `libglib-2.0` and friends). Run
> these tests on your local machine or in CI. The first run there will
> generate the baseline PNGs; commit them.


The first run on a new machine creates baselines under
`tests/visual/centering.spec.ts-snapshots/`. Commit those baselines.
Future runs compare against them; any pixel diff above the configured
tolerance fails the test and writes a `*-diff.png` next to the actual.

## What's covered

- `CatalogChoiceModal` — catalog picker dialog cards
- `routes/industries.tsx` — industry tile grid + detail dialog header
- `routes/about.tsx` — VALUES cards
- **Cards (`cards.spec.ts`)** — `FeaturedCard` on the home, `CatalogCard` in
  `/equipment`, both with real short titles and an injected ultra-long title
  to verify `card-title-gradient` + word-aware ellipsis + 2-line height stay
  stable. Includes a desktop-only hover snapshot and a mixed-length row to
  catch height drift between cards.

Add new specs under `tests/visual/` following the same pattern: navigate,
call `stabilizePage(page)`, locate the section, call
`toHaveScreenshot('name-${testInfo.project.name}.png')`.

## Pairs with the structural tests

`src/components/__tests__/mobile-layout.test.ts` runs in Vitest (no browser,
milliseconds) and asserts the Tailwind classes that drive centering are
present. These Playwright tests are the visual ground truth. Run both.

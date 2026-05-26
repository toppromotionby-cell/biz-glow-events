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
# First time: install Chromium browser binary (~110 MB)
bunx playwright install chromium

# Run all visual tests (auto-starts `bun run dev`)
bunx playwright test

# Run a single viewport
bunx playwright test --project mobile-375

# Update snapshots after an intentional design change
bunx playwright test --update-snapshots

# Run against an already-running preview
PW_BASE_URL=http://localhost:3000 bunx playwright test
```

The first run on a new machine creates baselines under
`tests/visual/centering.spec.ts-snapshots/`. Commit those baselines.
Future runs compare against them; any pixel diff above the configured
tolerance fails the test and writes a `*-diff.png` next to the actual.

## What's covered

- `CatalogChoiceModal` — catalog picker dialog cards
- `routes/industries.tsx` — industry tile grid + detail dialog header
- `routes/about.tsx` — VALUES cards

Add new specs under `tests/visual/` following the same pattern: navigate,
call `stabilizePage(page)`, locate the section, call
`toHaveScreenshot('name-${testInfo.project.name}.png')`.

## Pairs with the structural tests

`src/components/__tests__/mobile-layout.test.ts` runs in Vitest (no browser,
milliseconds) and asserts the Tailwind classes that drive centering are
present. These Playwright tests are the visual ground truth. Run both.

# Biz Glow Events

## Visual Baseline Testing

This project uses Playwright for visual regression testing (baseline screenshots).

### Scripts

| Script | What it does |
|--------|-------------|
| `bun run baseline:update` | **Recommended for developers.** Checks system dependencies, installs Playwright + Chromium, then updates all baseline screenshots in one step. |
| `bun run baseline:verify` | Runs visual tests **without updating snapshots**. Fails on any difference — use in CI or before committing. |
| `bun run baseline:update:clean` | Completely wipes old snapshots + browsers and recreates baselines from scratch. Use when you suspect stale artifacts. |
| `bun run baseline:ci` | CI-optimized: updates **only missing** baseline screenshots and validates existing ones without overwriting. |
| `bun run baseline:check-deps` | Checks that required system libraries are present and prints distro-specific install commands if anything is missing. |

### Quick start

Update everything with a single command:

```bash
bun run baseline:update
```

Check that nothing has changed:

```bash
bun run baseline:verify
```

### System dependencies

The `baseline:*` scripts automatically check for system libraries on Linux. If anything is missing, the script will print the exact package manager command needed (e.g. `apt-get install ...`, `dnf install ...`, `pacman -S ...`). On macOS and Windows this check is skipped.

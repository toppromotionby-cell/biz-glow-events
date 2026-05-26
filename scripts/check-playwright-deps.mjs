#!/usr/bin/env node
/**
 * Preflight для `bun run baseline:update` (и связанных скриптов).
 *
 * Проверяет наличие системных библиотек, без которых Chromium от Playwright
 * не запустится на Linux. Если чего-то не хватает — печатает понятную
 * инструкцию (что именно поставить под Debian/Ubuntu, Fedora, Arch и Alpine)
 * и завершается с кодом 1, чтобы `playwright install` не падал с невнятной
 * ошибкой вида "error while loading shared libraries".
 *
 * На macOS/Windows проверка пропускается — там зависимости ставит сам
 * `playwright install --with-deps`.
 */

import { execSync, spawnSync } from "node:child_process";
import { platform } from "node:os";

if (platform() !== "linux") {
  console.log(`[playwright-deps] platform=${platform()} — пропускаю проверку (нужна только на Linux).`);
  process.exit(0);
}

// Библиотеки, которые Chromium из Playwright реально дёргает в runtime.
// Имена .so намеренно без точной версии — ищем по префиксу через ldconfig.
const REQUIRED_SONAMES = [
  "libnss3.so",
  "libnssutil3.so",
  "libsmime3.so",
  "libnspr4.so",
  "libatk-1.0.so",
  "libatk-bridge-2.0.so",
  "libcups.so",
  "libdrm.so",
  "libdbus-1.so",
  "libxkbcommon.so",
  "libatspi.so",
  "libX11.so",
  "libXcomposite.so",
  "libXdamage.so",
  "libXext.so",
  "libXfixes.so",
  "libXrandr.so",
  "libgbm.so",
  "libpango-1.0.so",
  "libcairo.so",
  "libasound.so",
];

// Карта soname → пакеты по основным дистрибутивам.
const PACKAGE_HINTS = {
  debian: {
    libnss3: "libnss3",
    libnssutil3: "libnss3",
    libsmime3: "libnss3",
    libnspr4: "libnspr4",
    "libatk-1.0": "libatk1.0-0",
    "libatk-bridge-2.0": "libatk-bridge2.0-0",
    libcups: "libcups2",
    libdrm: "libdrm2",
    "libdbus-1": "libdbus-1-3",
    libxkbcommon: "libxkbcommon0",
    libatspi: "libatspi2.0-0",
    libX11: "libx11-6",
    libXcomposite: "libxcomposite1",
    libXdamage: "libxdamage1",
    libXext: "libxext6",
    libXfixes: "libxfixes3",
    libXrandr: "libxrandr2",
    libgbm: "libgbm1",
    "libpango-1.0": "libpango-1.0-0",
    libcairo: "libcairo2",
    libasound: "libasound2",
  },
  fedora: {
    libnss3: "nss",
    libnssutil3: "nss",
    libsmime3: "nss",
    libnspr4: "nspr",
    "libatk-1.0": "atk",
    "libatk-bridge-2.0": "at-spi2-atk",
    libcups: "cups-libs",
    libdrm: "libdrm",
    "libdbus-1": "dbus-libs",
    libxkbcommon: "libxkbcommon",
    libatspi: "at-spi2-core",
    libX11: "libX11",
    libXcomposite: "libXcomposite",
    libXdamage: "libXdamage",
    libXext: "libXext",
    libXfixes: "libXfixes",
    libXrandr: "libXrandr",
    libgbm: "mesa-libgbm",
    "libpango-1.0": "pango",
    libcairo: "cairo",
    libasound: "alsa-lib",
  },
};

function hasLibrary(soname) {
  // 1) Быстрый путь — ldconfig -p (есть на glibc-дистрибутивах).
  const ldconfig = spawnSync("sh", ["-c", `ldconfig -p 2>/dev/null | grep -F ${soname}`]);
  if (ldconfig.status === 0 && ldconfig.stdout.toString().trim()) return true;

  // 2) Фолбэк — поиск в стандартных каталогах (на случай musl/Alpine).
  const find = spawnSync("sh", [
    "-c",
    `for d in /lib /lib64 /usr/lib /usr/lib64 /usr/local/lib /usr/lib/x86_64-linux-gnu /usr/lib/aarch64-linux-gnu; do [ -d "$d" ] && ls "$d" 2>/dev/null | grep -F ${soname} && exit 0; done; exit 1`,
  ]);
  return find.status === 0;
}

function detectDistro() {
  try {
    const os = execSync("cat /etc/os-release 2>/dev/null", { encoding: "utf8" });
    const idLike = `${os.match(/^ID=(.*)$/m)?.[1] ?? ""} ${os.match(/^ID_LIKE=(.*)$/m)?.[1] ?? ""}`.toLowerCase();
    if (/alpine/.test(idLike)) return "alpine";
    if (/fedora|rhel|centos|rocky|almalinux/.test(idLike)) return "fedora";
    if (/arch|manjaro/.test(idLike)) return "arch";
    if (/debian|ubuntu|mint/.test(idLike)) return "debian";
  } catch {}
  return "debian";
}

const missing = REQUIRED_SONAMES.filter((s) => !hasLibrary(s));

if (missing.length === 0) {
  console.log(`[playwright-deps] OK — все системные библиотеки на месте (${REQUIRED_SONAMES.length} шт.).`);
  process.exit(0);
}

const distro = detectDistro();
const baseNames = missing.map((s) => s.replace(/\.so.*$/, ""));

console.error("\n[playwright-deps] ❌ Не хватает системных библиотек для Chromium:");
for (const s of missing) console.error(`  - ${s}`);

console.error("\nЧто установить:\n");

if (distro === "debian") {
  const pkgs = [...new Set(baseNames.map((n) => PACKAGE_HINTS.debian[n]).filter(Boolean))];
  console.error("  Debian / Ubuntu:");
  console.error(`    sudo apt-get update && sudo apt-get install -y ${pkgs.join(" ")}`);
  console.error("\n  Или одной командой (все зависимости Playwright сразу):");
  console.error("    sudo bunx playwright install-deps chromium");
} else if (distro === "fedora") {
  const pkgs = [...new Set(baseNames.map((n) => PACKAGE_HINTS.fedora[n]).filter(Boolean))];
  console.error("  Fedora / RHEL:");
  console.error(`    sudo dnf install -y ${pkgs.join(" ")}`);
} else if (distro === "arch") {
  console.error("  Arch / Manjaro:");
  console.error("    sudo pacman -S --needed nss nspr atk at-spi2-atk libcups libdrm dbus libxkbcommon \\");
  console.error("      at-spi2-core libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa pango cairo alsa-lib");
} else if (distro === "alpine") {
  console.error("  Alpine (musl): официально Playwright Chromium не поддерживается.");
  console.error("  Используйте Debian/Ubuntu контейнер либо chromium из репозитория Alpine:");
  console.error("    apk add --no-cache chromium nss freetype harfbuzz ttf-freefont");
}

console.error("\nПосле установки запустите снова:  bun run baseline:update\n");
process.exit(1);

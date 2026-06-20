#!/usr/bin/env node
// Smoke-test all key public pages on production. Exits 1 on any 5xx.
// Usage: node scripts/smoke-prod.mjs [baseUrl]

const BASE = process.argv[2] ?? "https://event-hub.by";
const PATHS = [
  "/",
  "/zones",
  "/equipment",
  "/services",
  "/production",
  "/cases",
  "/blog",
  "/contacts",
  "/api/public/health",
];

let failed = 0;
for (const path of PATHS) {
  const url = `${BASE}${path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, { headers: { "user-agent": "lovable-smoke-test" } });
    const ms = Date.now() - started;
    const ok = res.status < 500;
    console.log(`${ok ? "✓" : "✗"} ${res.status} ${ms}ms ${path}`);
    if (!ok) failed++;
  } catch (err) {
    console.log(`✗ ERR ${path} — ${err.message}`);
    failed++;
  }
}

console.log(`\n${failed === 0 ? "All OK" : `${failed} failed`}`);
process.exit(failed === 0 ? 0 : 1);

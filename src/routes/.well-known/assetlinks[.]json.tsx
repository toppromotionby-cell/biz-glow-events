// Digital Asset Links для Trusted Web Activity (TWA / Android-приложение).
// После того как ты соберёшь TWA через Bubblewrap, замени SHA256 fingerprint ниже
// на реальный (см. twa/README.md → шаг "Получить SHA-256").
import { createFileRoute } from "@tanstack/react-router";

const PACKAGE_NAME = "by.event_hub.twa";

// PLACEHOLDER — заменить на fingerprint реального release-ключа после первой сборки APK.
// Можно указать несколько (release + Play App Signing) — массив строк.
const SHA256_FINGERPRINTS: string[] = [
  "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99",
];

export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: async () => {
        const body = JSON.stringify([
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: PACKAGE_NAME,
              sha256_cert_fingerprints: SHA256_FINGERPRINTS,
            },
          },
        ]);
        return new Response(body, {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});

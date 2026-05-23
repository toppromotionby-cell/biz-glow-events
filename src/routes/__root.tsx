import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import ogDefault from "@/assets/og-default.jpg";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/CookieConsent";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { ScriptInjector } from "@/components/ScriptInjector";
import { EffectsLayer } from "@/components/EffectsLayer";
import { FloatingContacts } from "@/components/FloatingContacts";
import { CartSync } from "@/components/CartSync";
import { captureUtmFromLocation } from "@/lib/utm";
import { SiteSectionsProvider, Toggleable } from "@/lib/site-sections";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-radial-glow px-4">
      <div className="max-w-md text-center">
        <h1 className="text-8xl font-display font-bold gradient-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Страница не найдена</h2>
        <p className="mt-2 text-sm text-muted-foreground">Возможно, страница перемещена или удалена.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-gradient-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary">
          На главную
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-muted-foreground">Попробуйте ещё раз или вернитесь на главную.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary">
            Попробовать снова
          </button>
          <a href="/" className="rounded-md border border-border px-4 py-2 text-sm">На главную</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "yandex-verification", content: "acd6f8135beba18a" },
      { title: "event-hub.by" },
      { name: "description", content: "Интерактивные зоны, оборудование, услуги и производство для мероприятий в Беларуси. VR/AR, LED, фотозоны, BTL, промо." },
      { name: "author", content: "event-hub.by" },
      { property: "og:site_name", content: "event-hub.by" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "ru_BY" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#000000" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Event Hub" },
      { name: "application-name", content: "event-hub.by" },
      { property: "og:title", content: "event-hub.by — Event-технологии и продакшн в Минске" },
      { name: "twitter:title", content: "event-hub.by — Event-технологии и продакшн в Минске" },
      { property: "og:description", content: "Интерактивные зоны, оборудование, услуги и производство для мероприятий в Беларуси. VR/AR, LED, фотозоны, BTL, промо." },
      { name: "twitter:description", content: "Интерактивные зоны, оборудование, услуги и производство для мероприятий в Беларуси. VR/AR, LED, фотозоны, BTL, промо." },
      // Дефолтный og:image. Динамические листовые роуты переопределяют его картинкой контента.
      { property: "og:image", content: `https://event-hub.by${ogDefault}` },
      { name: "twitter:image", content: `https://event-hub.by${ogDefault}` },
      { property: "og:image:width", content: "1216" },
      { property: "og:image:height", content: "640" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://blevlkoetlbhtzhakqsi.supabase.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://blevlkoetlbhtzhakqsi.supabase.co" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" },
    ],
    scripts: [
      {
        children: `(function(){try{var t=localStorage.getItem('site-theme')||'auto';var isLight=t==='light'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: light)').matches);var r=document.documentElement;r.classList.remove('theme-dark','theme-light');r.classList.add(isLight?'theme-light':'theme-dark');r.dataset.theme=t;}catch(e){}})();`,
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://event-hub.by/#organization",
              name: "event-hub.by",
              url: "https://event-hub.by",
              logo: "https://event-hub.by/favicon.ico",
              email: "hello@event-hub.by",
              telephone: "+375447099122",
              sameAs: ["https://t.me/+375447099122"],
            },
            {
              "@type": "WebSite",
              "@id": "https://event-hub.by/#website",
              url: "https://event-hub.by",
              name: "event-hub.by",
              inLanguage: "ru-BY",
              publisher: { "@id": "https://event-hub.by/#organization" },
              potentialAction: {
                "@type": "SearchAction",
                target: { "@type": "EntryPoint", urlTemplate: "https://event-hub.by/search?q={search_term_string}" },
                "query-input": "required name=search_term_string",
              },
            },
            {
              "@type": "LocalBusiness",
              "@id": "https://event-hub.by/#localbusiness",
              name: "event-hub.by",
              description: "Event-технологии, продакшн, интерактивные зоны и производство для мероприятий",
              url: "https://event-hub.by",
              telephone: "+375447099122",
              email: "hello@event-hub.by",
              address: { "@type": "PostalAddress", addressLocality: "Минск", addressCountry: "BY" },
              areaServed: "BY",
              priceRange: "BYN",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function DynamicToaster() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const update = () => {
      setTheme(document.documentElement.classList.contains("theme-light") ? "light" : "dark");
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return <Toaster theme={theme} />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { captureUtmFromLocation(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <SiteSectionsProvider>
        <div className="min-h-screen flex flex-col bg-background bg-radial-glow">
          <EffectsLayer />
          <SiteHeader />
          <main id="main" className="flex-1"><Outlet /></main>
          <SiteFooter />
          <Toggleable sectionKey="global.cookies"><CookieConsent /></Toggleable>
          <FloatingContacts />
          <CartSync />
          <ScriptInjector />
          <DynamicToaster />
        </div>
      </SiteSectionsProvider>
    </QueryClientProvider>
  );
}

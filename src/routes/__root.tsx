import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import ogDefault from "@/assets/og-default.jpg";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { AutoBreadcrumbs } from "@/components/AutoBreadcrumbs";
import { captureUtmFromLocation } from "@/lib/utm";
import { SiteSectionsProvider } from "@/lib/site-sections";
import { DeferredGlobals } from "@/components/DeferredGlobals";
import { NotFoundView, ErrorView } from "@/components/ErrorBoundaries";


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "yandex-verification", content: "acd6f8135beba18a" },
      { title: "event-hub.by — Event-технологии и продакшн в Минске" },
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
      // Шрифты грузим неблокирующе: link.media="print" → меняем на "all" после load.
      { rel: "preload", as: "style", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap", media: "print", id: "google-fonts" },
    ],
    scripts: [
      {
        children: `(function(){try{var t=localStorage.getItem('site-theme')||'auto';var isLight=t==='light'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: light)').matches);var r=document.documentElement;r.classList.remove('theme-dark','theme-light');r.classList.add(isLight?'theme-light':'theme-dark');r.dataset.theme=t;}catch(e){}})();`,
      },
      {
        children: `(function(){function s(){var l=document.getElementById('google-fonts');if(l)l.media='all';}if(document.readyState==='complete'){s();}else{window.addEventListener('load',s,{once:true});}})();`,
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
              email: "hello@event-hub.by",
              address: { "@type": "PostalAddress", addressLocality: "Минск", addressCountry: "BY" },
              areaServed: { "@type": "Country", name: "Belarus" },
              priceRange: "BYN",
              geo: { "@type": "GeoCoordinates", latitude: 53.9006, longitude: 27.5590 },
              openingHoursSpecification: [
                { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday"], opens: "10:00", closes: "19:00" },
                { "@type": "OpeningHoursSpecification", dayOfWeek: ["Saturday"], opens: "11:00", closes: "17:00" },
              ],
              aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "47", bestRating: "5", worstRating: "1" },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => <NotFoundView />,
  errorComponent: ({ error, reset }) => <ErrorView error={error} reset={reset} />,
});


function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function DynamicToaster() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const read = () => (document.documentElement.classList.contains("theme-light") ? "light" : "dark");
    setTheme(read());
    // Тема меняется только через ThemeToggle (custom event) и системой (matchMedia).
    const onChange = () => setTheme(read());
    window.addEventListener("themechange", onChange);
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener?.("change", onChange);
    return () => {
      window.removeEventListener("themechange", onChange);
      mq.removeEventListener?.("change", onChange);
    };
  }, []);

  return <Toaster theme={theme} />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { captureUtmFromLocation(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <SiteSectionsProvider>
        <div className="min-h-dvh flex flex-col bg-background bg-radial-glow">
          <SiteHeader />
          <AutoBreadcrumbs />
          <main id="main" className="flex-1"><Outlet /></main>
          <SiteFooter />
          <DeferredGlobals />
          <DynamicToaster />
        </div>
      </SiteSectionsProvider>
    </QueryClientProvider>
  );
}

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/CookieConsent";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { ScriptInjector } from "@/components/ScriptInjector";
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
      { title: "event-hub.by" },
      { name: "description", content: "Интерактивные зоны, оборудование, услуги и производство для мероприятий в Беларуси. VR/AR, LED, фотозоны, BTL, промо." },
      { name: "author", content: "event-hub.by" },
      { property: "og:site_name", content: "event-hub.by" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "ru_BY" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#000000" },
      { property: "og:title", content: "event-hub.by — Event-технологии и продакшн в Минске" },
      { name: "twitter:title", content: "event-hub.by — Event-технологии и продакшн в Минске" },
      { property: "og:description", content: "Интерактивные зоны, оборудование, услуги и производство для мероприятий в Беларуси. VR/AR, LED, фотозоны, BTL, промо." },
      { name: "twitter:description", content: "Интерактивные зоны, оборудование, услуги и производство для мероприятий в Беларуси. VR/AR, LED, фотозоны, BTL, промо." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ffaaaf2e-1949-430d-8e96-adf5a760e4a7/id-preview-3e0fec23--8e78edb2-4da2-4eba-a854-c653075850d6.lovable.app-1779418625962.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ffaaaf2e-1949-430d-8e96-adf5a760e4a7/id-preview-3e0fec23--8e78edb2-4da2-4eba-a854-c653075850d6.lovable.app-1779418625962.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" },
    ],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "event-hub.by",
        description: "Event-технологии, продакшн, интерактивные зоны и производство для мероприятий",
        url: "https://event-hub.by",
        telephone: "+375290000000",
        email: "hello@event-hub.by",
        address: { "@type": "PostalAddress", addressLocality: "Минск", addressCountry: "BY" },
        areaServed: "BY",
        priceRange: "BYN",
      }),
    }],
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { captureUtmFromLocation(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <SiteSectionsProvider>
        <TextOverridesProvider>
          <div className="min-h-screen flex flex-col bg-background bg-radial-glow">
            <SiteHeader />
            <main id="main" className="flex-1"><Outlet /></main>
            <SiteFooter />
            <Toggleable sectionKey="global.cookies"><CookieConsent /></Toggleable>
            <ScriptInjector />
            <Toaster theme="dark" />
          </div>
        </TextOverridesProvider>
      </SiteSectionsProvider>
    </QueryClientProvider>
  );
}

// ScriptInjector — лениво подгружает GTM, Google Analytics, Яндекс.Метрику и
// Facebook Pixel ТОЛЬКО после согласия cookies (KEY="eh_cookie_consent" === "accept").
// IDs читаются из VITE_* (публичные). Если ID не задан — пиксель не грузится.
// Также трекает SPA-переходы (router subscribe).
import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

const KEY = "eh_cookie_consent";

const GTM_ID = import.meta.env.VITE_GTM_ID as string | undefined;
const GA_ID = import.meta.env.VITE_GA_ID as string | undefined;
const YM_ID = import.meta.env.VITE_YM_ID as string | undefined;
const FB_PIXEL_ID = import.meta.env.VITE_FB_PIXEL_ID as string | undefined;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    ym?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

function injectScript(src: string, async = true) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement("script");
  s.src = src;
  s.async = async;
  document.head.appendChild(s);
}

function loadGTM(id: string) {
  if (document.querySelector(`script[data-gtm="${id}"]`)) return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const s = document.createElement("script");
  s.dataset.gtm = id;
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
  document.head.appendChild(s);
}

function loadGA(id: string) {
  injectScript(`https://www.googletagmanager.com/gtag/js?id=${id}`);
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) { window.dataLayer!.push(args); };
  window.gtag("js", new Date());
  window.gtag("config", id, { anonymize_ip: true, send_page_view: true });
}

function loadYandex(id: string) {
  if (document.querySelector(`script[data-ym="${id}"]`)) return;
  const s = document.createElement("script");
  s.dataset.ym = id;
  s.text = `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
    m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],
    k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
    (window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
    ym(${id},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true,defer:true});`;
  document.head.appendChild(s);
}

function loadFbPixel(id: string) {
  if (window.fbq) return;
  const s = document.createElement("script");
  s.text = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
    n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
    t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window,document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init','${id}'); fbq('track','PageView');`;
  document.head.appendChild(s);
}

function trackPageview(path: string) {
  if (typeof window === "undefined") return;
  // Без согласия — не отправляем pageview ни в один счётчик.
  if (localStorage.getItem(KEY) !== "accept") return;
  // GTM/GA4
  window.dataLayer?.push({ event: "page_view", page_path: path });
  if (GA_ID && window.gtag) window.gtag("event", "page_view", { page_path: path });
  // Яндекс.Метрика
  if (YM_ID && window.ym) window.ym(Number(YM_ID), "hit", path);
  // FB
  if (FB_PIXEL_ID && window.fbq) window.fbq("track", "PageView");
}


export function ScriptInjector() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tryLoad = () => {
      if (localStorage.getItem(KEY) !== "accept") return;
      if (GTM_ID) loadGTM(GTM_ID);
      if (GA_ID) loadGA(GA_ID);
      if (YM_ID) loadYandex(YM_ID);
      if (FB_PIXEL_ID) loadFbPixel(FB_PIXEL_ID);
    };
    tryLoad();
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) tryLoad(); };
    const onConsent = () => tryLoad();
    window.addEventListener("storage", onStorage);
    window.addEventListener("eh:consent-change", onConsent);
    const interval = window.setInterval(tryLoad, 2000);
    window.setTimeout(() => window.clearInterval(interval), 10000);

    // SPA pageview tracking
    const unsub = router.subscribe("onResolved", ({ toLocation }) => {
      trackPageview(toLocation.pathname + (toLocation.searchStr ?? ""));
    });

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("eh:consent-change", onConsent);
      unsub();
    };

  }, [router]);
  return null;
}

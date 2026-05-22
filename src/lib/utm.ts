// UTM parameter capture & persistence (sessionStorage)
// Lovable note: UTMs are captured client-side from the URL on first landing,
// stored for the session, and submitted with any lead form.
export type UTM = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing?: string;
};

const KEY = "eh_utm_v1";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export function captureUtmFromLocation(): UTM | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const has = UTM_KEYS.some((k) => params.get(k));
  if (!has) {
    const existing = readUtm();
    if (existing) return existing;
    // First-touch landing without UTM — still record referrer/landing.
    const fresh: UTM = { referrer: document.referrer || undefined, landing: window.location.pathname };
    try { sessionStorage.setItem(KEY, JSON.stringify(fresh)); } catch {}
    return fresh;
  }
  const utm: UTM = { referrer: document.referrer || undefined, landing: window.location.pathname };
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) (utm as Record<string, string>)[k] = v;
  }
  try { sessionStorage.setItem(KEY, JSON.stringify(utm)); } catch {}
  return utm;
}

export function readUtm(): UTM | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as UTM) : null;
  } catch {
    return null;
  }
}

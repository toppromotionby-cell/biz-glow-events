// UTM-конструктор: собирает корректные ссылки для рекламных кампаний.
// Все значения автоматически нормализуются (lowercase, нижние подчёркивания).
import { useMemo, useState } from "react";
import { toast } from "sonner";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_\-.]/g, "");

const PRESETS = [
  { source: "google", medium: "cpc" },
  { source: "yandex", medium: "cpc" },
  { source: "instagram", medium: "social" },
  { source: "telegram", medium: "social" },
  { source: "facebook", medium: "social" },
  { source: "email", medium: "newsletter" },
];

export function UtmBuilder() {
  const [url, setUrl] = useState("https://event-hub.by/");
  const [source, setSource] = useState("google");
  const [medium, setMedium] = useState("cpc");
  const [campaign, setCampaign] = useState("");
  const [term, setTerm] = useState("");
  const [content, setContent] = useState("");

  const built = useMemo(() => {
    try {
      const u = new URL(url);
      const set = (k: string, v: string) => { const n = norm(v); if (n) u.searchParams.set(k, n); };
      set("utm_source", source);
      set("utm_medium", medium);
      set("utm_campaign", campaign);
      set("utm_term", term);
      set("utm_content", content);
      return u.toString();
    } catch {
      return "";
    }
  }, [url, source, medium, campaign, term, content]);

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <h3 className="font-semibold">UTM-конструктор</h3>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <Field label="URL посадочной" value={url} onChange={setUrl} className="sm:col-span-2" />
        <Field label="utm_source *" value={source} onChange={setSource} />
        <Field label="utm_medium *" value={medium} onChange={setMedium} />
        <Field label="utm_campaign" value={campaign} onChange={setCampaign} placeholder="летний_сезон_2026" />
        <Field label="utm_content" value={content} onChange={setContent} placeholder="banner_top" />
        <Field label="utm_term" value={term} onChange={setTerm} placeholder="event_оборудование" className="sm:col-span-2" />
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button key={p.source}
            type="button"
            onClick={() => { setSource(p.source); setMedium(p.medium); }}
            className="text-xs rounded-full border border-border px-3 py-1 hover:bg-accent/20"
          >{p.source} · {p.medium}</button>
        ))}
      </div>
      <div>
        <label className="text-xs text-muted-foreground" htmlFor="utm-result">Готовая ссылка</label>
        <div className="mt-1 flex gap-2">
          <input id="utm-result" readOnly value={built}
            className="flex-1 rounded-md bg-background/50 border border-border px-3 py-2 text-xs font-mono" />
          <button type="button"
            onClick={() => { navigator.clipboard.writeText(built); toast.success("Скопировано"); }}
            className="rounded-md bg-gradient-primary px-3 py-2 text-xs font-medium text-primary-foreground glow-primary"
          >Копировать</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, className }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded-md bg-background/50 border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
    </label>
  );
}

// Global search dialog (Cmd/Ctrl+K). Server-driven, debounced.
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, Clock, X } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { globalSearch, type SearchHit } from "@/lib/search.functions";
import { CatalogQuickView } from "@/components/CatalogQuickView";
import type { CatalogType } from "@/lib/catalog.functions";

const CATALOG_KINDS: Record<string, CatalogType> = {
  zones: "zones",
  tech_equipment: "tech_equipment",
  services: "services",
  production_items: "production_items",
};

const KIND_LABELS: Record<SearchHit["kind"], string> = {
  zones: "Зоны",
  tech_equipment: "Оборудование",
  services: "Услуги",
  production_items: "Производство",
  cases: "Кейсы",
  blog_posts: "Блог",
};

const KIND_PATHS: Record<SearchHit["kind"], string> = {
  zones: "/zones",
  tech_equipment: "/equipment",
  services: "/services",
  production_items: "/production",
  cases: "/cases",
  blog_posts: "/blog",
};

const RECENT_KEY = "search:recent";
const MAX_RECENT = 5;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch { return []; }
}

function saveRecent(q: string) {
  if (typeof window === "undefined") return;
  const trimmed = q.trim();
  if (!trimmed) return;
  try {
    const cur = loadRecent().filter((x) => x.toLowerCase() !== trimmed.toLowerCase());
    const next = [trimmed, ...cur].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

function clearRecent() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
}

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || /Mac/.test(navigator.userAgent || "");
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-primary/20 text-foreground rounded px-0.5">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function SearchTrigger() {
  const [open, setOpen] = useState(false);
  const [mac, setMac] = useState(false);
  useEffect(() => { setMac(isMac()); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      {/* Mobile: icon-only */}
      <button
        onClick={() => setOpen(true)}
        aria-label={`Поиск (${mac ? "⌘" : "Ctrl"}+K)`}
        title={`Поиск (${mac ? "⌘" : "Ctrl"}+K)`}
        className="md:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-primary/10 transition"
      >
        <Search className="h-5 w-5" aria-hidden="true" />
      </button>
      {/* Desktop: full search bar */}
      <button
        onClick={() => setOpen(true)}
        aria-label={`Поиск (${mac ? "⌘" : "Ctrl"}+K)`}
        title={`Поиск (${mac ? "⌘" : "Ctrl"}+K)`}
        className="hidden md:inline-flex h-9 w-56 lg:w-72 items-center gap-2 rounded-md border border-border/60 bg-background/40 px-3 text-sm text-muted-foreground hover:border-primary/40 hover:bg-primary/5 transition"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left truncate">Поиск по сайту…</span>
        <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border border-border/60 bg-muted/40 px-1.5 font-mono text-[10px] font-medium">
          {mac ? "⌘" : "Ctrl"}K
        </kbd>
      </button>
      <SearchDialog open={open} onOpenChange={setOpen} mac={mac} />
    </>
  );
}

function SearchDialog({ open, onOpenChange, mac }: { open: boolean; onOpenChange: (v: boolean) => void; mac: boolean }) {
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [quick, setQuick] = useState<{ type: CatalogType; slug: string; basePath: string } | null>(null);
  const navigate = useNavigate();
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reload recent and reset state when opened
  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setQ("");
      setQDebounced("");
    }
  }, [open]);

  // Debounce 250ms
  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setQDebounced(q.trim()), 250);
    return () => { if (tRef.current) clearTimeout(tRef.current); };
  }, [q]);

  const queryKey = qDebounced.toLowerCase();
  const enabled = queryKey.length >= 2;

  const { data: hits = [], isFetching, isError } = useQuery({
    queryKey: ["search", queryKey],
    queryFn: () => globalSearch({ data: { q: qDebounced } }),
    enabled,
    staleTime: 30_000,
  });

  const groups = useMemo(() => {
    const g: Partial<Record<SearchHit["kind"], SearchHit[]>> = {};
    for (const h of hits) (g[h.kind] ??= []).push(h);
    return g;
  }, [hits]);

  const go = (h: SearchHit) => {
    saveRecent(qDebounced);
    const catalogType = CATALOG_KINDS[h.kind];
    if (catalogType) {
      // Открываем модалку быстрого просмотра прямо из поиска
      setQuick({ type: catalogType, slug: h.slug, basePath: KIND_PATHS[h.kind] });
      onOpenChange(false);
      setQ("");
      return;
    }
    onOpenChange(false);
    setQ("");
    navigate({ to: `${KIND_PATHS[h.kind]}/${h.slug}` });
  };

  const trimmed = q.trim();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <div className="relative">
        <CommandInput placeholder="Поиск по сайту..." value={q} onValueChange={setQ} />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border/60 bg-muted/40 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          {mac ? "⌘" : "Ctrl"}K
        </kbd>
      </div>
      <CommandList>
        {trimmed.length === 0 && recent.length > 0 && (
          <CommandGroup
            heading={
              <span className="flex items-center justify-between w-full">
                <span>Недавние запросы</span>
                <button
                  type="button"
                  onClick={() => { clearRecent(); setRecent([]); }}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> очистить
                </button>
              </span>
            }
          >
            {recent.map((r) => (
              <CommandItem key={r} value={`recent-${r}`} onSelect={() => setQ(r)}>
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{r}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {trimmed.length === 0 && recent.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">Введите минимум 2 символа</div>
        )}
        {trimmed.length > 0 && trimmed.length < 2 && (
          <div className="py-8 text-center text-sm text-muted-foreground">Введите минимум 2 символа</div>
        )}
        {enabled && isFetching && (
          <div className="py-6 text-center text-sm text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="h-4 w-4 animate-spin" /> Ищем…
          </div>
        )}
        {enabled && !isFetching && isError && (
          <div className="py-6 text-center text-sm text-destructive">Ошибка поиска. Попробуйте ещё раз.</div>
        )}
        {enabled && !isFetching && !isError && hits.length === 0 && (
          <CommandEmpty>Ничего не найдено</CommandEmpty>
        )}
        {(Object.entries(groups) as [SearchHit["kind"], SearchHit[]][]).map(([kind, items]) => (
          <CommandGroup key={kind} heading={KIND_LABELS[kind]}>
            {items.map(h => (
              <CommandItem key={`${h.kind}-${h.id}`} value={`${h.kind}-${h.id}`} onSelect={() => go(h)}>
                {h.image && <img src={h.image} alt="" loading="lazy" className="h-8 w-8 rounded object-cover mr-2 shrink-0" />}
                <div className="min-w-0">
                  <div className="font-medium truncate"><Highlight text={h.title} q={qDebounced} /></div>
                  {h.excerpt && (
                    <div className="text-xs text-muted-foreground truncate">
                      <Highlight text={h.excerpt} q={qDebounced} />
                    </div>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

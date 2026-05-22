// Global search dialog (Cmd/Ctrl+K).
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { globalSearch, type SearchHit } from "@/lib/search.functions";

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

export function SearchTrigger() {
  const [open, setOpen] = useState(false);
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
      <button
        onClick={() => setOpen(true)}
        aria-label="Поиск (Ctrl+K)"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-primary/10 transition"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
      </button>
      <SearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const { data: hits = [] } = useQuery({
    queryKey: ["search", q],
    queryFn: () => globalSearch({ data: { q } }),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  });

  const groups = useMemo(() => {
    const g: Partial<Record<SearchHit["kind"], SearchHit[]>> = {};
    for (const h of hits) (g[h.kind] ??= []).push(h);
    return g;
  }, [hits]);

  const go = (h: SearchHit) => {
    onOpenChange(false);
    setQ("");
    navigate({ to: `${KIND_PATHS[h.kind]}/${h.slug}` });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Поиск по сайту..." value={q} onValueChange={setQ} />
      <CommandList>
        {q.trim().length < 2 && <div className="py-8 text-center text-sm text-muted-foreground">Введите минимум 2 символа</div>}
        {q.trim().length >= 2 && hits.length === 0 && <CommandEmpty>Ничего не найдено</CommandEmpty>}
        {(Object.entries(groups) as [SearchHit["kind"], SearchHit[]][]).map(([kind, items]) => (
          <CommandGroup key={kind} heading={KIND_LABELS[kind]}>
            {items.map(h => (
              <CommandItem key={`${h.kind}-${h.id}`} value={`${h.kind}-${h.id}-${h.title}`} onSelect={() => go(h)}>
                {h.image && <img src={h.image} alt="" className="h-8 w-8 rounded object-cover mr-2 shrink-0" />}
                <div className="min-w-0">
                  <div className="font-medium truncate">{h.title}</div>
                  {h.excerpt && <div className="text-xs text-muted-foreground truncate">{h.excerpt}</div>}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

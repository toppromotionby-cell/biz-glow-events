// Глобальный командный палитр админки (⌘K / Ctrl+K).
// Быстрый поиск по разделам, заказам и карточкам каталога.
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, ShoppingCart, Calendar, Package, FileText,
  Newspaper, UserCog, Trophy, MessageSquareQuote,
  Tag, ToggleRight, Mail, Search, Box,
  type LucideIcon,
} from "lucide-react";

const NAV: { to: string; label: string; icon: LucideIcon; hint?: string }[] = [
  { to: "/admin", label: "Дашборд", icon: LayoutDashboard, hint: "g d" },
  { to: "/admin/orders", label: "Заказы (CRM)", icon: ShoppingCart, hint: "g o" },
  { to: "/admin/calendar", label: "Календарь", icon: Calendar },
  { to: "/admin/catalog/zones", label: "Каталог · Зоны", icon: Package, hint: "g c" },
  { to: "/admin/catalog/tech_equipment", label: "Каталог · Оборудование", icon: Package },
  { to: "/admin/catalog/services", label: "Каталог · Услуги", icon: Package },
  { to: "/admin/catalog/production_items", label: "Каталог · Производство", icon: Package },
  { to: "/admin/catalog/attractions", label: "Каталог · Аттракционы", icon: Package },
  { to: "/admin/cases", label: "Кейсы", icon: Trophy },
  { to: "/admin/testimonials", label: "Отзывы", icon: MessageSquareQuote },
  { to: "/admin/blog", label: "Блог", icon: Newspaper },
  
  { to: "/admin/campaigns", label: "Email-рассылки", icon: Mail },
  { to: "/admin/promo", label: "Промокоды", icon: Tag },
  { to: "/admin/users", label: "Пользователи", icon: UserCog },
  { to: "/admin/sections", label: "Видимость секций", icon: ToggleRight },
  { to: "/admin/audit", label: "Аудит", icon: FileText },
];

const TABLES = ["zones", "tech_equipment", "services", "production_items", "attractions"] as const;
const TABLE_LABEL: Record<(typeof TABLES)[number], string> = {
  zones: "Зоны", tech_equipment: "Оборудование", services: "Услуги", production_items: "Производство", attractions: "Аттракционы",
};

export function AdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  // ⌘K / Ctrl+K, плюс одиночный "/"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !open) {
        const t = e.target as (HTMLElement & { isContentEditable?: boolean }) | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("admin-cmdk-open", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("admin-cmdk-open", onOpenEvent);
    };
  }, [open]);

  // Сбросить запрос при закрытии.
  useEffect(() => { if (!open) setQ(""); }, [open]);

  // Поиск по заказам и каталогу — только когда есть запрос ≥2 символов.
  const term = q.trim();
  const enabled = open && term.length >= 2;

  const { data: orders = [] } = useQuery({
    enabled,
    queryKey: ["cmdk-orders", term],
    staleTime: 15_000,
    queryFn: async () => {
      const like = `%${term}%`;
      const { data } = await supabase
        .from("orders")
        .select("id,client_name,client_email,status,total")
        .or(`client_name.ilike.${like},client_email.ilike.${like},client_phone.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: catalog = [] } = useQuery({
    enabled,
    queryKey: ["cmdk-catalog", term],
    staleTime: 15_000,
    queryFn: async () => {
      const like = `%${term}%`;
      const lists = await Promise.all(
        TABLES.map(async (t) => {
          const { data } = await supabase
            .from(t)
            .select("id,title,slug")
            .or(`title.ilike.${like},slug.ilike.${like}`)
            .limit(5);
          return (data ?? []).map((r) => ({ ...r, table: t }));
        }),
      );
      return lists.flat();
    },
  });

  const navFiltered = useMemo(() => {
    if (!term) return NAV;
    const lo = term.toLowerCase();
    return NAV.filter((n) => n.label.toLowerCase().includes(lo));
  }, [term]);

  const go = (to: string, params?: Record<string, string>) => {
    setOpen(false);
    // navigate signature is typed; loose params from search results
    setTimeout(() => navigate({ to, params } as Parameters<typeof navigate>[0]), 0);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={q}
        onValueChange={setQ}
        placeholder="Поиск разделов, заказов, карточек…  (введите ≥2 символов)"
      />
      <CommandList>
        <CommandEmpty>Ничего не найдено</CommandEmpty>

        {navFiltered.length > 0 && (
          <CommandGroup heading="Разделы">
            {navFiltered.map((n) => {
              const Icon = n.icon;
              return (
                <CommandItem
                  key={n.to}
                  value={`nav ${n.label}`}
                  onSelect={() => go(n.to)}
                >
                  <Icon className="h-4 w-4 mr-2 opacity-70" />
                  <span>{n.label}</span>
                  {n.hint && <span className="ml-auto text-xs text-muted-foreground">{n.hint}</span>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {orders.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Заказы">
              {orders.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`order ${o.client_name} ${o.client_email} ${o.id}`}
                  onSelect={() => go("/admin/orders/$id", { id: o.id })}
                >
                  <ShoppingCart className="h-4 w-4 mr-2 opacity-70" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{o.client_name || "Без имени"}</span>
                    <span className="text-xs text-muted-foreground truncate">{o.client_email} · {o.status}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {catalog.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Каталог">
              {catalog.map((c) => (
                <CommandItem
                  key={`${c.table}-${c.id}`}
                  value={`cat ${c.title} ${c.slug}`}
                  onSelect={() => go("/admin/catalog/$type", { type: c.table })}
                >
                  <Box className="h-4 w-4 mr-2 opacity-70" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{c.title}</span>
                    <span className="text-xs text-muted-foreground truncate">{TABLE_LABEL[c.table as keyof typeof TABLE_LABEL]} · {c.slug}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {!term && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Подсказки">
              <CommandItem disabled value="hint-1">
                <Search className="h-4 w-4 mr-2 opacity-70" />
                <span>Введите ≥2 символов для поиска по заказам и каталогу</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

// Кнопка-триггер для шапки. Открывает палитру через CustomEvent.
export function CommandPaletteTrigger() {
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("admin-cmdk-open"))}
      aria-label="Открыть командный палитр (Ctrl+K)"
      className="hidden sm:inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-border/60 bg-muted/30 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Поиск…</span>
      <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-mono rounded bg-background/60 border border-border/50">
        {isMac ? "⌘K" : "Ctrl+K"}
      </kbd>
    </button>
  );
}

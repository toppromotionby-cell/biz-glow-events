// Единые элементы навигации по каталогу: мега-меню в шапке, карточки на /catalog,
// список в футере и мобильном меню. Данные — из getCatalogNavigation().
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Cpu, Music, Lightbulb, Package, FerrisWheel, ArrowRight, Sparkles } from "lucide-react";
import { getCatalogNavigation, type CatalogNavSection } from "@/lib/catalog-nav.functions";

export const catalogNavQueryOptions = queryOptions({
  queryKey: ["catalog-nav"],
  queryFn: () => getCatalogNavigation(),
  staleTime: 5 * 60_000,
});

/** Фолбэк на случай ошибки БД — навигация никогда не должна исчезать. */
export const FALLBACK_NAV: CatalogNavSection[] = [
  { key: "zones", kind: "native", slug: null, title: "Интерактивные зоны", description: "", icon: "Cpu", basePath: "/zones", count: 0, categories: [] },
  { key: "tech_equipment", kind: "native", slug: null, title: "Техническое оснащение", description: "", icon: "Music", basePath: "/equipment", count: 0, categories: [] },
  { key: "services", kind: "native", slug: null, title: "Услуги", description: "", icon: "Lightbulb", basePath: "/services", count: 0, categories: [] },
  { key: "production_items", kind: "native", slug: null, title: "Производство", description: "", icon: "Package", basePath: "/production", count: 0, categories: [] },
  { key: "attractions", kind: "native", slug: null, title: "Аттракционы", description: "", icon: "Ferris", basePath: "/attractions", count: 0, categories: [] },
];

const ICONS = {
  Cpu,
  Music,
  Lightbulb,
  Package,
  Ferris: FerrisWheel,
  FerrisWheel,
  Sparkles,
} as const;

/**
 * Пропсы ссылки на раздел: базовые разделы ведут на свой путь,
 * свои (виртуальные) — на витрину /catalog/$slug.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sectionLink(section: CatalogNavSection, category?: string): any {
  const search = category ? { search: { category } } : {};
  if (section.kind === "virtual" && section.slug) {
    return { to: "/catalog/$slug", params: { slug: section.slug }, ...search };
  }
  return { to: section.basePath, ...search };
}

export function sectionIcon(name: string) {
  return ICONS[name as keyof typeof ICONS] ?? Sparkles;
}

const GRADIENTS = [
  "from-primary to-primary-glow",
  "from-accent to-accent-glow",
  "from-primary to-accent",
  "from-accent to-primary",
  "from-primary-glow to-accent",
];

export function sectionGradient(index: number) {
  return GRADIENTS[index % GRADIENTS.length];
}

/** Хук навигации: данные из БД, с фолбэком на статичный список. */
export function useCatalogNav(): CatalogNavSection[] {
  const { data } = useQuery(catalogNavQueryOptions);
  return data && data.length ? data : FALLBACK_NAV;
}

/** Чип направления — единый стиль во всех местах. */
export function CategoryChip({
  section,
  name,
  count,
  onNavigate,
}: {
  section: CatalogNavSection;
  name: string;
  count?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      {...sectionLink(section, name)}
      onClick={onNavigate}
      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition"
    >
      {name}
      {typeof count === "number" && count > 0 && (
        <span className="text-[10px] opacity-60">{count}</span>
      )}
    </Link>
  );
}

/**
 * Компактная карточка-ссылка раздела: используется в модалке выбора каталога
 * и в блоке «Направления» на главной. Единый стиль с /catalog.
 */
export function CatalogSectionTile({
  section,
  index,
  onNavigate,
}: {
  section: CatalogNavSection;
  index: number;
  onNavigate?: () => void;
}) {
  const Icon = sectionIcon(section.icon);
  return (
    <Link
      {...sectionLink(section)}
      onClick={onNavigate}
      className="group glass rounded-xl p-4 flex h-full flex-col gap-3 hover:border-primary/50 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${sectionGradient(index)} group-hover:glow-primary transition`}>
          <Icon className="h-5 w-5 text-primary-foreground" />
        </span>
        <span className="min-w-0 flex-1 font-semibold leading-snug text-balance group-hover:text-primary transition">
          {section.title}
        </span>
      </div>
      {section.description && (
        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2 text-pretty">{section.description}</p>
      )}
      <span className="mt-auto inline-flex items-center text-xs font-medium text-primary">
        Перейти
        {section.count > 0 && <span className="ml-1 text-muted-foreground">({section.count})</span>}
        <ArrowRight className="ml-1 h-3 w-3" />
      </span>
    </Link>
  );
}

/** Карточка раздела для страницы /catalog. */
export function CatalogSectionCard({ section, index }: { section: CatalogNavSection; index: number }) {
  const Icon = sectionIcon(section.icon);
  return (
    <div className="group relative glass rounded-xl px-4 py-5 sm:p-6 hover:border-primary/50 transition-all duration-200 h-full flex flex-col">
      <div className="flex gap-4">
        <div className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${sectionGradient(index)} group-hover:glow-primary transition`}>
          <Icon className="h-6 w-6 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <Link {...sectionLink(section)} className="font-semibold text-lg leading-snug text-balance hover:text-primary transition">
            {section.title}
          </Link>
          {section.description && (
            <p className="text-sm leading-relaxed text-muted-foreground mt-1.5 text-pretty">{section.description}</p>
          )}
        </div>
      </div>

      {section.categories.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {section.categories.slice(0, 8).map((c) => (
            <CategoryChip key={c.id} section={section} name={c.name} count={c.count} />
          ))}
        </div>
      )}

      <Link {...sectionLink(section)} className="mt-4 inline-flex items-center text-sm text-primary font-medium">
        Перейти в раздел
        {section.count > 0 && <span className="ml-1 text-muted-foreground">({section.count})</span>}
        <ArrowRight className="ml-1 h-3 w-3" />
      </Link>
    </div>
  );
}

/** Мега-меню «Каталог» для десктопной шапки — только основные разделы. */
export function CatalogMegaMenu({ onNavigate }: { onNavigate?: () => void }) {
  const sections = useCatalogNav();
  return (
    <div className="grid-tiles">
      {sections.map((section, i) => (
        <CatalogSectionTile key={section.key} section={section} index={i} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

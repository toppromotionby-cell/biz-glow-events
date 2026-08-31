// Фильтры библиотеки блоками: разделы, категории, быстрые чипы, жанры, BPM, Camelot.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Filter, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CamelotWheel } from "@/components/dj/CamelotWheel";
import { djCategories } from "@/lib/dj/dj.functions";
import { AUDIO_SECTIONS, SECTION_LABEL } from "@/lib/dj/sections";
import {
  GENRES, LANGUAGES, TRACK_SORTS, TRACK_VERSION_LABEL, type DjTrackFilters, type TrackVersion,
} from "@/lib/dj/types";

const ANY = "__any__";

const BPM_PRESETS: { label: string; min: number; max: number }[] = [
  { label: "90–100", min: 90, max: 100 },
  { label: "100–110", min: 100, max: 110 },
  { label: "120–128", min: 120, max: 128 },
  { label: "128–140", min: 128, max: 140 },
];

const QUICK_VERSIONS: TrackVersion[] = ["extended", "clean", "intro", "acapella", "instrumental", "mashup"];

export function useDjCategories() {
  return useQuery({
    queryKey: ["dj", "categories"],
    queryFn: () => djCategories(),
    staleTime: 5 * 60_000,
  });
}

function Chip({
  active, onClick, children, className,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? "border-transparent bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-glow"
          : "border-border/70 bg-muted/40 text-muted-foreground hover:border-primary/50 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TrackFilters({
  value, onChange, showFavorites = true,
}: {
  value: DjTrackFilters;
  onChange: (next: DjTrackFilters) => void;
  showFavorites?: boolean;
}) {
  const { data } = useDjCategories();
  const set = (patch: Partial<DjTrackFilters>) => onChange({ ...value, ...patch, page: 1 });

  const categories = useMemo(
    () => (data?.categories ?? []).filter((c) => !value.section || c.section === value.section),
    [data, value.section],
  );

  const genres = value.genres ?? [];
  const toggleGenre = (g: string) =>
    set({ genres: genres.includes(g) ? genres.filter((x) => x !== g) : [...genres, g], genre: undefined });

  const bpm: [number, number] = [value.bpmMin ?? 60, value.bpmMax ?? 200];

  const activeChips: { label: string; clear: () => void }[] = [];
  if (value.section) activeChips.push({ label: SECTION_LABEL[value.section] ?? value.section, clear: () => set({ section: undefined, categoryId: undefined }) });
  if (value.categoryId) {
    const c = data?.categories.find((x) => x.id === value.categoryId);
    activeChips.push({ label: c?.name ?? "Категория", clear: () => set({ categoryId: undefined }) });
  }
  for (const g of genres) activeChips.push({ label: g, clear: () => toggleGenre(g) });
  if (value.version) activeChips.push({ label: TRACK_VERSION_LABEL[value.version as TrackVersion] ?? value.version, clear: () => set({ version: undefined }) });
  if (value.key) activeChips.push({ label: `Key ${value.key}`, clear: () => set({ key: undefined }) });
  if (value.language) activeChips.push({ label: value.language, clear: () => set({ language: undefined }) });
  if (value.freshDays) activeChips.push({ label: "Новинки 7 дней", clear: () => set({ freshDays: undefined }) });
  if (value.favoritesOnly) activeChips.push({ label: "Избранное", clear: () => set({ favoritesOnly: undefined }) });
  if (value.bpmMin || value.bpmMax) activeChips.push({ label: `${bpm[0]}–${bpm[1]} BPM`, clear: () => set({ bpmMin: undefined, bpmMax: undefined }) });

  const reset = () =>
    onChange({ sort: value.sort, page: 1, pageSize: value.pageSize });

  const detailed = (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Жанры</h3>
        <div className="flex flex-wrap gap-1.5">
          {GENRES.map((g) => (
            <Chip key={g} active={genres.includes(g)} onClick={() => toggleGenre(g)}>{g}</Chip>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Темп, BPM</h3>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {BPM_PRESETS.map((p) => (
            <Chip
              key={p.label}
              active={value.bpmMin === p.min && value.bpmMax === p.max}
              onClick={() =>
                set(value.bpmMin === p.min && value.bpmMax === p.max
                  ? { bpmMin: undefined, bpmMax: undefined }
                  : { bpmMin: p.min, bpmMax: p.max })
              }
            >
              {p.label}
            </Chip>
          ))}
        </div>
        <Slider
          value={bpm}
          min={60}
          max={200}
          step={1}
          onValueChange={([a, b]) => set({ bpmMin: a, bpmMax: b })}
          aria-label="Диапазон BPM"
        />
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number" min={60} max={200} value={bpm[0]}
            onChange={(e) => set({ bpmMin: Number(e.target.value) || undefined })}
            className="h-8 w-20 text-xs" aria-label="BPM от"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <Input
            type="number" min={60} max={200} value={bpm[1]}
            onChange={(e) => set({ bpmMax: Number(e.target.value) || undefined })}
            className="h-8 w-20 text-xs" aria-label="BPM до"
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Тональность</h3>
        <CamelotWheel value={value.key} onChange={(k) => set({ key: k })} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Язык</h3>
          <Select value={value.language ?? ANY} onValueChange={(v) => set({ language: v === ANY ? undefined : v })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Любой" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Любой</SelectItem>
              {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Сортировка</h3>
          <Select value={value.sort ?? "new"} onValueChange={(v) => set({ sort: v as DjTrackFilters["sort"] })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRACK_SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </section>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Разделы */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Chip active={!value.section} onClick={() => set({ section: undefined, categoryId: undefined })}>Все</Chip>
        {AUDIO_SECTIONS.map((s) => (
          <Chip
            key={s.key}
            active={value.section === s.key}
            onClick={() => set({ section: value.section === s.key ? undefined : s.key, categoryId: undefined })}
            className="whitespace-nowrap"
          >
            {s.short}
            {data?.sectionCounts[s.key] ? (
              <span className="ml-1.5 opacity-70 tabular-nums">{data.sectionCounts[s.key]}</span>
            ) : null}
          </Chip>
        ))}
      </div>

      {/* Подкатегории выбранного раздела */}
      {value.section && categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={value.categoryId === c.id}
              onClick={() => set({ categoryId: value.categoryId === c.id ? undefined : c.id })}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      {/* Поиск + быстрые чипы + кнопка детальных фильтров */}
      <div className="glass rounded-2xl p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={value.q ?? ""}
              onChange={(e) => set({ q: e.target.value || undefined })}
              placeholder="Артист, трек, тег…"
              className="h-10 pl-9"
              aria-label="Поиск по библиотеке"
            />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-10 shrink-0">
                <SlidersHorizontal className="mr-2 h-4 w-4" /> Фильтры
                {activeChips.length > 0 && (
                  <span className="ml-2 rounded-full bg-primary px-1.5 text-[0.65rem] font-bold text-primary-foreground">
                    {activeChips.length}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2"><Filter className="h-4 w-4" /> Подбор трека</SheetTitle>
              </SheetHeader>
              <div className="mt-4">{detailed}</div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip active={value.freshDays === 7} onClick={() => set({ freshDays: value.freshDays === 7 ? undefined : 7 })}>
            Новинки 7 дней
          </Chip>
          <Chip active={value.sort === "rating"} onClick={() => set({ sort: value.sort === "rating" ? "new" : "rating" })}>
            Высокий рейтинг
          </Chip>
          <Chip active={value.sort === "popular"} onClick={() => set({ sort: value.sort === "popular" ? "new" : "popular" })}>
            Топ загрузок
          </Chip>
          {showFavorites && (
            <Chip active={!!value.favoritesOnly} onClick={() => set({ favoritesOnly: value.favoritesOnly ? undefined : true })}>
              Избранное
            </Chip>
          )}
          {QUICK_VERSIONS.map((v) => (
            <Chip key={v} active={value.version === v} onClick={() => set({ version: value.version === v ? undefined : v })}>
              {TRACK_VERSION_LABEL[v]}
            </Chip>
          ))}
        </div>

        {activeChips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
            {activeChips.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={c.clear}
                className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[0.7rem] font-medium text-primary hover:bg-primary/25"
              >
                {c.label} <X className="h-3 w-3" />
              </button>
            ))}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reset}>Сбросить всё</Button>
          </div>
        )}
      </div>
    </div>
  );
}

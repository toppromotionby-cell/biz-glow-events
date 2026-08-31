// Панель фильтров библиотеки треков.
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CAMELOT_KEYS, GENRES, LANGUAGES, TRACK_SORTS, TRACK_VERSIONS, TRACK_VERSION_LABEL,
  type DjTrackFilters,
} from "@/lib/dj/types";

const ANY = "__any__";

export function TrackFilters({
  value, onChange, showFavorites = true,
}: {
  value: DjTrackFilters;
  onChange: (next: DjTrackFilters) => void;
  showFavorites?: boolean;
}) {
  const set = (patch: Partial<DjTrackFilters>) => onChange({ ...value, ...patch, page: 1 });
  const pick = (key: keyof DjTrackFilters) => (v: string) =>
    set({ [key]: v === ANY ? undefined : v } as Partial<DjTrackFilters>);

  const active =
    Number(!!value.q) + Number(!!value.genre) + Number(!!value.version) + Number(!!value.language) +
    Number(!!value.key) + Number(!!value.bpmMin) + Number(!!value.bpmMax) + Number(!!value.freshDays) +
    Number(!!value.favoritesOnly);

  return (
    <div className="glass rounded-2xl p-4 space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.q ?? ""}
          onChange={(e) => set({ q: e.target.value || undefined })}
          placeholder="Артист, трек, тег…"
          className="pl-9"
          aria-label="Поиск по библиотеке"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Жанр">
          <Select value={value.genre ?? ANY} onValueChange={pick("genre")}>
            <SelectTrigger><SelectValue placeholder="Любой" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ANY}>Любой</SelectItem>
              {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Версия">
          <Select value={value.version ?? ANY} onValueChange={pick("version")}>
            <SelectTrigger><SelectValue placeholder="Любая" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ANY}>Любая</SelectItem>
              {TRACK_VERSIONS.map((v) => <SelectItem key={v} value={v}>{TRACK_VERSION_LABEL[v]}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Тональность (Camelot)">
          <Select value={value.key ?? ANY} onValueChange={pick("key")}>
            <SelectTrigger><SelectValue placeholder="Любая" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value={ANY}>Любая</SelectItem>
              {CAMELOT_KEYS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Язык">
          <Select value={value.language ?? ANY} onValueChange={pick("language")}>
            <SelectTrigger><SelectValue placeholder="Любой" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Любой</SelectItem>
              {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="BPM от">
          <Input
            type="number" min={40} max={300} inputMode="numeric"
            value={value.bpmMin ?? ""}
            onChange={(e) => set({ bpmMin: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label="BPM до">
          <Input
            type="number" min={40} max={300} inputMode="numeric"
            value={value.bpmMax ?? ""}
            onChange={(e) => set({ bpmMax: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>

        <Field label="Новинки">
          <Select value={value.freshDays ? String(value.freshDays) : ANY} onValueChange={(v) => set({ freshDays: v === ANY ? undefined : Number(v) })}>
            <SelectTrigger><SelectValue placeholder="Все" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Все</SelectItem>
              <SelectItem value="7">За неделю</SelectItem>
              <SelectItem value="30">За месяц</SelectItem>
              <SelectItem value="90">За 3 месяца</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Сортировка">
          <Select value={value.sort ?? "new"} onValueChange={(v) => set({ sort: v as DjTrackFilters["sort"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRACK_SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showFavorites && (
          <Button
            type="button"
            size="sm"
            variant={value.favoritesOnly ? "default" : "outline"}
            onClick={() => set({ favoritesOnly: value.favoritesOnly ? undefined : true })}
          >
            Только избранное
          </Button>
        )}
        {active > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ sort: value.sort, pageSize: value.pageSize, page: 1 })}>
            <X className="mr-1 h-4 w-4" /> Сбросить фильтры ({active})
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

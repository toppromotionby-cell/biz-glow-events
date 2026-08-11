// Вставка готового текста из базы знаний документов (примечания, футеры, условия).
import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDocSuggest, type TextHit } from "@/hooks/use-doc-suggest";

type Kind = "note" | "footer" | "section" | "venue" | "event_format" | "term";

export function TextSnippetMenu({
  kind = "note",
  onPick,
  label = "Из базы знаний",
}: {
  kind?: Kind;
  onPick: (value: string) => void;
  label?: string;
}) {
  const { fetchTexts } = useDocSuggest();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<TextHit[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async (t: string) => {
    setLoading(true);
    setHits(await fetchTexts(kind, t));
    setLoading(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => { setOpen(v); if (v) void load(term); }}
    >
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
          <BookOpen className="mr-1 h-3.5 w-3.5" />{label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-2">
        <Input
          value={term}
          onChange={(e) => { setTerm(e.target.value); void load(e.target.value); }}
          placeholder="Поиск по текстам"
          className="mb-2 h-8"
        />
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {loading && <p className="p-2 text-xs text-muted-foreground">Загрузка…</p>}
          {!loading && hits.length === 0 && (
            <p className="p-2 text-xs text-muted-foreground">Пока нет сохранённых текстов.</p>
          )}
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
              onClick={() => { onPick(h.value); setOpen(false); }}
            >
              {h.value.length > 220 ? `${h.value.slice(0, 220)}…` : h.value}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

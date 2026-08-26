// Сборка презентации из КП: сценарий слайдов с превью до создания.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Image as ImageIcon, Layers, Loader2, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { TEMPLATE_LABELS, type PresentationTemplate } from "@/lib/presentations/model";
import { DEFAULT_STORYBOARD_OPTIONS, type StoryboardOptions } from "@/lib/presentations/from-quote";
import { createPresentationFromQuote, planPresentationFromQuote } from "@/lib/presentations.functions";

const BLOCKS: Array<{ key: keyof StoryboardOptions; label: string; hint: string }> = [
  { key: "cover", label: "Обложка", hint: "тема, клиент, дата, площадка" },
  { key: "about", label: "О нас", hint: "вступление из КП" },
  { key: "sections", label: "Разделители разделов", hint: "если разделов больше одного" },
  { key: "extras", label: "Слайд «Дополнительно»", hint: "позиции без фото и описания" },
  { key: "terms", label: "Условия работы", hint: "текст условий из КП" },
  { key: "budget", label: "Бюджет", hint: "итоги, начисления, предоплата" },
  { key: "contacts", label: "Контакты", hint: "финальный слайд" },
  { key: "prices", label: "Показывать цены", hint: "на слайдах позиций" },
];

const TYPE_LABELS: Record<string, string> = {
  title: "Обложка",
  section: "Раздел",
  product: "Позиция",
  text: "Текст",
  contacts: "Контакты",
};

export function QuoteStoryboardDialog({
  open,
  onOpenChange,
  quoteId,
  defaultTitle,
  companyId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quoteId: string;
  defaultTitle: string;
  companyId: string | null;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [template, setTemplate] = useState<PresentationTemplate>("light");
  const [opts, setOpts] = useState<StoryboardOptions>(DEFAULT_STORYBOARD_OPTIONS);
  const [excluded, setExcluded] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setOpts(DEFAULT_STORYBOARD_OPTIONS);
    setExcluded([]);
  }, [open, defaultTitle]);

  const planFn = useServerFn(planPresentationFromQuote);
  const allItemsQuery = useQuery({
    queryKey: ["quote-storyboard-items", quoteId],
    queryFn: () => planFn({ data: { quoteId, options: {} } }),
    enabled: open && !!quoteId,
  });
  const allItems = allItemsQuery.data?.items ?? [];

  const itemIds = useMemo(
    () => allItems.filter((i) => !excluded.includes(i.id)).map((i) => i.id),
    [allItems, excluded],
  );

  const effectiveOptions = useMemo(
    () => ({ ...opts, itemIds: excluded.length ? itemIds : [] }),
    [opts, excluded.length, itemIds],
  );

  const planQuery = useQuery({
    queryKey: ["quote-storyboard-plan", quoteId, effectiveOptions],
    queryFn: () => planFn({ data: { quoteId, options: effectiveOptions } }),
    enabled: open && !!quoteId,
  });
  const steps = planQuery.data?.steps ?? [];

  const createFn = useServerFn(createPresentationFromQuote);
  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          quoteId,
          title: title.trim() || defaultTitle,
          companyId,
          template,
          options: effectiveOptions,
        },
      }),
    onSuccess: (r) => {
      toast.success(`Презентация создана · ${r.slides} слайдов`);
      onOpenChange(false);
      onCreated(r.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (key: keyof StoryboardOptions) =>
    setOpts((o) => ({ ...o, [key]: !o[key as "cover"] }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />Собрать презентацию из КП
          </DialogTitle>
          <DialogDescription>
            Слайды соберутся автоматически: обложка, разделы, позиции с фото из каталога, бюджет и контакты.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="story-title">Название</Label>
              <Input id="story-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Оформление</Label>
              <Select value={template} onValueChange={(v) => setTemplate(v as PresentationTemplate)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TEMPLATE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              {BLOCKS.map((b) => (
                <div key={b.key} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm">{b.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{b.hint}</div>
                  </div>
                  <Switch checked={Boolean(opts[b.key])} onCheckedChange={() => toggle(b.key)} />
                </div>
              ))}
            </div>

            {allItems.length > 0 && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="text-sm font-medium">Позиции ({allItems.length - excluded.length}/{allItems.length})</div>
                <ScrollArea className="max-h-40 pr-2">
                  <div className="space-y-1.5">
                    {allItems.map((i) => (
                      <label key={i.id} className="flex items-start gap-2 text-sm">
                        <Checkbox
                          checked={!excluded.includes(i.id)}
                          onCheckedChange={(v) =>
                            setExcluded((prev) => (v ? prev.filter((x) => x !== i.id) : [...prev, i.id]))
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{i.title || "Без названия"}</span>
                          <span className="text-xs text-muted-foreground">
                            {i.section || "Без раздела"} · {i.photos ? `${i.photos} фото` : "нет фото"}
                            {!i.feature && " · уйдёт в «Дополнительно»"}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Layers className="h-4 w-4" />Сценарий · {steps.length} слайдов
              {planQuery.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <ScrollArea className="h-[340px] pr-2">
              <ol className="space-y-1.5">
                {steps.map((s, i) => (
                  <li key={s.key} className="flex items-start gap-2 rounded-md bg-background p-2 text-sm">
                    <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.title}</span>
                      <span className="text-xs text-muted-foreground">{s.subtitle || s.note}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {s.image_url && <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />}
                      <Badge variant="secondary" className="text-[10px]">{TYPE_LABELS[s.type] ?? s.type}</Badge>
                    </span>
                  </li>
                ))}
                {!steps.length && !planQuery.isFetching && (
                  <li className="p-2 text-sm text-muted-foreground">Нет слайдов — включите хотя бы один блок.</li>
                )}
              </ol>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !steps.length}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Создать презентацию
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

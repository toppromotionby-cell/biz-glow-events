// Диалог создания презентации: с нуля или автоматически из позиций КП.
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSignature, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CompanySelect } from "@/components/admin/documents/CompanySelect";
import { TEMPLATE_LABELS, type PresentationTemplate } from "@/lib/presentations/model";
import {
  createPresentation, createPresentationFromTemplate, listQuotesForPresentation,
  suggestTemplateForQuote,
} from "@/lib/presentations.functions";
import { Switch } from "@/components/ui/switch";

export function CreatePresentationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [mode, setMode] = useState<"blank" | "quote">("blank");
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [template, setTemplate] = useState<PresentationTemplate>("light");
  const [quoteId, setQuoteId] = useState<string>("");
  // Автоподбор структуры по данным КП (шаблон + вариант оформления).
  const [useAuto, setUseAuto] = useState(true);

  useEffect(() => {
    if (!open) return;
    setMode("blank");
    setTitle("");
    setQuoteId("");
  }, [open]);

  const quotesFn = useServerFn(listQuotesForPresentation);
  const { data: quotes } = useQuery({
    queryKey: ["presentation-quote-options", companyId],
    queryFn: () => quotesFn({ data: { companyId } }),
    enabled: open,
  });

  const suggestFn = useServerFn(suggestTemplateForQuote);
  const suggestion = useQuery({
    queryKey: ["presentation-template-suggestion", quoteId],
    queryFn: () => suggestFn({ data: { quoteId } }),
    enabled: open && mode === "quote" && !!quoteId,
  });

  const fromTemplateFn = useServerFn(createPresentationFromTemplate);
  const createFn = useServerFn(createPresentation);
  const create = useMutation({
    mutationFn: () => {
      const pick = suggestion.data;
      if (mode === "quote" && quoteId && useAuto && pick) {
        return fromTemplateFn({
          data: {
            templateId: pick.templateId,
            title: title.trim() || autoTitle(),
            companyId,
            quoteId,
            photoRich: pick.photoRich,
          },
        });
      }
      return createFn({
        data: {
          title: title.trim() || (mode === "quote" ? autoTitle() : "Новая презентация"),
          companyId,
          template,
          quoteId: mode === "quote" && quoteId ? quoteId : null,
        },
      });
    },
    onSuccess: (r) => { onOpenChange(false); onCreated(r.id); },
    onError: (e: Error) => toast.error(e.message),
  });

  function autoTitle(): string {
    const q = (quotes ?? []).find((x) => x.id === quoteId);
    return q ? `Презентация — ${q.client || q.title || q.number}` : "Презентация по КП";
  }

  const canSubmit = mode === "blank" || !!quoteId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Новая презентация</DialogTitle>
          <DialogDescription>
            Создайте пустую презентацию или соберите слайды автоматически по позициям КП.
          </DialogDescription>
        </DialogHeader>

        <div className="grid-fields">
          <ModeCard
            active={mode === "blank"}
            icon={<Sparkles className="h-4 w-4" />}
            title="С нуля"
            hint="Титул + контакты"
            onClick={() => setMode("blank")}
          />
          <ModeCard
            active={mode === "quote"}
            icon={<FileSignature className="h-4 w-4" />}
            title="Из КП"
            hint="Слайд на каждую позицию"
            onClick={() => setMode("quote")}
          />
        </div>

        <div className="space-y-3">
          {mode === "quote" && (
            <div className="space-y-1.5">
              <Label>Коммерческое предложение</Label>
              <Select value={quoteId} onValueChange={setQuoteId}>
                <SelectTrigger><SelectValue placeholder="Выберите КП" /></SelectTrigger>
                <SelectContent>
                  {(quotes ?? []).map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.number} · {q.client || q.title || "без названия"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {mode === "quote" && quoteId && suggestion.data && (
            <div className="space-y-1.5 rounded-lg border border-border/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Рекомендуем: {suggestion.data.templateName}</p>
                <Switch checked={useAuto} onCheckedChange={setUseAuto} aria-label="Использовать автоподбор" />
              </div>
              <p className="text-xs text-muted-foreground">
                {suggestion.data.reasons.join(" · ") || "Структура подобрана по составу КП"}
              </p>
              <p className="text-xs text-muted-foreground">
                {suggestion.data.blueprint.length} слайдов в правильном порядке
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Название</Label>
            <Input
              value={title}
              placeholder={mode === "quote" ? autoTitle() : "Например: Оборудование для корпоратива"}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <CompanySelect value={companyId} onChange={(id) => setCompanyId(id)} label="Компания (от кого презентация)" />

          <div className="space-y-1.5">
            <Label>Оформление</Label>
            <Select value={template} onValueChange={(v) => setTemplate(v as PresentationTemplate)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TEMPLATE_LABELS) as PresentationTemplate[]).map((t) => (
                  <SelectItem key={t} value={t}>{TEMPLATE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Создаём…" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeCard({
  active, icon, title, hint, onClick,
}: { active: boolean; icon: React.ReactNode; title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition-colors ${
        active ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
      }`}
    >
      <div className="flex items-center gap-2 font-medium">{icon}{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </button>
  );
}

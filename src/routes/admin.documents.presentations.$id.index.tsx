// Редактор презентации: миниатюры слева, крупный слайд по центру,
// настройки справа. Плюс вкладки «Презентация» и «Сверка с КП».
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronDown, ChevronUp, Copy, Download, FileDown, Loader2, Plus, Save, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusPill } from "@/components/admin/StatusPill";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useDocumentViewer } from "@/hooks/use-document-viewer";
import { CompanySelect, useCompanyProfiles } from "@/components/admin/documents/CompanySelect";
import { SlideCanvas } from "@/components/admin/presentations/SlideCanvas";
import { SlideSettingsPanel } from "@/components/admin/presentations/SlideSettingsPanel";
import { PresentationCheckPanel } from "@/components/admin/presentations/PresentationCheckPanel";
import { checkAgainstQuote, type QuoteItemLite } from "@/lib/presentations/check";
import {
  SLIDE_TYPE_LABELS, STATUS_LABELS, TEMPLATE_LABELS, blankSlide,
  type Presentation, type PresentationSlide, type PresentationStatus,
  type PresentationTemplate, type SlideType,
} from "@/lib/presentations/model";
import {
  getPresentation, savePresentation, buildSlidesFromQuote,
} from "@/lib/presentations.functions";
import { exportPresentationPptx } from "@/lib/presentations/pptx.browser";

export const Route = createFileRoute("/admin/documents/presentations/$id/")({ component: Page });

function Page() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const viewer = useDocumentViewer();
  const { confirm, dialog } = useConfirm();

  const getFn = useServerFn(getPresentation);
  const { data, isLoading } = useQuery({
    queryKey: ["presentation", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [meta, setMeta] = useState<Presentation | null>(null);
  const [slides, setSlides] = useState<PresentationSlide[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasWrap = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(720);

  useEffect(() => {
    if (!data) return;
    setMeta(data.presentation);
    setSlides(data.slides);
    setSelected((prev) => prev ?? data.slides[0]?.id ?? null);
    setDirty(false);
  }, [data]);

  useEffect(() => {
    const el = canvasWrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCanvasWidth(el.clientWidth));
    ro.observe(el);
    setCanvasWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [isLoading]);

  const { data: companies } = useCompanyProfiles();
  const company = useMemo(
    () =>
      (companies ?? []).find((c) => c.id === meta?.company_id) ??
      (companies ?? []).find((c) => c.is_default) ??
      null,
    [companies, meta?.company_id],
  );

  const current = slides.find((s) => s.id === selected) ?? null;

  const patchSlide = (sid: string, patch: Partial<PresentationSlide>) => {
    setSlides((prev) => prev.map((s) => (s.id === sid ? { ...s, ...patch } : s)));
    setDirty(true);
  };
  const patchMeta = (patch: Partial<Presentation>) => {
    setMeta((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const addSlide = (type: SlideType) => {
    const next = blankSlide(type, slides.length);
    setSlides((prev) => [...prev, next]);
    setSelected(next.id);
    setDirty(true);
  };

  const duplicateSlide = (sid: string) => {
    const src = slides.find((s) => s.id === sid);
    if (!src) return;
    const copy: PresentationSlide = {
      ...src,
      ...blankSlide(src.type, 0),
      title: src.title,
      subtitle: src.subtitle,
      image_url: src.image_url,
      content: { ...src.content, includes: [...src.content.includes], specs: [...src.content.specs] },
      quote_item_id: null,
    };
    const i = slides.findIndex((s) => s.id === sid);
    setSlides((prev) => [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)]);
    setSelected(copy.id);
    setDirty(true);
  };

  const removeSlide = (sid: string) => {
    setSlides((prev) => prev.filter((s) => s.id !== sid));
    setSelected((prev) => (prev === sid ? null : prev));
    setDirty(true);
  };

  const move = (sid: string, dir: -1 | 1) => {
    setSlides((prev) => {
      const i = prev.findIndex((s) => s.id === sid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.splice(j, 0, item);
      return next;
    });
    setDirty(true);
  };

  const saveFn = useServerFn(savePresentation);
  const save = useMutation({
    mutationFn: async () => {
      if (!meta) throw new Error("Нет данных");
      return saveFn({
        data: {
          id: meta.id,
          title: meta.title,
          status: meta.status,
          template: meta.template,
          companyId: meta.company_id,
          slides: slides.map((s, i) => ({
            id: s.id.startsWith("new-") ? undefined : s.id,
            position: i,
            type: s.type,
            title: s.title,
            subtitle: s.subtitle,
            image_url: s.image_url,
            content: s.content,
            entity_type: s.entity_type,
            entity_id: s.entity_id,
            quote_item_id: s.quote_item_id,
            is_visible: s.is_visible,
          })),
        },
      });
    },
    onSuccess: async () => {
      toast.success("Сохранено");
      setDirty(false);
      await qc.invalidateQueries({ queryKey: ["presentation", id] });
      qc.invalidateQueries({ queryKey: ["presentations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const buildFn = useServerFn(buildSlidesFromQuote);
  const addMissing = useMutation({
    mutationFn: (items: QuoteItemLite[]) =>
      buildFn({ data: { quoteId: data?.quote?.id ?? "", itemIds: items.map((i) => i.id) } }),
    onSuccess: (drafts) => {
      setSlides((prev) => [...prev, ...drafts.map((d, i) => ({ ...d, position: prev.length + i }))]);
      setDirty(true);
      toast.success(`Добавлено слайдов: ${drafts.length}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportPptx = async () => {
    if (!meta) return;
    setExporting(true);
    try {
      await exportPresentationPptx(meta, slides, company);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось собрать PPTX");
    } finally {
      setExporting(false);
    }
  };

  const exportPdf = async () => {
    if (dirty) {
      const ok = await confirm({
        title: "Сначала сохранить?",
        description: "PDF собирается на сервере — несохранённые правки в него не попадут.",
        confirmText: "Сохранить и скачать",
      });
      if (ok) await save.mutateAsync();
    }
    viewer.openDocument(`/admin/documents/presentations/${id}/render?format=pdf`, {
      name: `${meta?.title ?? "Презентация"}.pdf`,
    });
  };

  const check = useMemo(
    () => checkAgainstQuote(slides, data?.quoteItems ?? []),
    [slides, data?.quoteItems],
  );

  if (isLoading || !meta) {
    return <div className="p-8 text-muted-foreground">Загрузка…</div>;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/admin/documents/presentations" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Input
              className="h-9 min-w-[280px] border-transparent bg-transparent px-0 text-lg font-semibold focus-visible:border-border focus-visible:px-2"
              value={meta.title}
              onChange={(e) => patchMeta({ title: e.target.value })}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <StatusPill tone={meta.status === "ready" ? "success" : "muted"}>
                {STATUS_LABELS[meta.status]}
              </StatusPill>
              <span>{slides.length} слайдов</span>
              {data?.quote && (
                <Link
                  to="/admin/documents/quotes/$id"
                  params={{ id: data.quote.id }}
                  className="hover:text-primary"
                >
                  КП {data.quote.number}
                </Link>
              )}
              {dirty && <span className="text-amber-500">есть несохранённые правки</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={exporting} onClick={() => void exportPptx()}>
            {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
            PPTX
          </Button>
          <Button variant="outline" size="sm" onClick={() => void exportPdf()}>
            <Download className="mr-1.5 h-4 w-4" />PDF
          </Button>
          <Button size="sm" disabled={save.isPending || !dirty} onClick={() => save.mutate()}>
            <Save className="mr-1.5 h-4 w-4" />{save.isPending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </header>

      <Tabs defaultValue="slides">
        <TabsList>
          <TabsTrigger value="slides">Слайды</TabsTrigger>
          <TabsTrigger value="settings">Презентация</TabsTrigger>
          <TabsTrigger value="check">
            Сверка с КП
            {data?.quote && check.status !== "synced" && (
              <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="slides" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
            {/* Миниатюры */}
            <div className="space-y-2">
              <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                {slides.map((s, i) => (
                  <div
                    key={s.id}
                    className={`group relative rounded-xl border p-1 transition-colors ${
                      s.id === selected ? "border-primary" : "border-border/60 hover:border-primary/50"
                    } ${s.is_visible ? "" : "opacity-50"}`}
                  >
                    <button type="button" className="block w-full" onClick={() => setSelected(s.id)}>
                      <SlideCanvas
                        slide={s}
                        company={company}
                        template={meta.template}
                        presentationTitle={meta.title}
                        width={176}
                        index={i}
                        total={slides.length}
                      />
                    </button>
                    <div className="mt-1 flex items-center justify-between px-1 pb-0.5 text-[11px] text-muted-foreground">
                      <span>{i + 1}. {SLIDE_TYPE_LABELS[s.type]}</span>
                      <span className="flex opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" title="Выше" onClick={() => move(s.id, -1)}>
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" title="Ниже" onClick={() => move(s.id, 1)}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" title="Дублировать" onClick={() => duplicateSlide(s.id)}>
                          <Copy className="ml-1 h-3.5 w-3.5" />
                        </button>
                        <button type="button" title="Удалить" onClick={() => removeSlide(s.id)}>
                          <Trash2 className="ml-1 h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="mr-1.5 h-4 w-4" />Добавить слайд
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {(Object.keys(SLIDE_TYPE_LABELS) as SlideType[]).map((t) => (
                    <DropdownMenuItem key={t} onClick={() => addSlide(t)}>
                      {SLIDE_TYPE_LABELS[t]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Крупный слайд */}
            <div ref={canvasWrap} className="min-w-0">
              {current ? (
                <div className="rounded-xl border border-border/60 p-3">
                  <SlideCanvas
                    slide={current}
                    company={company}
                    template={meta.template}
                    presentationTitle={meta.title}
                    width={Math.max(320, canvasWidth - 32)}
                    index={slides.findIndex((s) => s.id === current.id)}
                    total={slides.length}
                    onEdit={(patch) => patchSlide(current.id, patch)}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Заголовок и подзаголовок можно править прямо на слайде.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 p-10 text-center text-muted-foreground">
                  Выберите слайд слева
                </div>
              )}
            </div>

            {/* Настройки слайда */}
            <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-border/60 p-4">
              {current ? (
                <SlideSettingsPanel slide={current} onChange={(patch) => patchSlide(current.id, patch)} />
              ) : (
                <div className="text-sm text-muted-foreground">Слайд не выбран</div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="grid max-w-xl gap-4">
            <div className="space-y-1.5">
              <Label>Название</Label>
              <Input value={meta.title} onChange={(e) => patchMeta({ title: e.target.value })} />
            </div>
            <CompanySelect
              value={meta.company_id}
              onChange={(companyId) => patchMeta({ company_id: companyId })}
            />
            <div className="space-y-1.5">
              <Label>Оформление</Label>
              <Select
                value={meta.template}
                onValueChange={(v) => patchMeta({ template: v as PresentationTemplate })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TEMPLATE_LABELS) as PresentationTemplate[]).map((t) => (
                    <SelectItem key={t} value={t}>{TEMPLATE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Статус</Label>
              <Select
                value={meta.status}
                onValueChange={(v) => patchMeta({ status: v as PresentationStatus })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as PresentationStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="check" className="mt-4">
          <PresentationCheckPanel
            check={check}
            hasQuote={!!data?.quote}
            onAddMissing={(items) => addMissing.mutate(items)}
            onSelectSlide={setSelected}
            onRemoveSlide={removeSlide}
          />
        </TabsContent>
      </Tabs>

      {dialog}
    </div>
  );
}

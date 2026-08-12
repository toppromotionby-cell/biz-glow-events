// Редактор презентации: миниатюры, крупный слайд, настройки, сверка с КП.
// Автосохранение, горячие клавиши, защита от потери правок, показ на весь экран.
import { createFileRoute, Link, useNavigate, useBlocker } from "@tanstack/react-router";
import { DocFontSelect } from "@/components/admin/documents/DocFontSelect";
import { PresentationBrandingPanel } from "@/components/admin/presentations/PresentationBrandingPanel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Check, Download, FileDown, Loader2, Play, Plus, RefreshCw, Save,
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
import { useIsMobile } from "@/hooks/use-mobile";
import { CompanySelect, useCompanyProfiles } from "@/components/admin/documents/CompanySelect";
import { SlideCanvas } from "@/components/admin/presentations/SlideCanvas";
import { SlideThumbRail } from "@/components/admin/presentations/SlideThumbRail";
import { SlideSettingsPanel } from "@/components/admin/presentations/SlideSettingsPanel";
import { PresentationCheckPanel } from "@/components/admin/presentations/PresentationCheckPanel";
import { DocStatusBar, type DocCheckLike } from "@/components/admin/documents/DocStatusBar";
import { PresentationFullscreen } from "@/components/admin/presentations/PresentationFullscreen";
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

export const Route = createFileRoute("/admin/documents/presentations/$id/")({
  component: Page,
  errorComponent: ({ error }) => <LoadFailure message={error.message} />,
  notFoundComponent: () => <LoadFailure message="Презентация не найдена" />,
});

function BackToList() {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/admin/documents/presentations">
        <ArrowLeft className="mr-1.5 h-4 w-4" />К списку презентаций
      </Link>
    </Button>
  );
}

function LoadFailure({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 rounded-xl p-10 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />
      <div>
        <p className="font-medium">Не удалось открыть презентацию</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-4 w-4" />Повторить
          </Button>
        )}
        <BackToList />
      </div>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Загрузка презентации">
      <div className="h-10 w-1/3 animate-pulse rounded-md bg-muted/40" />
      <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="aspect-video animate-pulse rounded-xl bg-muted/30" />)}
        </div>
        <div className="aspect-video animate-pulse rounded-xl bg-muted/30" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/30" />
      </div>
    </div>
  );
}

function Page() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const viewer = useDocumentViewer();
  const { confirm, dialog } = useConfirm();
  const isMobile = useIsMobile();

  const getFn = useServerFn(getPresentation);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["presentation", id],
    queryFn: () => getFn({ data: { id } }),
    retry: false,
  });

  const [meta, setMeta] = useState<Presentation | null>(null);
  const [slides, setSlides] = useState<PresentationSlide[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [autosave, setAutosave] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [mobileTab, setMobileTab] = useState<"slide" | "settings">("slide");
  const canvasWrap = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(720);
  const [layoutMode, setLayoutMode] = useState(false);
  // История раскладки текущего слайда: одно перетаскивание — один шаг отмены.
  const layoutHistory = useRef<{ slideId: string; layout: SlideLayoutOverrides }[]>([]);
  const [canUndoLayout, setCanUndoLayout] = useState(false);

  // Данные с сервера принимаем только когда нет несохранённых правок и не идёт
  // сохранение: иначе ответ затирал бы то, что пользователь печатает прямо сейчас,
  // а смена id слайдов сбрасывала бы выбранный слайд.
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!data) return;
    if (dirtyRef.current) return;
    setMeta(data.presentation);
    setSlides(data.slides);
    setSelected((prev) =>
      prev && data.slides.some((s) => s.id === prev) ? prev : (data.slides[0]?.id ?? null),
    );
    setDirty(false);
  }, [data]);

  // Редактор никогда не остаётся без выбранного слайда, если слайды есть.
  useEffect(() => {
    if (!slides.length) return;
    setSelected((prev) => (prev && slides.some((s) => s.id === prev) ? prev : slides[0].id));
  }, [slides]);



  useEffect(() => {
    const el = canvasWrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCanvasWidth(el.clientWidth));
    ro.observe(el);
    setCanvasWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [isLoading, mobileTab]);

  const { data: companies } = useCompanyProfiles();
  const company = useMemo(
    () =>
      (companies ?? []).find((c) => c.id === meta?.company_id) ??
      (companies ?? []).find((c) => c.is_default) ??
      null,
    [companies, meta?.company_id],
  );

  const current = slides.find((s) => s.id === selected) ?? null;
  const currentIndex = current ? slides.findIndex((s) => s.id === current.id) : -1;

  const patchSlide = (sid: string, patch: Partial<PresentationSlide>) => {
    setSlides((prev) => prev.map((s) => (s.id === sid ? { ...s, ...patch } : s)));
    setDirty(true);
  };
  /** Перетаскивание блока: сохраняем предыдущую раскладку для «Отменить». */
  const patchLayout = (sid: string, layout: SlideLayoutOverrides, patch: Partial<SlideLayoutOverrides>) => {
    layoutHistory.current = [...layoutHistory.current.slice(-19), { slideId: sid, layout }];
    setCanUndoLayout(true);
    setSlides((prev) =>
      prev.map((s) =>
        s.id === sid ? { ...s, content: { ...s.content, layout: { ...layout, ...patch } } } : s,
      ),
    );
    setDirty(true);
  };

  const undoLayout = () => {
    const last = layoutHistory.current.pop();
    setCanUndoLayout(layoutHistory.current.length > 0);
    if (!last) return;
    setSlides((prev) =>
      prev.map((s) =>
        s.id === last.slideId ? { ...s, content: { ...s.content, layout: last.layout } } : s,
      ),
    );
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
    setMobileTab("slide");
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

  const removeSlideNow = useCallback((sid: string) => {
    setSlides((prev) => {
      const i = prev.findIndex((s) => s.id === sid);
      const removed = prev[i];
      const next = prev.filter((s) => s.id !== sid);
      if (removed) {
        toast.success("Слайд удалён", {
          action: {
            label: "Вернуть",
            onClick: () =>
              setSlides((cur) => {
                if (cur.some((s) => s.id === removed.id)) return cur;
                const back = [...cur];
                back.splice(Math.min(i, back.length), 0, removed);
                setSelected(removed.id);
                setDirty(true);
                return back;
              }),
          },
        });
      }
      setSelected((cur) => (cur === sid ? (next[Math.min(i, next.length - 1)]?.id ?? null) : cur));
      return next;
    });
    setDirty(true);
  }, []);

  const askRemoveSlide = useCallback(
    async (sid: string) => {
      const s = slides.find((x) => x.id === sid);
      if (!s) return;
      const hasContent =
        !!s.title.trim() || !!s.subtitle.trim() || !!s.content.description.trim() ||
        s.content.includes.length > 0 || s.content.specs.length > 0 || !!s.image_url;
      if (hasContent) {
        const ok = await confirm({
          title: "Удалить слайд?",
          description: `${s.title || SLIDE_TYPE_LABELS[s.type]}. Удаление можно отменить сразу после действия.`,
          confirmText: "Удалить",
          destructive: true,
        });
        if (!ok) return;
      }
      removeSlideNow(sid);
    },
    [slides, confirm, removeSlideNow],
  );

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

  const reorder = (fromId: string, toId: string) => {
    setSlides((prev) => {
      const from = prev.findIndex((s) => s.id === fromId);
      const to = prev.findIndex((s) => s.id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
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
          title: meta.title.trim() || "Без названия",
          status: meta.status,
          template: meta.template,
          companyId: meta.company_id,
          logoUrl: meta.logo_url,
          clientLogoUrl: meta.client_logo_url,
          logoLayout: meta.logo_layout,
          fontFamily: meta.font_family,
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
    onSuccess: () => {
      setDirty(false);
      setSavedAt(new Date());
      // Открытую презентацию не перезапрашиваем: сервер пересоздаёт слайды с новыми
      // id, и перезагрузка сбрасывала бы выбранный слайд прямо во время работы.
      qc.invalidateQueries({ queryKey: ["presentations"] });
    },

    onError: (e: Error) => toast.error(e.message),
  });

  const saveRef = useRef(save);
  saveRef.current = save;

  /* Автосохранение через 3 c после последней правки. */
  useEffect(() => {
    if (!autosave || !dirty || !meta || saveRef.current.isPending) return;
    const t = setTimeout(() => {
      if (!saveRef.current.isPending) saveRef.current.mutate();
    }, 3000);
    return () => clearTimeout(t);
  }, [autosave, dirty, meta, slides]);

  /* Защита от потери правок */
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useBlocker({
    shouldBlockFn: () => {
      if (!dirty) return false;
      return !window.confirm("Есть несохранённые правки. Уйти со страницы без сохранения?");
    },
    enableBeforeUnload: false,
  });

  /* Ctrl/Cmd+S */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !save.isPending) save.mutate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dirty, save]);

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

  const statusChecks = useMemo<DocCheckLike[]>(() => {
    const out: DocCheckLike[] = [];
    if (!meta?.title?.trim()) out.push({ level: "error", message: "Не заполнено название презентации" });
    const visible = slides.filter((s) => s.is_visible).length;
    if (!visible) out.push({ level: "error", message: "Нет ни одного видимого слайда" });
    else if (visible < 3) out.push({ level: "warn", message: "Меньше трёх слайдов — презентация выглядит незавершённой" });
    if (!meta?.company_id) out.push({ level: "warn", message: "Не выбрана компания — реквизиты и логотип не подтянутся" });
    if (data?.quote && check.status !== "synced") out.push({ level: "warn", message: "Состав отличается от КП — проверьте вкладку «Сверка с КП»" });
    return out;
  }, [meta?.title, meta?.company_id, slides, data?.quote, check.status]);

  if (isError) {
    return (
      <LoadFailure
        message={error instanceof Error ? error.message : "Неизвестная ошибка"}
        onRetry={() => void refetch()}
      />
    );
  }
  if (isLoading || !meta) return <EditorSkeleton />;

  const visibleCount = slides.filter((s) => s.is_visible).length;

  const saveState = save.isPending
    ? { text: "Сохраняем…", cls: "text-muted-foreground" }
    : dirty
      ? { text: "Есть несохранённые правки", cls: "text-amber-500" }
      : savedAt
        ? { text: `Сохранено в ${savedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`, cls: "text-muted-foreground" }
        : { text: "Все изменения сохранены", cls: "text-muted-foreground" };

  const branding = {
    brandLogoUrl: meta.logo_url,
    clientLogoUrl: meta.client_logo_url,
    logoLayout: meta.logo_layout,
    fontFamily: meta.font_family,
  } as const;

  const rail = (
    <SlideThumbRail
      slides={slides}
      selected={selected}
      company={company}
      template={meta.template}
      presentationTitle={meta.title}
      horizontal={isMobile}
      onSelect={(sid) => { setSelected(sid); setMobileTab("slide"); }}
      onMove={move}
      onReorder={reorder}
      onDuplicate={duplicateSlide}
      onDelete={(sid) => void askRemoveSlide(sid)}
      branding={branding}
    />
  );

  const addSlideButton = (
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
  );

  const canvas = current ? (
    <div className="rounded-xl border border-border/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">Слайд {currentIndex + 1} из {slides.length}</span>
        <div className="flex items-center gap-2">
          <span>{SLIDE_TYPE_LABELS[current.type]}{current.is_visible ? "" : " · скрыт"}</span>
          {layoutMode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!canUndoLayout}
              onClick={undoLayout}
            >
              <Undo2 className="mr-1 h-3.5 w-3.5" />Отменить
            </Button>
          )}
          <Button
            variant={layoutMode ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setLayoutMode((v) => !v)}
          >
            {layoutMode ? "Готово" : "Правка раскладки"}
          </Button>
        </div>
      </div>
      <SlideCanvas
        slide={current}
        company={company}
        template={meta.template}
        presentationTitle={meta.title}
        width={Math.max(320, canvasWidth - 32)}
        index={currentIndex}
        total={slides.length}
        showWarnings
        onEdit={layoutMode ? undefined : (patch) => patchSlide(current.id, patch)}
        interactive={layoutMode}
        onLayout={(patch) => patchLayout(current.id, current.content.layout, patch)}
        {...branding}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        {layoutMode
          ? "Перетащите блок — слайд соберётся сам. Угловой маркер меняет размер, Ctrl/Cmd + Z отменяет."
          : "Заголовок и подзаголовок правятся прямо на слайде. Сохранение — Ctrl/Cmd + S."}
      </p>
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
      {slides.length ? "Выберите слайд в списке" : "Пока нет слайдов — добавьте первый"}
    </div>
  );

  const settings = current ? (
    <SlideSettingsPanel slide={current} onChange={(patch) => patchSlide(current.id, patch)} />
  ) : (
    <div className="text-sm text-muted-foreground">Слайд не выбран</div>
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="К списку презентаций"
            onClick={() => navigate({ to: "/admin/documents/presentations" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <Input
              aria-label="Название презентации"
              className="h-9 w-full min-w-[220px] border-transparent bg-transparent px-0 text-lg font-semibold focus-visible:border-border focus-visible:px-2 sm:min-w-[320px]"
              value={meta.title}
              onChange={(e) => patchMeta({ title: e.target.value })}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusPill tone={meta.status === "ready" ? "success" : "muted"}>
                {STATUS_LABELS[meta.status]}
              </StatusPill>
              <span>{slides.length} слайдов{visibleCount !== slides.length ? ` · ${visibleCount} видимых` : ""}</span>
              {data?.quote && (
                <Link
                  to="/admin/documents/quotes/$id"
                  params={{ id: data.quote.id }}
                  className="hover:text-primary"
                >
                  КП {data.quote.number}
                </Link>
              )}
              <span className={saveState.cls}>
                {!dirty && !save.isPending && <Check className="mr-1 inline h-3 w-3" aria-hidden />}
                {saveState.text}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!visibleCount}
            title={visibleCount ? undefined : "Нет видимых слайдов"}
            onClick={() => setPresenting(true)}
          >
            <Play className="mr-1.5 h-4 w-4" />Показ
          </Button>
          <Button variant="outline" size="sm" disabled={exporting || !slides.length} onClick={() => void exportPptx()}>
            {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
            PPTX
          </Button>
          <Button variant="outline" size="sm" disabled={!slides.length || save.isPending} onClick={() => void exportPdf()}>
            <Download className="mr-1.5 h-4 w-4" />PDF
          </Button>
          <Button size="sm" disabled={save.isPending || !dirty} onClick={() => save.mutate()}>
            {save.isPending
              ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              : <Save className="mr-1.5 h-4 w-4" />}
            {save.isPending ? "Сохраняем…" : "Сохранить"}
          </Button>
        </div>
      </header>

      <DocStatusBar checks={statusChecks} className="mb-3" okLabel="Презентация готова к показу" />

      <Tabs defaultValue="slides">
        <TabsList>
          <TabsTrigger value="slides">Слайды</TabsTrigger>
          <TabsTrigger value="settings">Оформление</TabsTrigger>
          <TabsTrigger value="check">
            Сверка с КП
            {data?.quote && check.status !== "synced" && (
              <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="slides" className="mt-4">
          {isMobile ? (
            <div className="space-y-3">
              {rail}
              {addSlideButton}
              <div className="inline-flex w-full gap-1 rounded-lg border border-border/60 p-1">
                <Button
                  size="sm"
                  className="flex-1"
                  variant={mobileTab === "slide" ? "secondary" : "ghost"}
                  onClick={() => setMobileTab("slide")}
                >
                  Слайд
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  variant={mobileTab === "settings" ? "secondary" : "ghost"}
                  onClick={() => setMobileTab("settings")}
                >
                  Настройки
                </Button>
              </div>
              {mobileTab === "slide" ? (
                <div ref={canvasWrap} className="min-w-0">{canvas}</div>
              ) : (
                <div className="rounded-xl border border-border/60 p-4">{settings}</div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)_320px]">
              <div className="space-y-2">
                {rail}
                {addSlideButton}
              </div>
              <div ref={canvasWrap} className="min-w-0">{canvas}</div>
              <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-border/60 p-4">
                {settings}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="grid max-w-xl gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-title">Название</Label>
              <Input
                id="p-title"
                value={meta.title}
                aria-invalid={!meta.title.trim()}
                onChange={(e) => patchMeta({ title: e.target.value })}
              />
              {!meta.title.trim() && (
                <p className="text-xs text-destructive">Без названия презентация сохранится как «Без названия»</p>
              )}
            </div>
            <CompanySelect
              value={meta.company_id}
              onChange={(companyId) => patchMeta({ company_id: companyId })}
            />
            <DocFontSelect
              value={meta.font_family}
              onChange={(font_family) => patchMeta({ font_family })}
              hint="Шрифт применяется ко всей презентации: превью, PDF и показ."
            />
            <PresentationBrandingPanel
              logoUrl={meta.logo_url}
              clientLogoUrl={meta.client_logo_url}
              layout={meta.logo_layout}
              onChange={(patch) => patchMeta(patch)}
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
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={autosave}
                onChange={(e) => setAutosave(e.target.checked)}
              />
              Автосохранение (через 3 секунды после правки)
            </label>
          </div>
        </TabsContent>

        <TabsContent value="check" className="mt-4">
          <PresentationCheckPanel
            check={check}
            hasQuote={!!data?.quote}
            onAddMissing={(items) => addMissing.mutate(items)}
            onSelectSlide={setSelected}
            onRemoveSlide={(sid) => void askRemoveSlide(sid)}
          />
        </TabsContent>
      </Tabs>

      <PresentationFullscreen
        open={presenting}
        slides={slides}
        startId={selected}
        company={company}
        template={meta.template}
        presentationTitle={meta.title}
        branding={branding}
        onClose={() => setPresenting(false)}
      />

      {dialog}
    </div>
  );
}

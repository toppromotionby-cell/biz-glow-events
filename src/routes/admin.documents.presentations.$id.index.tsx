// Редактор презентации: миниатюры, крупный слайд, настройки, сверка с КП.
// Автосохранение, горячие клавиши, защита от потери правок, показ на весь экран.
import { createFileRoute, Link, useNavigate, useBlocker } from "@tanstack/react-router";
import { DocFontSelect } from "@/components/admin/documents/DocFontSelect";
import { FullscreenLayer, Z_LAYER } from "@/components/FullscreenLayer";

import { PresentationBrandingPanel } from "@/components/admin/presentations/PresentationBrandingPanel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveStatus } from "@/lib/editor/save-state";
import { useEditorSave } from "@/hooks/use-editor-save";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Check, Download, FileText, Layers, ListChecks, Loader2,
  Palette, Play, Plus, RefreshCw, ShieldCheck, Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditorSidebar, type EditorSection } from "@/components/admin/editor/EditorSidebar";
import { SlideAuditPanel } from "@/components/admin/presentations/SlideAuditPanel";
import { auditPresentation } from "@/lib/presentations/audit";
import { CanvasStage } from "@/components/admin/presentations/CanvasStage";
import { EditorStatusBar } from "@/components/admin/presentations/EditorStatusBar";
import { BlockToolbar, type BlockKind } from "@/components/admin/presentations/BlockToolbar";

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
  type PresentationTemplate, type SlideLayoutOverrides, type SlideType,
} from "@/lib/presentations/model";
import {
  getPresentation, savePresentation, buildSlidesFromQuote,
} from "@/lib/presentations.functions";

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
  
  const [presenting, setPresenting] = useState(false);
  // Рабочее пространство: активный раздел рельса, зум, выделенный блок, обзор.
  const [sidebar, setSidebar] = useState<string | null>("slides");
  const [zoom, setZoom] = useState(1);
  const [selectedBlock, setSelectedBlock] = useState<BlockKind | null>(null);
  const [textEditing, setTextEditing] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);

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
  /**
   * Правка раскладки. Внутри одного жеста (перетаскивание, изменение размера)
   * приходит много кадров с `transient: true` — шаг отмены создаёт только
   * первый из них, иначе «Отменить» откатывало бы по пикселю.
   */
  const patchLayout = (
    sid: string,
    layout: SlideLayoutOverrides,
    patch: Partial<SlideLayoutOverrides>,
    opts?: { transient?: boolean },
  ) => {
    if (!opts?.transient) {
      layoutHistory.current = [...layoutHistory.current.slice(-19), { slideId: sid, layout }];
      setCanUndoLayout(true);
    }
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
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const slidesRef = useRef(slides);
  slidesRef.current = slides;

  /** Записать текущее состояние на сервер (используется хуком и перед экспортом PDF). */
  const persist = useCallback(async () => {
    const m = metaRef.current;
    if (!m) return;
    try {
      await saveFn({
        data: {
          id: m.id,
          title: m.title.trim() || "Без названия",
          status: m.status,
          template: m.template,
          companyId: m.company_id,
          logoUrl: m.logo_url,
          clientLogoUrl: m.client_logo_url,
          logoLayout: m.logo_layout,
          fontFamily: m.font_family,
          slides: slidesRef.current.map((s, i) => ({
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      throw e;
    }
    setDirty(false);
    // Открытую презентацию не перезапрашиваем: сервер пересоздаёт слайды с новыми
    // id, и перезагрузка сбрасывала бы выбранный слайд прямо во время работы.
    qc.invalidateQueries({ queryKey: ["presentations"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveFn, qc]);

  // Общий хук автосохранения: дебаунс, Ctrl+S, защита от ухода со страницы.
  const saver = useEditorSave(persist);

  const saverRef = useRef(saver);
  saverRef.current = saver;

  /* Любая правка запускает отложенное сохранение. */
  useEffect(() => {
    if (dirty) saverRef.current.markDirty();
  }, [dirty, meta, slides]);

  useBlocker({
    shouldBlockFn: () => {
      if (!dirty) return false;
      return !window.confirm("Есть несохранённые правки. Уйти со страницы без сохранения?");
    },
    enableBeforeUnload: false,
  });

  /* Ctrl/Cmd+Z в режиме правки раскладки — отменить шаг (Ctrl+S берёт на себя хук). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoLayout();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoLayout]);



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

  const exportPdf = async () => {
    if (dirty) {
      const ok = await confirm({
        title: "Сначала сохранить?",
        description: "PDF собирается на сервере — несохранённые правки в него не попадут.",
        confirmText: "Сохранить и скачать",
      });
      if (ok) await persist();
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

  const saveState = saveStatus(saver.state, saver.savedAt, saver.error);

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
      horizontal={false}
      onSelect={(sid) => { setSelected(sid); setSelectedBlock(null); }}
      onMove={move}
      onReorder={reorder}
      onDuplicate={duplicateSlide}
      onDelete={(sid) => void askRemoveSlide(sid)}
      branding={branding}
    />
  );

  /* ---------- Разделы левого рельса ---------- */
  const slidesPanel = (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Добавить слайд</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(SLIDE_TYPE_LABELS) as SlideType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addSlide(t)}
              className="rounded-lg border border-border/60 bg-muted/20 px-2 py-3 text-left text-xs font-medium transition hover:border-primary hover:bg-primary/5"
            >
              <Plus className="mb-1 h-3.5 w-3.5 text-primary" />
              {SLIDE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Слайды презентации</p>
        {rail}
      </div>
    </div>
  );

  const designPanel = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Оформление</Label>
        <Select value={meta.template} onValueChange={(v) => patchMeta({ template: v as PresentationTemplate })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(TEMPLATE_LABELS) as PresentationTemplate[]).map((t) => (
              <SelectItem key={t} value={t}>{TEMPLATE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
    </div>
  );

  const docPanel = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="p-title">Название</Label>
        <Input
          id="p-title"
          value={meta.title}
          aria-invalid={!meta.title.trim()}
          onChange={(e) => patchMeta({ title: e.target.value })}
        />
      </div>
      <CompanySelect value={meta.company_id} onChange={(companyId) => patchMeta({ company_id: companyId })} />
      <div className="space-y-1.5">
        <Label>Статус</Label>
        <Select value={meta.status} onValueChange={(v) => patchMeta({ status: v as PresentationStatus })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABELS) as PresentationStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Правки сохраняются автоматически — отдельная кнопка «Сохранить» не нужна.
      </p>
      <DocStatusBar checks={statusChecks} okLabel="Презентация готова к показу" />
    </div>
  );

  const checkPanel = (
    <PresentationCheckPanel
      check={check}
      hasQuote={!!data?.quote}
      onAddMissing={(items) => addMissing.mutate(items)}
      onSelectSlide={setSelected}
      onRemoveSlide={(sid) => void askRemoveSlide(sid)}
    />
  );

  const auditReport = auditPresentation(slides);
  const auditPanel = <SlideAuditPanel slides={slides} onSelectSlide={setSelected} />;

  const sections: EditorSection[] = [
    { id: "slides", label: "Слайды", Icon: Layers, content: slidesPanel },
    { id: "design", label: "Дизайн", Icon: Palette, content: designPanel },
    { id: "doc", label: "Документ", Icon: FileText, content: docPanel },
    {
      id: "check",
      label: "Сверка",
      Icon: ListChecks,
      dot: !!data?.quote && check.status !== "synced",
      content: checkPanel,
    },
    {
      id: "audit",
      label: "Проверка",
      Icon: ShieldCheck,
      dot: auditReport.errors > 0,
      content: auditPanel,
    },
  ];

  return (
    <FullscreenLayer className="flex flex-col bg-background" label="Редактор презентации">
    <div className="flex h-full min-h-0 flex-col bg-background">

      {/* Верхняя панель */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
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
              className="h-8 w-full min-w-[200px] border-transparent bg-transparent px-0 text-base font-semibold focus-visible:border-border focus-visible:px-2 sm:min-w-[300px]"
              value={meta.title}
              onChange={(e) => patchMeta({ title: e.target.value })}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <StatusPill tone={meta.status === "ready" ? "success" : "muted"}>
                {STATUS_LABELS[meta.status]}
              </StatusPill>
              <span>{slides.length} слайдов{visibleCount !== slides.length ? ` · ${visibleCount} видимых` : ""}</span>
              {data?.quote && (
                <Link to="/admin/documents/quotes/$id" params={{ id: data.quote.id }} className="hover:text-primary">
                  КП {data.quote.number}
                </Link>
              )}
              <span className={saveState.tone === "error" ? "text-destructive" : saveState.tone === "pending" ? "text-amber-500" : "text-muted-foreground"}>
                {saver.state !== "dirty" && saver.state !== "saving" && <Check className="mr-1 inline h-3 w-3" aria-hidden />}
                {saveState.text}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" disabled={!canUndoLayout} onClick={undoLayout}>
            <Undo2 className="mr-1.5 h-4 w-4" />Отменить
          </Button>
          <Button
            variant="outline" size="sm" disabled={!visibleCount}
            title={visibleCount ? undefined : "Нет видимых слайдов"}
            onClick={() => setPresenting(true)}
          >
            <Play className="mr-1.5 h-4 w-4" />Показ
          </Button>
          <Button variant="outline" size="sm" disabled={!slides.length || saver.state === "saving"} onClick={() => void exportPdf()}>
            <Download className="mr-1.5 h-4 w-4" />PDF
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Левый рельс с панелями */}
        <div className="hidden min-h-0 md:flex">
          <EditorSidebar sections={sections} active={sidebar} onChange={setSidebar} />
        </div>

        {/* Центр: холст и статус-строка */}
        <div className="flex min-w-0 flex-1 flex-col">
          {current ? (
            <CanvasStage
              zoom={zoom}
              onBackgroundClick={() => { setSelectedBlock(null); setTextEditing(false); }}
            >
              {(width) => (
                <SlideCanvas
                  slide={current}
                  company={company}
                  template={meta.template}
                  presentationTitle={meta.title}
                  width={width}
                  index={currentIndex}
                  total={slides.length}
                  showWarnings
                  onEdit={(patch) => patchSlide(current.id, patch)}
                  interactive
                  textEditing={textEditing}
                  selectedBlock={selectedBlock}
                  onSelectBlock={(k) => { setSelectedBlock(k); if (!k) setTextEditing(false); }}
                  onTextEdit={(kind) => { setSelectedBlock(kind); setTextEditing(true); }}
                  floatingToolbar={isMobile}
                  onLayout={(patch, opts) => patchLayout(current.id, current.content.layout, patch, opts)}
                  {...branding}
                />
              )}
            </CanvasStage>
          ) : (
            <div className="flex flex-1 items-center justify-center bg-muted/40 p-10 text-center text-sm text-muted-foreground">
              {slides.length ? "Выберите слайд слева" : "Пока нет слайдов — добавьте первый в разделе «Слайды»"}
            </div>
          )}

          <EditorStatusBar
            index={currentIndex < 0 ? 0 : currentIndex}
            total={slides.length}
            zoom={zoom}
            onZoom={setZoom}
            onPrev={() => { const p = slides[currentIndex - 1]; if (p) setSelected(p.id); }}
            onNext={() => { const n = slides[currentIndex + 1]; if (n) setSelected(n.id); }}
            onGrid={() => setGridOpen(true)}
            hint="Клик — выделить блок, двойной клик — править текст, стрелки двигают логотип, Ctrl/Cmd + Z — отмена."
          />
        </div>

        {/* Правая панель свойств */}
        {!isMobile && (
          <aside className="hidden w-[320px] shrink-0 flex-col overflow-y-auto border-l border-border/60 p-4 lg:flex">
            {current ? (
              <div className="space-y-4">
                {selectedBlock && (
                  <div className="rounded-lg border border-border/60 p-2">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Выбранный блок</p>
                    <BlockToolbar
                      kind={selectedBlock}
                      layout={current.content.layout}
                      onChange={(patch) => patchLayout(current.id, current.content.layout, patch)}
                      onClose={() => setSelectedBlock(null)}
                    />
                  </div>
                )}
                <SlideSettingsPanel slide={current} onChange={(patch) => patchSlide(current.id, patch)} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Слайд не выбран</p>
            )}
          </aside>
        )}
      </div>

      {/* Обзор всех слайдов сеткой */}
      <Dialog open={gridOpen} onOpenChange={setGridOpen}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>Все слайды</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`overflow-hidden rounded-lg border text-left transition ${
                  s.id === selected ? "border-primary ring-2 ring-primary/30" : "border-border/60 hover:border-primary/60"
                }`}
                onClick={() => { setSelected(s.id); setGridOpen(false); }}
              >
                <SlideCanvas
                  slide={s}
                  company={company}
                  template={meta.template}
                  presentationTitle={meta.title}
                  width={280}
                  index={i}
                  total={slides.length}
                  {...branding}
                />
                <span className="block px-2 py-1 text-xs text-muted-foreground">
                  {i + 1}. {s.title || SLIDE_TYPE_LABELS[s.type]}{s.is_visible ? "" : " · скрыт"}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
    </FullscreenLayer>

  );
}


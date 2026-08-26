// Каталог шаблонов презентаций: превью структуры, фильтры по тематике и
// создание готовой презентации одним кликом.
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, LayoutTemplate, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { createPresentationFromTemplate } from "@/lib/presentations.functions";
import { brandKitBackground, BRAND_KIT_PRESETS } from "@/lib/presentations/brand-kit";
import {
  DECK_TEMPLATES, DECK_TOPIC_LABELS, deckBrandKit, type DeckTemplate, type DeckTopic,
} from "@/lib/presentations/deck-templates";
import { SLIDE_TYPE_LABELS } from "@/lib/presentations/model";

export const Route = createFileRoute("/admin/documents/presentations/templates")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Шаблоны презентаций — Event Hub" },
      { name: "description", content: "Каталог готовых структур презентаций с превью и созданием в один клик." },
    ],
  }),
});

const TOPICS = Object.keys(DECK_TOPIC_LABELS) as DeckTopic[];

/** Мини-превью структуры: цвета набора и порядок слайдов. */
function TemplatePreview({ t }: { t: DeckTemplate }) {
  const kit = BRAND_KIT_PRESETS.find((k) => k.id === t.brandKitId) ?? deckBrandKit(t);
  return (
    <div
      className="relative flex h-32 flex-col justify-end gap-1 rounded-lg p-3"
      style={{ background: brandKitBackground(kit) }}
    >
      <span
        className="absolute left-3 top-3 rounded px-1.5 py-0.5 text-[10px] font-semibold"
        style={{ background: kit.accent, color: "#fff" }}
      >
        {t.blueprint.length} слайдов
      </span>
      <div className="flex flex-wrap gap-1">
        {t.blueprint.slice(0, 8).map((b, i) => (
          <span
            key={i}
            className="rounded bg-background/85 px-1.5 py-0.5 text-[10px] text-foreground"
          >
            {SLIDE_TYPE_LABELS[b.type]}
          </span>
        ))}
      </div>
    </div>
  );
}

function Page() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState<DeckTopic | "all">("all");
  const createFn = useServerFn(createPresentationFromTemplate);

  const list = useMemo(
    () => (topic === "all" ? DECK_TEMPLATES : DECK_TEMPLATES.filter((t) => t.topics.includes(topic))),
    [topic],
  );

  const create = useMutation({
    mutationFn: async (t: DeckTemplate) =>
      await createFn({ data: { templateId: t.id, companyId: null, quoteId: null, photoRich: false } }),
    onSuccess: (res) => {
      toast.success(`Презентация создана: ${res.slides} слайдов`);
      void navigate({ to: "/admin/documents/presentations/$id", params: { id: res.id } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className="space-y-4">
      <AdminPageHeader
        icon={<LayoutTemplate className="h-5 w-5 text-primary" />}
        title="Шаблоны презентаций"
        subtitle={`${list.length} готовых структур с оформлением и бренд-набором`}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/admin/documents/presentations" })}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />К списку
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        <Button
          variant={topic === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setTopic("all")}
        >
          Все
        </Button>
        {TOPICS.map((t) => (
          <Button
            key={t}
            variant={topic === t ? "default" : "outline"}
            size="sm"
            onClick={() => setTopic(t)}
          >
            {DECK_TOPIC_LABELS[t]}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((t) => (
          <article key={t.id} className="flex flex-col gap-3 rounded-xl border border-border/60 p-3">
            <TemplatePreview t={t} />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{t.name}</h2>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {t.topics.map((tp) => (
                <span key={tp} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {DECK_TOPIC_LABELS[tp]}
                </span>
              ))}
            </div>
            <Button
              size="sm"
              className="mt-auto"
              disabled={create.isPending}
              onClick={() => create.mutate(t)}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />Создать за один клик
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}

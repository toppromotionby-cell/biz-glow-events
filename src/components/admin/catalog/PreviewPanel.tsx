import { Eye, Info, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StorageImg, StorageVideo } from "@/components/StorageMedia";
import { PriceTableView, getTiers } from "@/components/PriceTable";
import { fmtDateTime } from "@/lib/formatters";
import { asArray, type ExtraItem, type FaqItem, type FeatureItem, type Row } from "./shared";

export function PreviewPanel({
  item,
  onClose,
  onEdit,
}: {
  item: Row;
  onClose: () => void;
  onEdit: (it: Row) => void;
}) {
  const features = asArray<FeatureItem>(item.features);
  const extras = asArray<ExtraItem>(item.extras);
  const faq = asArray<FaqItem>(item.faq);

  return (
    <div className="glass rounded-xl border border-border/40 overflow-hidden">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 border-b border-border/40 bg-background/85 backdrop-blur">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Превью карточки</span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={() => onEdit(item)} className="bg-gradient-primary glow-primary">
            <Pencil className="h-4 w-4 mr-1" />Редактировать
          </Button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть превью"
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-5 max-h-[calc(100vh-9rem)] overflow-y-auto">
        <header className="space-y-2">
          <h2 className="text-2xl font-display flex items-center gap-3 flex-wrap">
            {item.title}
            {item.published
              ? <Badge className="bg-success/20 text-success border-success/30">Опубликовано</Badge>
              : <Badge variant="outline">Черновик</Badge>}
            {item.category && <Badge variant="secondary">{item.category}</Badge>}
          </h2>
          {item.short_description && (
            <p className="text-sm text-muted-foreground">{item.short_description}</p>
          )}
        </header>

        {(item.photo_urls?.length ?? 0) > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Фотографии ({item.photo_urls!.length})</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {item.photo_urls!.map((url, i) => (
                <div key={i} className="block aspect-[4/3] overflow-hidden rounded-lg bg-muted/30">
                  <StorageImg path={url} alt={`${item.title} #${i + 1}`} className="h-full w-full object-cover hover:scale-105 transition" fallbackClassName="h-full w-full" />
                </div>
              ))}
            </div>
          </section>
        )}

        {(item.video_urls?.length ?? 0) > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Видео ({item.video_urls!.length})</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {item.video_urls!.map((url, i) => (
                <StorageVideo key={i} path={url} className="w-full rounded-lg bg-black aspect-video" />
              ))}
            </div>
          </section>
        )}

        {item.description && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Полное описание</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.description}</p>
          </section>
        )}

        {item.requirements && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Требования</h3>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.requirements}</p>
          </section>
        )}

        {features.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Что входит</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              {features.map((f, i) => (
                <li key={i}>{typeof f === "string" ? f : JSON.stringify(f)}</li>
              ))}
            </ul>
          </section>
        )}

        {extras.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2"><Info className="h-3.5 w-3.5" />Дополнительно</h3>
            <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {extras.map((r, i) => (
                <div key={i} className="flex justify-between gap-3 border-b border-border/30 py-1">
                  <dt className="text-muted-foreground">{r?.label ?? ""}</dt>
                  <dd className="font-medium text-right">{r?.value ?? ""}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {getTiers(item.pricing).length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Цены</h3>
            <PriceTableView pricing={item.pricing} />
          </section>
        )}

        {faq.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">FAQ</h3>
            <div className="space-y-2">
              {faq.map((q, i) => (
                <div key={i} className="rounded-lg border border-border/50 p-3">
                  <div className="font-medium text-sm">{q.q ?? q.question ?? `Вопрос ${i + 1}`}</div>
                  <div className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{q.a ?? q.answer ?? ""}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="grid sm:grid-cols-2 gap-3 text-xs text-muted-foreground pt-2 border-t border-border/30">
          <div><span className="font-semibold text-foreground">Slug:</span> {item.slug}</div>
          <div><span className="font-semibold text-foreground">ID:</span> {item.id}</div>
          {item.seo_title && <div><span className="font-semibold text-foreground">SEO title:</span> {item.seo_title}</div>}
          {item.seo_description && <div className="sm:col-span-2"><span className="font-semibold text-foreground">SEO description:</span> {item.seo_description}</div>}
          {item.created_at && <div>Создано: {fmtDateTime(item.created_at)}</div>}
          {item.updated_at && <div>Обновлено: {fmtDateTime(item.updated_at)}</div>}
        </section>
      </div>
    </div>
  );
}

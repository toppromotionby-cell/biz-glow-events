// Рендерер блоков статьи справки. Единственное место, где контент превращается в вёрстку.
import { Info, Lightbulb, TriangleAlert } from "lucide-react";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import type { HelpArticle, HelpBlock } from "@/content/help/types";
import { cn } from "@/lib/utils";

const NOTE_STYLE: Record<string, { cls: string; icon: typeof Info; label: string }> = {
  info: { cls: "border-primary/30 bg-primary/5", icon: Info, label: "Важно" },
  tip: { cls: "border-emerald-500/30 bg-emerald-500/5", icon: Lightbulb, label: "Совет" },
  warn: { cls: "border-amber-500/40 bg-amber-500/5", icon: TriangleAlert, label: "Внимание" },
};

function Block({ block }: { block: HelpBlock }) {
  switch (block.t) {
    case "h":
      return <h3 className="mt-8 mb-3 text-base font-semibold tracking-tight">{block.text}</h3>;
    case "p":
      return <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{block.text}</p>;
    case "steps":
      return (
        <ol className="mb-4 space-y-2">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                {i + 1}
              </span>
              <span>{it}</span>
            </li>
          ))}
        </ol>
      );
    case "list":
      return (
        <ul className="mb-4 space-y-1.5">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      );
    case "note": {
      const s = NOTE_STYLE[block.tone] ?? NOTE_STYLE.info;
      const Icon = s.icon;
      return (
        <div className={cn("mb-4 flex gap-3 rounded-lg border px-3 py-2.5", s.cls)}>
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-foreground/70" />
          <div className="text-sm leading-relaxed">
            <span className="mr-1.5 font-medium">{s.label}.</span>
            <span className="text-muted-foreground">{block.text}</span>
          </div>
        </div>
      );
    }
    case "example":
      return (
        <div className="mb-4 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5">
          {block.title && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{block.title}</div>}
          <div className="text-sm leading-relaxed">{block.text}</div>
        </div>
      );
    case "image":
      return (
        <figure className="mb-5 overflow-hidden rounded-xl border border-border/60">
          <img src={block.src} alt={block.alt} loading="lazy" className="h-44 w-full object-cover" />
          {block.caption && (
            <figcaption className="border-t border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    case "faq":
      return (
        <Accordion type="single" collapsible className="mb-4">
          {block.items.map((it, i) => (
            <AccordionItem key={i} value={String(i)}>
              <AccordionTrigger className="text-sm">{it.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{it.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      );
    default:
      return null;
  }
}

export function ArticleBody({ article }: { article: HelpArticle }) {
  return (
    <div>
      {article.blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}

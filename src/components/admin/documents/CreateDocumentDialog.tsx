// Единый диалог создания документа: сначала тип (КП / КП промо),
// затем источник — с нуля, из заказа, из шаблона или из пресета промо.
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileSignature, Megaphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { createQuote, createQuoteFromTemplate, listOrdersForQuote, listQuotes } from "@/lib/quotes.functions";
import { createPromoQuote, listPromoQuotes } from "@/lib/promo-quotes.functions";
import { createDocFromEstimateTemplate, listEstimateTemplates } from "@/lib/estimate-templates.functions";
import { PROMO_PRESETS } from "@/lib/promo-quote-model";
import { fmtDate, fmtMoney } from "@/lib/formatters";


export type CreatedDoc = { kind: "quote" | "promo"; id: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (doc: CreatedDoc) => void;
};

type Step = "kind" | "quote" | "promo";

export function CreateDocumentDialog({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState<Step>("kind");
  const [orderTerm, setOrderTerm] = useState("");

  const create = useServerFn(createQuote);
  const fromTemplate = useServerFn(createQuoteFromTemplate);
  const orders = useServerFn(listOrdersForQuote);
  const quoteTemplates = useServerFn(listQuotes);
  const createPromo = useServerFn(createPromoQuote);
  const promoTemplates = useServerFn(listPromoQuotes);

  const { data: orderHits = [] } = useQuery({
    queryKey: ["create-doc-orders", orderTerm],
    queryFn: () => orders({ data: { q: orderTerm } }),
    enabled: open && step === "quote",
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["create-doc-quote-templates"],
    queryFn: () => quoteTemplates({ data: { templates: true } }),
    enabled: open && step === "quote",
  });

  const { data: promoTpls = [] } = useQuery({
    queryKey: ["create-doc-promo-templates"],
    queryFn: () => promoTemplates({ data: { templates: true } }),
    enabled: open && step === "promo",
  });

  const samplesFn = useServerFn(listEstimateTemplates);
  const fromSample = useServerFn(createDocFromEstimateTemplate);
  const { data: samples = [] } = useQuery({
    queryKey: ["create-doc-samples"],
    queryFn: () => samplesFn({ data: { kind: "any" } }),
    enabled: open && step !== "kind",
  });



  const busy = useMutation({
    mutationFn: async (task: () => Promise<CreatedDoc>) => task(),
    onSuccess: (doc) => onCreated(doc),
    onError: (e: Error) => toast.error(e.message),
  });

  const run = (task: () => Promise<CreatedDoc>) => busy.mutate(task);

  const reset = (v: boolean) => {
    if (!v) { setStep("kind"); setOrderTerm(""); }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "kind" ? "Создать документ" : step === "quote" ? "Коммерческое предложение" : "КП промо"}
          </DialogTitle>
          <DialogDescription>
            {step === "kind" ? "Выберите тип документа" : "Выберите, с чего начать"}
          </DialogDescription>
        </DialogHeader>

        {busy.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />Создаём документ…
          </div>
        )}

        {step === "kind" && (
          <div className="space-y-2">
            <KindCard
              icon={<FileSignature className="h-5 w-5 text-primary" />}
              title="Коммерческое предложение"
              description="Смета по мероприятию: позиции каталога, разделы, текстовые блоки"
              onClick={() => setStep("quote")}
            />
            <KindCard
              icon={<Megaphone className="h-5 w-5 text-primary" />}
              title="КП промо"
              description="Промо-направление: множители, комиссия, экспорт в Excel"
              onClick={() => setStep("promo")}
            />
          </div>
        )}

        {step === "quote" && (
          <div className="space-y-3">
            <Button
              className="w-full"
              disabled={busy.isPending}
              onClick={() => run(async () => ({ kind: "quote", id: (await create({ data: { orderId: null } })).id }))}
            >
              Пустое КП
            </Button>

            <div>
              <div className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Из заказа</div>
              <Input
                placeholder="Поиск по клиенту или номеру заказа"
                value={orderTerm}
                onChange={(e) => setOrderTerm(e.target.value)}
              />
              <div className="mt-2 max-h-48 divide-y divide-border/60 overflow-auto rounded-md border border-border/60">
                {orderHits.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    disabled={busy.isPending}
                    className="w-full px-3 py-2 text-left transition-colors hover:bg-muted/50"
                    onClick={() => run(async () => ({ kind: "quote", id: (await create({ data: { orderId: o.id } })).id }))}
                  >
                    <div className="text-sm font-medium">
                      №{(o.order_number ?? o.id.slice(0, 8)).replaceAll("/", ".")} · {o.client_company || o.client_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.client_name}{o.event_date ? ` · ${fmtDate(o.event_date)}` : ""}
                    </div>
                  </button>
                ))}
                {!orderHits.length && <div className="p-3 text-sm text-muted-foreground">Заказы не найдены</div>}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Из шаблона</div>
              <div className="max-h-40 divide-y divide-border/60 overflow-auto rounded-md border border-border/60">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={busy.isPending}
                    className="w-full px-3 py-2 text-left transition-colors hover:bg-muted/50"
                    onClick={() =>
                      run(async () => ({ kind: "quote", id: (await fromTemplate({ data: { templateId: t.id } })).id }))
                    }
                  >
                    <div className="text-sm font-medium">{t.template_name || t.title}</div>
                    <div className="text-xs tabular-nums text-muted-foreground">{fmtMoney(Number(t.total ?? 0))}</div>
                  </button>
                ))}
                {!templates.length && <div className="p-3 text-sm text-muted-foreground">Шаблонов пока нет</div>}
              </div>
            </div>
          </div>
        )}

        {step === "promo" && (
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Готовые сценарии</div>
              <div className="space-y-2">
                {PROMO_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    disabled={busy.isPending}
                    className="w-full rounded-lg border border-border p-3 text-left transition hover:border-primary hover:bg-accent/50 disabled:opacity-60"
                    onClick={() =>
                      run(async () => ({ kind: "promo", id: (await createPromo({ data: { preset: p.key } })).id }))
                    }
                  >
                    <div className="font-medium">{p.label}</div>
                    <div className="text-sm text-muted-foreground">{p.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">Из шаблона</div>
              <div className="max-h-40 divide-y divide-border/60 overflow-auto rounded-md border border-border/60">
                {promoTpls.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={busy.isPending}
                    className="w-full px-3 py-2 text-left transition-colors hover:bg-muted/50"
                    onClick={() =>
                      run(async () => ({ kind: "promo", id: (await createPromo({ data: { fromId: t.id } })).id }))
                    }
                  >
                    <div className="text-sm font-medium">{t.template_name || t.project || "Шаблон"}</div>
                    <div className="text-xs tabular-nums text-muted-foreground">{fmtMoney(Number(t.total ?? 0))}</div>
                  </button>
                ))}
                {!promoTpls.length && <div className="p-3 text-sm text-muted-foreground">Шаблонов пока нет</div>}
              </div>
            </div>
          </div>
        )}

        {step !== "kind" && (
          <Button variant="ghost" size="sm" onClick={() => setStep("kind")}>Назад к выбору типа</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KindCard({
  icon, title, description, onClick,
}: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition hover:border-primary hover:bg-accent/50"
    >
      <span className="mt-0.5">{icon}</span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

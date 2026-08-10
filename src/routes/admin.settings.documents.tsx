// Настройки документов: реквизиты, банк, подписант, параметры КП/счёта/договора,
// редактор тела договора. Сохранение с debounce 800мс + единый toast.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useId, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileCog, Save, ExternalLink, Plus, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { notify } from "@/lib/notify";
import { BRAND_ACCENTS } from "@/lib/documents/brand";

import { supabase } from "@/integrations/supabase/client";
import { useDocumentViewer } from "@/hooks/use-document-viewer";
import { VatSettings } from "@/components/admin/VatSettings";
import { LogoHeaderDesigner } from "@/components/admin/LogoHeaderDesigner";

import {
  getDocumentSettings,
  updateDocumentSettings,
  DEFAULT_DOCUMENT_SETTINGS,
  type DocumentSettings,
} from "@/lib/document-settings.functions";

export const Route = createFileRoute("/admin/settings/documents")({
  component: DocumentSettingsPage,
});

type Section = { title: string; paragraphs: string[] };

function DocumentSettingsPage() {
  const getFn = useServerFn(getDocumentSettings);
  const updateFn = useServerFn(updateDocumentSettings);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["document-settings"],
    queryFn: () => getFn(),
  });

  const [form, setForm] = useState<DocumentSettings | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data, form]);

  const mutation = useMutation({
    mutationFn: async (next: DocumentSettings) => updateFn({ data: next }),
    onSuccess: (res) => {
      setSaveState("saved");
      qc.setQueryData(["document-settings"], res);
      notify.autosaved();
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
    },
    onError: (e: Error) => {
      setSaveState("idle");
      notify.error(e?.message ?? "Не удалось сохранить настройки");
    },
  });

  const persist = useDebouncedCallback((next: DocumentSettings) => {
    setSaveState("saving");
    mutation.mutate(next);
  }, 800);

  const update = <K extends keyof DocumentSettings>(key: K, value: DocumentSettings[K]) => {
    if (!form) return;
    const next = { ...form, [key]: value };
    setForm(next);
    persist(next);
  };

  // Последний заказ — чтобы можно было открыть пример КП/счёта/договора.
  const lastOrder = useQuery({
    queryKey: ["last-order-for-doc-preview"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data?.id ?? null;
    },
  });

  const viewer = useDocumentViewer();
  const openPreview = (kind: "quote" | "invoice" | "contract" | "act") => {
    if (!lastOrder.data) {
      notify.info("Нет ни одного заказа — создайте заказ, чтобы посмотреть документ.");
      return;
    }
    viewer.openDocument(`/admin/orders/${lastOrder.data}/${kind}?format=pdf`);
  };

  if (isLoading || !form) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Настройки документов" icon={<FileCog className="h-6 w-6" />} />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Настройки документов"
        subtitle="Реквизиты, банк, подписант и шаблоны для КП, счёта и договора. Сохраняются автоматически."
        icon={<FileCog className="h-6 w-6" />}
        action={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {saveState === "saving" && (<><Loader2 className="h-3 w-3 animate-spin" />Сохраняется…</>)}
            {saveState === "saved" && (<><Save className="h-3 w-3 text-emerald-400" />Сохранено</>)}
          </div>
        }
      />

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="bg-card/60 border border-border/50 flex flex-wrap h-auto">
          <TabsTrigger value="company">Компания</TabsTrigger>
          <TabsTrigger value="bank">Банк</TabsTrigger>
          <TabsTrigger value="signer">Подписант</TabsTrigger>
          <TabsTrigger value="quote">КП</TabsTrigger>
          <TabsTrigger value="invoice">Счёт</TabsTrigger>
          <TabsTrigger value="contract">Договор</TabsTrigger>
          <TabsTrigger value="act">Акт</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card title="Компания и бренд" preview="quote" onPreview={openPreview}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Юр. название" value={form.company_legal_name} onChange={(v) => update("company_legal_name", v)} />
              <Field label="Бренд (для шапки)" value={form.company_brand} onChange={(v) => update("company_brand", v)} />
              <Field label="УНП" value={form.company_unp} onChange={(v) => update("company_unp", v)} />
              <Field label="Юридический адрес" value={form.company_address} onChange={(v) => update("company_address", v)} />
              <Field label="Телефон" value={form.company_phone} onChange={(v) => update("company_phone", v)} />
              <Field label="E-mail" type="email" value={form.company_email} onChange={(v) => update("company_email", v)} />
              <Field label="Сайт" value={form.company_website} onChange={(v) => update("company_website", v)} />
              <LogoHeaderDesigner
                logoUrl={form.logo_url ?? null}
                onLogoChange={(v) => update("logo_url", v)}
                layout={form.logo_layout}
                onLayoutChange={(l) => update("logo_layout", l)}
                brand={form.company_brand}
                legalLine={`${form.company_legal_name} · ${form.company_address}`}
                accent={form.accent_color}
              />
              <Field label="Акцентный цвет" value={form.accent_color} onChange={(v) => update("accent_color", v)} placeholder="#FF7500">
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-10 w-10 rounded-md border border-border/60" style={{ background: form.accent_color }} aria-hidden />
                  {BRAND_ACCENTS.map((c) => (
                    <button key={c.hex} type="button" title={`${c.label} ${c.hex}`} onClick={() => update("accent_color", c.hex)}
                      className="h-6 w-6 rounded-full border border-border/60 transition hover:scale-110" style={{ background: c.hex }} />
                  ))}
                </div>
              </Field>

            </div>
          </Card>
        </TabsContent>

        <TabsContent value="bank">
          <Card title="Банковские реквизиты" preview="invoice" onPreview={openPreview}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Наименование банка" value={form.bank_name} onChange={(v) => update("bank_name", v)} />
              <Field label="БИК" value={form.bank_bic} onChange={(v) => update("bank_bic", v)} />
              <Field label="Расчётный счёт (IBAN)" value={form.bank_account} onChange={(v) => update("bank_account", v)} className="md:col-span-2" />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="signer">
          <Card title="Подписант" preview="contract" onPreview={openPreview}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="ФИО" value={form.signer_name} onChange={(v) => update("signer_name", v)} />
              <Field label="Должность" value={form.signer_title} onChange={(v) => update("signer_title", v)} />
              <Field label="Действует на основании" value={form.signer_basis} onChange={(v) => update("signer_basis", v)} placeholder="Устава / Доверенности №…" />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="quote">
          <Card title="Коммерческое предложение" preview="quote" onPreview={openPreview}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Срок действия (дней)" type="number" value={String(form.quote_validity_days)} onChange={(v) => update("quote_validity_days", Number(v) || 14)} />
              <Field label="Примечание об НДС" value={form.vat_note} onChange={(v) => update("vat_note", v)} />
            </div>
            <div className="mt-4">
              <VatSettings
                value={{ mode: form.vat_mode, rate: form.vat_rate, asLine: form.vat_as_line }}
                onChange={(v) => {
                  if (v.mode !== undefined) update("vat_mode", v.mode);
                  if (v.rate !== undefined) update("vat_rate", v.rate);
                  if (v.asLine !== undefined) update("vat_as_line", v.asLine);
                }}
                hint="Настройка применяется к счетам, актам и договорам, формируемым из заказов."
              />
            </div>
            <FieldArea label="Текст футера" value={form.quote_footer} onChange={(v) => update("quote_footer", v)} rows={3} />
          </Card>
        </TabsContent>

        <TabsContent value="invoice">
          <Card title="Счёт" preview="invoice" onPreview={openPreview}>
            <Field label="Срок оплаты (банковских дней)" type="number" value={String(form.invoice_validity_days)} onChange={(v) => update("invoice_validity_days", Number(v) || 5)} />
            <FieldArea label="Текст футера" value={form.invoice_footer} onChange={(v) => update("invoice_footer", v)} rows={3} />
          </Card>
        </TabsContent>

        <TabsContent value="contract" className="space-y-4">
          <Card title="Параметры договора" preview="contract" onPreview={openPreview}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Предоплата, %" type="number" value={String(form.contract_prepayment_pct)} onChange={(v) => update("contract_prepayment_pct", Number(v) || 0)} />
              <Field label="Срок предоплаты, дней" type="number" value={String(form.contract_prepayment_days)} onChange={(v) => update("contract_prepayment_days", Number(v) || 0)} />
              <Field label="Без возврата, дней до даты" type="number" value={String(form.contract_cancel_days)} onChange={(v) => update("contract_cancel_days", Number(v) || 0)} />
              <Field label="Пеня за просрочку, %/день" type="number" value={String(form.contract_late_fee_pct)} onChange={(v) => update("contract_late_fee_pct", Number(v) || 0)} />
              <Field label="Город юрисдикции" value={form.contract_jurisdiction_city} onChange={(v) => update("contract_jurisdiction_city", v)} className="md:col-span-2" />
            </div>
          </Card>

          <Card title="Дополнительные разделы договора" subtitle="Добавляются после стандартных разделов (Предмет, Стоимость, Ответственность).">
            <SectionsEditor
              sections={form.contract_sections ?? []}
              onChange={(next) => update("contract_sections", next)}
            />
          </Card>

          <button
            type="button"
            onClick={() => update("contract_sections", DEFAULT_CONTRACT_SECTIONS)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Сбросить разделы к шаблону
          </button>
        </TabsContent>

        <TabsContent value="act">
          <Card title="Акт оказанных услуг" preview="act" onPreview={openPreview}>
            <Field
              label="Срок приёмки (рабочих дней)"
              type="number"
              value={String(form.act_validity_days)}
              onChange={(v) => update("act_validity_days", Number(v) || 5)}
            />
            <FieldArea
              label="Вступительный текст акта"
              value={form.act_intro}
              onChange={(v) => update("act_intro", v)}
              rows={4}
            />
            <FieldArea
              label="Текст подвала"
              value={form.act_footer}
              onChange={(v) => update("act_footer", v)}
              rows={3}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const DEFAULT_CONTRACT_SECTIONS: Section[] = [
  {
    title: "Обязанности сторон",
    paragraphs: [
      "Исполнитель обязуется: качественно и в срок оказать услуги; обеспечить наличие необходимого оборудования и персонала; соблюдать технику безопасности.",
      "Заказчик обязуется: своевременно предоставить площадку, доступ и необходимую информацию; принять оказанные услуги; произвести оплату в установленные сроки.",
    ],
  },
  {
    title: "Срок действия и прочие условия",
    paragraphs: [
      "Договор вступает в силу с момента подписания и действует до полного исполнения обязательств сторонами.",
      "Все изменения и дополнения оформляются письменными соглашениями.",
      "Договор составлен в двух экземплярах, имеющих равную юридическую силу, по одному для каждой стороны.",
    ],
  },
];

function Card({
  title, subtitle, children, preview, onPreview,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  preview?: "quote" | "invoice" | "contract" | "act";
  onPreview?: (kind: "quote" | "invoice" | "contract" | "act") => void;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {preview && onPreview && (
          <Button variant="outline" size="sm" onClick={() => onPreview(preview)}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />Открыть пример
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, className, children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        {children}
      </div>
    </div>
  );
}

function FieldArea({
  label, value, onChange, rows = 3,
}: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  const id = useId();
  return (
    <div className="mt-4">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="mt-1" />
    </div>
  );
}

function SectionsEditor({
  sections, onChange,
}: { sections: Section[]; onChange: (next: Section[]) => void }) {
  const list = sections ?? [];
  const set = (i: number, next: Partial<Section>) =>
    onChange(list.map((s, idx) => (idx === i ? { ...s, ...next } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const copy = list.slice();
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  const remove = (i: number) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...list, { title: "Новый раздел", paragraphs: [""] }]);

  return (
    <div className="space-y-3">
      {list.length === 0 && (
        <p className="text-sm text-muted-foreground">Разделы не заданы. Договор будет содержать только обязательные пункты.</p>
      )}
      {list.map((s, i) => (
        <div key={i} className="rounded-md border border-border/50 bg-background/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={s.title}
              onChange={(e) => set(i, { title: e.target.value })}
              placeholder="Название раздела"
              className="font-medium"
            />
            <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Вверх">
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Вниз">
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Удалить" className="text-rose-400 hover:text-rose-300">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            value={(s.paragraphs ?? []).join("\n\n")}
            onChange={(e) => set(i, { paragraphs: e.target.value.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean) })}
            rows={Math.max(3, (s.paragraphs ?? []).length * 2)}
            placeholder="Каждый абзац — с новой строки (разделять пустой строкой)."
            className="text-sm"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4 mr-1.5" />Добавить раздел
      </Button>
    </div>
  );
}

// Подавляем не-используемый импорт DEFAULT_DOCUMENT_SETTINGS для type-checker — используется как тип-источник
void DEFAULT_DOCUMENT_SETTINGS;

// Редактор корпоративного документа: содержание слева, живое A4-превью справа.
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, Download, FileText, Loader2, Palette, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDocumentViewer } from "@/hooks/use-document-viewer";
import { adminKeys } from "@/lib/query-keys";
import { PwBlockList } from "@/components/admin/paperwork/PwBlockList";
import { PwBlankPanel } from "@/components/admin/paperwork/PwBlankPanel";
import { PwAiPanel } from "@/components/admin/paperwork/PwAiPanel";
import { getPaperworkBlank, savePaperworkBlank, savePaperworkDocument } from "@/lib/paperwork.functions";
import type { PaperworkDetail } from "@/lib/paperwork.functions";
import {
  PW_BLOCK_LABELS, PW_DOC_TYPES, PW_DOC_TYPE_LABELS, PW_STATUSES, PW_STATUS_LABELS, pwId,
  type PwBlank, type PwBlock, type PwBlockType, type PwDocType, type PwStatus,
} from "@/lib/paperwork/model";
import { missingBlocks, pwKind } from "@/lib/paperwork/kinds";
import { applyVarsToBlocks, autoContext, documentVariables, resolveValues, varKey } from "@/lib/paperwork/variables";
import { clientLogoUrlFrom, paperworkHtml } from "@/lib/paperwork/html";
import type { CompanyProfile } from "@/lib/documents/company-profile";

export function PaperworkEditor({
  detail,
  companies,
}: {
  detail: PaperworkDetail;
  companies: CompanyProfile[];
}) {
  const qc = useQueryClient();
  const viewer = useDocumentViewer();
  const saveDoc = useServerFn(savePaperworkDocument);
  const saveBlankFn = useServerFn(savePaperworkBlank);
  const getBlank = useServerFn(getPaperworkBlank);

  const defaultCompanyId = useMemo(
    () => companies.find((c) => c.is_default)?.id ?? companies[0]?.id ?? null,
    [companies],
  );

  const [title, setTitle] = useState(detail.document.title);
  const [docNumber, setDocNumber] = useState(detail.document.doc_number);
  const [docDate, setDocDate] = useState(detail.document.doc_date);
  const [docType, setDocType] = useState<PwDocType>(detail.document.doc_type);
  const [status, setStatus] = useState<PwStatus>(detail.document.status);
  const [companyId, setCompanyId] = useState<string | null>(detail.document.company_profile_id);
  const [blocks, setBlocks] = useState<PwBlock[]>(detail.document.blocks);
  const [values, setValues] = useState<Record<string, string>>(detail.document.values);
  const [blank, setBlank] = useState<PwBlank>(detail.blank);
  const dirty = useRef(false);

  // Документ без компании подхватывает основную — иначе шапка и бланк пустые.
  useEffect(() => {
    if (!companyId && defaultCompanyId) setCompanyId(defaultCompanyId);
  }, [companyId, defaultCompanyId]);

  const companyOptions = useMemo(
    () => companies.map((c) => ({ id: c.id, name: c.name })),
    [companies],
  );
  const company = useMemo(
    () => companies.find((c) => c.id === companyId) ?? null,
    [companies, companyId],
  );

  // Настройки бланка всегда принадлежат выбранной компании.
  const blankQuery = useQuery({
    queryKey: ["paperwork-blank", companyId],
    queryFn: () => getBlank({ data: { companyId: companyId! } }),
    enabled: !!companyId && companyId !== detail.document.company_profile_id,
  });
  useEffect(() => {
    if (blankQuery.data) setBlank(blankQuery.data);
  }, [blankQuery.data]);

  useEffect(() => {
    dirty.current = true;
  }, [title, docNumber, docDate, docType, status, companyId, blocks, values]);


  const docMeta = useMemo(
    () => ({ title, doc_number: docNumber, doc_date: docDate }),
    [title, docNumber, docDate],
  );

  const kind = pwKind(docType);
  const missing = useMemo(
    () => missingBlocks(docType, blocks.map((b) => b.type as PwBlockType)),
    [docType, blocks],
  );

  const auto = useMemo(() => autoContext(company, docMeta), [company, docMeta]);
  const variables = useMemo(() => documentVariables(blocks, auto), [blocks, auto]);
  const manualVars = variables.filter((v) => v.source !== "auto");
  const resolved = useMemo(() => resolveValues(auto, values), [auto, values]);

  const previewHtml = useMemo(
    () =>
      paperworkHtml({
        doc: docMeta,
        blocks: applyVarsToBlocks(blocks, resolved),
        company,
        blank,
        clientLogoUrl: clientLogoUrlFrom(resolved),
      }),
    [docMeta, blocks, resolved, company, blank],
  );

  const plainText = useMemo(
    () => blocks.map((b) => [b.text, ...b.items, ...b.header, ...b.rows.flat()].filter(Boolean).join("\n")).join("\n\n"),
    [blocks],
  );

  const save = useMutation({
    mutationFn: () =>
      saveDoc({
        data: {
          id: detail.document.id,
          template_id: detail.document.template_id,
          company_profile_id: companyId,
          doc_type: docType,
          title,
          doc_number: docNumber,
          doc_date: docDate,
          blocks,
          values,
          status,
        },
      }),
    onSuccess: () => {
      dirty.current = false;
      qc.invalidateQueries({ queryKey: adminKeys.paperwork });
      toast.success("Документ сохранён");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBlank = useMutation({
    mutationFn: () => saveBlankFn({ data: { companyId: companyId!, settings: blank } }),
    onSuccess: () => toast.success("Настройки бланка сохранены"),
    onError: (e: Error) => toast.error(e.message),
  });

  const download = async (format: "pdf" | "docx") => {
    if (dirty.current) await save.mutateAsync();
    await viewer.openDocument(`/admin/paperwork/${detail.document.id}/render?format=${format}`, {
      auth: true,
      mode: format === "docx" ? "download" : "preview",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-[240px] flex-1 border-0 bg-transparent px-0 text-lg font-medium shadow-none focus-visible:ring-0"
          placeholder="Название документа"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as PwStatus)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PW_STATUSES.map((s) => <SelectItem key={s} value={s}>{PW_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={companyId ?? "none"} onValueChange={(v) => setCompanyId(v === "none" ? null : v)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Компания" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Без бланка</SelectItem>
            {companyOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm"><Palette className="mr-1 h-4 w-4" /> Бланк</Button>
          </SheetTrigger>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader><SheetTitle>Фирменный бланк</SheetTitle></SheetHeader>
            <div className="mt-4">
              <PwBlankPanel
                blank={blank}
                onChange={setBlank}
                onSave={() => saveBlank.mutate()}
                saving={saveBlank.isPending || blankQuery.isFetching}
                companyName={company?.name ?? null}
                hasCompanies={companyOptions.length > 0}
                clientLogoUrl={values[varKey("client_logo")] ?? ""}
                onClientLogoUrlChange={(v: string) => setValues({ ...values, [varKey("client_logo")]: v })}
              />
            </div>
          </SheetContent>
        </Sheet>


        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm"><Sparkles className="mr-1 h-4 w-4" /> AI и импорт</Button>
          </SheetTrigger>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader><SheetTitle>AI-помощник и импорт</SheetTitle></SheetHeader>
            <div className="mt-4">
              <PwAiPanel
                docType={docType}
                companyName={company?.company_brand || company?.company_legal_name || ""}
                currentText={plainText}
                onApply={(next, aiTitle, mode) => {
                  const withIds = next.map((b) => ({ ...b, id: pwId() }));
                  setBlocks(mode === "append" ? [...blocks, ...withIds] : withIds);
                  if (aiTitle && (!title || title === "Новый документ")) setTitle(aiTitle);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => download("docx")}>
            <FileText className="mr-1 h-4 w-4" /> DOCX
          </Button>
          <Button variant="outline" onClick={() => download("pdf")}>
            <Download className="mr-1 h-4 w-4" /> PDF
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Сохранить
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,540px)]">
        <div className="space-y-4">
          <Collapsible>
            <div className="rounded-lg border border-border bg-card">
              <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-sm">
                <span className="text-muted-foreground">
                  Реквизиты документа · {PW_DOC_TYPE_LABELS[docType]}
                  {docNumber ? ` · № ${docNumber}` : ""}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="flex flex-wrap gap-3 border-t border-border p-3">
                  <div className="w-48 space-y-1">
                    <Label className="text-xs">Вид документа</Label>
                    <Select value={docType} onValueChange={(v) => setDocType(v as PwDocType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PW_DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{PW_DOC_TYPE_LABELS[t]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {kind.numbered && (
                    <div className="w-32 space-y-1">
                      <Label className="text-xs">Номер</Label>
                      <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="12/25" />
                    </div>
                  )}
                  <div className="w-40 space-y-1">
                    <Label className="text-xs">Дата</Label>
                    <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
                  </div>

                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {!!missing.length && (
            <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              Для этого вида документа обычно нужны блоки: {missing.map((m) => PW_BLOCK_LABELS[m]).join(", ")}.
            </p>
          )}

          <PwBlockList blocks={blocks} onChange={setBlocks} suggested={kind.starterBlocks} />

          {!!manualVars.length && (
            <div className="space-y-2 rounded-lg border border-border bg-card p-3">
              <p className="text-sm font-medium">Поля документа</p>
              {manualVars.map((v) => (
                <div key={v.key} className="flex flex-wrap items-center gap-3">
                  <code className="rounded bg-muted px-2 py-1 text-xs">{`{{${v.key}}}`}</code>
                  <Input
                    className="min-w-[220px] flex-1"
                    value={values[varKey(v.key)] ?? ""}
                    placeholder="Значение"
                    onChange={(e) => setValues({ ...values, [varKey(v.key)]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
            <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">Превью A4</div>
            <iframe
              title="Превью документа"
              srcDoc={previewHtml}
              className="h-[75vh] w-full bg-white"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

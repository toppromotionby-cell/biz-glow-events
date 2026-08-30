// Мастер создания приказа: журнал → вид приказа → данные.
// Номер подставляется автоматически по журналу и году, тексты собираются реестром видов.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminKeys } from "@/lib/query-keys";
import { listHrEmployees } from "@/lib/hr.functions";
import { nextOrderNumber } from "@/lib/paperwork-orders.functions";
import {
  ORDER_JOURNALS,
  ORDER_JOURNAL_LABELS,
  orderKindsOf,
  type OrderForm,
  type OrderJournal,
  type OrderKind,
  type OrderPerson,
} from "@/lib/paperwork/orders/registry";

export type OrderSubmit = {
  kind: string;
  docNumber: string;
  docDate: string;
  employeeId: string | null;
  values: Record<string, string>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy?: boolean;
  onSubmit: (args: OrderSubmit) => void;
  /** Пустой приказ без мастера. */
  onBlank: () => void;
};

const today = () => new Date().toISOString().slice(0, 10);

export function OrderWizardDialog({ open, onOpenChange, busy, onSubmit, onBlank }: Props) {
  const [journal, setJournal] = useState<OrderJournal>("k");
  const [kindCode, setKindCode] = useState("");
  const [docDate, setDocDate] = useState(today());
  const [docNumber, setDocNumber] = useState("");
  const [numberTouched, setNumberTouched] = useState(false);
  const [form, setForm] = useState<OrderForm>({});

  const kinds = useMemo(() => orderKindsOf(journal), [journal]);
  const kind: OrderKind | undefined = kinds.find((k) => k.code === kindCode);

  // Список работников (реестр кадров) — источник ФИО и должностей.
  const listEmployees = useServerFn(listHrEmployees);
  const emps = useQuery({
    queryKey: [...adminKeys.paperwork, "orders", "employees"],
    queryFn: () => listEmployees({ data: {} }),
    enabled: open,
  });

  const nextNumber = useServerFn(nextOrderNumber);
  const numberQuery = useQuery({
    queryKey: [...adminKeys.paperwork, "orders", "next", journal, docDate.slice(0, 4)],
    queryFn: () => nextNumber({ data: { journal, year: Number(docDate.slice(0, 4)) } }),
    enabled: open,
  });

  useEffect(() => {
    if (!numberTouched && numberQuery.data) setDocNumber(numberQuery.data.number);
  }, [numberQuery.data, numberTouched]);

  useEffect(() => {
    if (!open) {
      setKindCode("");
      setForm({});
      setNumberTouched(false);
    }
  }, [open]);

  useEffect(() => {
    if (!kind) return;
    const init: OrderForm = {};
    for (const f of kind.fields) {
      if (f.type === "employee" || f.type === "employees") init[f.key] = [] as OrderPerson[];
      else init[f.key] = f.defaultValue ?? "";
    }
    setForm(init);
  }, [kind]);

  const setField = (key: string, value: OrderForm[string]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const peopleOf = (key: string): OrderPerson[] => {
    const v = form[key];
    return Array.isArray(v) ? v : [];
  };

  const missing = kind
    ? kind.fields.filter((f) => {
        if (!f.required) return false;
        const v = form[f.key];
        return Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
      })
    : [];

  const submit = () => {
    if (!kind || missing.length) return;
    const first = peopleOf("people")[0];
    const employeeId = first?.fullName
      ? ((emps.data ?? []).find((e) => e.full_name === first.fullName)?.id ?? null)
      : null;
    onSubmit({
      kind: kind.code,
      docNumber: docNumber.trim(),
      docDate,
      employeeId,
      values: {
        "Номер документа": docNumber.trim(),
        "Дата": docDate,
        "Должность подписанта": "Директор",
        ...kind.buildValues(form),
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новый приказ</DialogTitle>
          <DialogDescription>
            Выберите журнал регистрации и вид приказа — текст соберётся автоматически.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Журнал регистрации</Label>
              <Select
                value={journal}
                onValueChange={(v) => {
                  setJournal(v as OrderJournal);
                  setKindCode("");
                  setNumberTouched(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_JOURNALS.map((j) => (
                    <SelectItem key={j} value={j}>
                      {ORDER_JOURNAL_LABELS[j]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Вид приказа</Label>
              <Select value={kindCode} onValueChange={setKindCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите вид" />
                </SelectTrigger>
                <SelectContent>
                  {kinds.map((k) => (
                    <SelectItem key={k.code} value={k.code}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Номер приказа</Label>
              <Input
                value={docNumber}
                onChange={(e) => {
                  setNumberTouched(true);
                  setDocNumber(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Дата приказа</Label>
              <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
            </div>
          </div>

          {kind && <p className="text-xs text-muted-foreground">{kind.description}</p>}

          {kind?.fields.map((f) => {
            if (f.type === "employee" || f.type === "employees") {
              const list = peopleOf(f.key);
              const multiple = f.type === "employees";
              const rows = list.length ? list : [{ fullName: "", position: "" }];
              const update = (i: number, patch: Partial<OrderPerson>) => {
                const next = rows.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
                setField(f.key, next);
              };
              return (
                <div key={f.key} className="space-y-2 rounded-lg border border-border p-3">
                  <Label>{f.label}</Label>
                  {rows.map((p, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
                      <Select
                        value={p.fullName}
                        onValueChange={(v) => {
                          const emp = (emps.data ?? []).find((e) => e.full_name === v);
                          update(i, { fullName: v, position: emp?.position ?? p.position });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Работник из реестра" />
                        </SelectTrigger>
                        <SelectContent>
                          {(emps.data ?? []).map((e) => (
                            <SelectItem key={e.id} value={e.full_name}>
                              {e.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={p.position}
                        onChange={(e) => update(i, { position: e.target.value })}
                        placeholder="Должность"
                      />
                      {multiple && (
                        <div className="flex gap-1">
                          <Input
                            value={p.amount ?? ""}
                            onChange={(e) => update(i, { amount: e.target.value })}
                            placeholder="Сумма"
                            className="w-24"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Убрать"
                            onClick={() => setField(f.key, rows.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {multiple && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setField(f.key, [...rows, { fullName: "", position: "" }])}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Добавить работника
                    </Button>
                  )}
                </div>
              );
            }
            const value = String(form[f.key] ?? "");
            return (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}</Label>
                {f.type === "multiline" ? (
                  <Textarea
                    rows={3}
                    value={value}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder={f.hint}
                  />
                ) : (
                  <Input
                    type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                    value={value}
                    onChange={(e) => setField(f.key, e.target.value)}
                    placeholder={f.hint}
                  />
                )}
                {f.hint && f.type !== "multiline" && (
                  <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onBlank} disabled={busy}>
            Пустой приказ
          </Button>
          <Button onClick={submit} disabled={busy || !kind || missing.length > 0}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Создать приказ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

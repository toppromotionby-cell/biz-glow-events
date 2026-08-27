// Админка промокодов.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { promoCodeSchema } from "@/lib/admin/schemas";
import { zodFieldErrors, mapServerError, type FieldErrors } from "@/lib/admin/form-errors";

import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import type { SaveState } from "@/components/admin/SaveStatus";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { adminKeys } from "@/lib/query-keys";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminListPanel } from "@/components/admin/AdminListPanel";
import { AdminEditorShell, AdminEmptyEditor } from "@/components/admin/AdminEditorShell";
import { Field } from "@/components/admin/Field";
import { StatusPill } from "@/components/admin/StatusPill";
import { persistSortOrder } from "@/lib/sort-order";

export const Route = createFileRoute("/admin/promo")({ component: Page });

import type { Database } from "@/integrations/supabase/types";
type Row = Database["public"]["Tables"]["promo_codes"]["Row"];

function Page() {
  const qc = useQueryClient();
  const [sel, setSel] = useState<Row | null>(null);

  const { data: items = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: adminKeys.promo,
    queryFn: async () => {
      const { data, error: e } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
      if (e) throw e;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const code = `PROMO${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase.from("promo_codes").insert({
        code, discount_type: "percent", discount_value: 10, active: false,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: adminKeys.promo }); setSel(row); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promo_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: adminKeys.promo }); setSel(null); toast.success("Удалён"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Промокоды"
        help="promo-codes"
        subtitle={`${items.length} кодов`}
        icon={<Tag className="h-7 w-7" />}
        action={<Button disabled={create.isPending} onClick={() => create.mutate()} className="btn-primary-gradient"><Plus className="h-4 w-4 mr-2" />Создать</Button>}
      />

      <div className="grid lg:grid-cols-[320px_1fr] gap-5">
        <AdminListPanel
          items={items as Row[]}
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={() => void refetch()}
          emptyText="Нет промокодов"
          onReorder={async (ids) => {
            try { await persistSortOrder("promo_codes", ids); qc.invalidateQueries({ queryKey: adminKeys.promo }); }
            catch (e) { toast.error((e as Error).message); throw e; }
          }}
          renderItem={(it, handle) => (
            <div className={`flex items-center gap-1 rounded-lg transition ${sel?.id === it.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-muted/40"}`}>
              {handle}
              <button
                type="button"
                onClick={() => setSel(it)}
                aria-pressed={sel?.id === it.id}
                className="flex-1 text-left p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
              >
                <div className="font-mono font-medium truncate">{it.code}</div>
                <div className="text-xs opacity-70 flex items-center gap-2">
                  <span>{it.discount_type === "percent" ? `${it.discount_value}%` : `${it.discount_value} BYN`}</span>
                  <span>· {it.used_count}{it.max_uses ? `/${it.max_uses}` : ""}</span>
                  <StatusPill tone={it.active ? "success" : "muted"}>{it.active ? "активен" : "выкл"}</StatusPill>
                </div>
              </button>
            </div>
          )}
        />

        {sel ? <Editor key={sel.id} row={sel} onDelete={() => del.mutate(sel.id)} /> : (
          <AdminEmptyEditor
            title="Промокод не выбран"
            description="Выберите код из списка слева или создайте новый — он появится с дефолтной скидкой 10%."
            icon={<Tag className="h-6 w-6" aria-hidden="true" />}
            action={
              <Button disabled={create.isPending} onClick={() => create.mutate()} className="btn-primary-gradient">
                <Plus className="h-4 w-4 mr-2" />Создать промокод
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

function Editor({ row, onDelete }: { row: Row; onDelete: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<Row>(row);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  // Возврат к другой записи в списке — сбрасываем форму и статус.
  useEffect(() => {
    setF(row);
    setSaveState("idle");
    setTouched(new Set());
    setServerErrors({});
  }, [row]);

  // Живая валидация: сохранить невалидный промокод нельзя.
  const validation = useMemo(() => {
    const r = promoCodeSchema.safeParse({
      code: String(f.code ?? "").trim().toUpperCase(),
      description: f.description ?? "",
      discount_type: f.discount_type,
      discount_value: Number(f.discount_value) || 0,
      min_order_total: Number(f.min_order_total) || 0,
      valid_from: f.valid_from || null,
      valid_to: f.valid_to || null,
      max_uses: f.max_uses == null ? null : Number(f.max_uses),
      active: !!f.active,
    });
    return r.success
      ? { ok: true as const, errors: {} as FieldErrors }
      : { ok: false as const, errors: zodFieldErrors(r.error) };
  }, [f]);

  // Ошибку показываем только для полей, которых пользователь коснулся, плюс ошибки сервера.
  const errors: FieldErrors = {
    ...Object.fromEntries(Object.entries(validation.errors).filter(([k]) => touched.has(k))),
    ...serverErrors,
  };

  const patch = (p: Partial<Row>) => {
    const keys = Object.keys(p);
    setTouched((prev) => new Set([...prev, ...keys]));
    setServerErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev;
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
    setF((prev) => ({ ...prev, ...p }));

    setSaveState("dirty");
  };

  const [saveErrorText, setSaveErrorText] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!validation.ok) throw new Error("Исправьте ошибки в форме");
      const patch = {
        code: String(f.code).trim().toUpperCase(),
        description: f.description || null,
        discount_type: f.discount_type,
        discount_value: Number(f.discount_value) || 0,
        min_order_total: Number(f.min_order_total) || 0,
        valid_from: f.valid_from || null,
        valid_to: f.valid_to || null,
        max_uses: f.max_uses ? Number(f.max_uses) : null,
        active: !!f.active,
      };
      const { error } = await supabase.from("promo_codes").update(patch).eq("id", row.id);
      if (error) throw error;
    },
    onMutate: () => { setSaveState("saving"); setSaveErrorText(null); },
    onSuccess: () => {
      setSaveState("saved");
      qc.invalidateQueries({ queryKey: adminKeys.promo });
      toast.success("Сохранено");
    },
    onError: (e: unknown) => {
      // Ошибку БД (например, дубль кода) вешаем на конкретное поле.
      const mapped = mapServerError(e);
      if (mapped.field) setServerErrors((prev) => ({ ...prev, [mapped.field as string]: mapped.message }));
      setSaveState("error");
      setSaveErrorText(mapped.message);
      toast.error(mapped.message);
    },
  });


  // Защита от потери правок: и при переходах внутри админки, и при закрытии вкладки.
  const { guardDialog } = useUnsavedGuard(saveState === "dirty" || saveState === "error");

  // Ctrl/Cmd+S — сохранить сразу, как в остальных редакторах.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s")) return;
      e.preventDefault();
      if (!save.isPending) save.mutate();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  return (
    <>
    {guardDialog}
    <AdminEditorShell
      title={<span className="font-mono text-xl">{f.code}</span>}
      switches={
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={!!f.active} onCheckedChange={(v) => patch({ active: v })} /> Активен
        </label>
      }
      onDelete={onDelete}
      onSave={() => save.mutate()}
      saving={save.isPending}
      saveState={saveState}
      saveDisabled={!validation.ok}
      errorMessage={saveErrorText}
    >
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Код" required error={errors["code"]} hint="Латиница в верхнем регистре, цифры и дефис">
          <Input value={f.code ?? ""} onChange={(e) => patch({ code: e.target.value.toUpperCase() })} className="font-mono" aria-invalid={!!errors["code"]} />
        </Field>
        <Field label="Тип скидки" required error={errors["discount_type"]}>
          <Select value={f.discount_type} onValueChange={(v) => patch({ discount_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Процент (%)</SelectItem>
              <SelectItem value="fixed">Фикс. сумма (BYN)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Размер скидки" required error={errors["discount_value"]}>
          <Input type="number" min={0} value={f.discount_value ?? 0} onChange={(e) => patch({ discount_value: Number(e.target.value) || 0 })} aria-invalid={!!errors["discount_value"]} />
        </Field>
        <Field label="Мин. сумма заказа" error={errors["min_order_total"]}>
          <Input type="number" min={0} value={f.min_order_total ?? 0} onChange={(e) => patch({ min_order_total: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Действует с" error={errors["valid_from"]}>
          <Input type="datetime-local" value={f.valid_from?.slice(0, 16) ?? ""} onChange={(e) => patch({ valid_from: e.target.value })} />
        </Field>
        <Field label="Действует до" error={errors["valid_to"]}>
          <Input type="datetime-local" value={f.valid_to?.slice(0, 16) ?? ""} onChange={(e) => patch({ valid_to: e.target.value })} aria-invalid={!!errors["valid_to"]} />
        </Field>
        <Field label="Лимит применений" error={errors["max_uses"]}>
          <Input type="number" min={1} placeholder="без лимита" value={f.max_uses ?? ""} onChange={(e) => patch({ max_uses: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Использовано"><Input value={f.used_count ?? 0} readOnly className="opacity-70" /></Field>
      </div>

      <Field label="Описание" hint="Для внутреннего использования" error={errors["description"]}>
        <Textarea rows={3} value={f.description ?? ""} onChange={(e) => patch({ description: e.target.value })} />
      </Field>

    </AdminEditorShell>
    </>
  );
}


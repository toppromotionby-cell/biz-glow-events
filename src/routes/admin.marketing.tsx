import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UtmBuilder } from "@/components/admin/UtmBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEditorShell } from "@/components/admin/AdminEditorShell";
import { Field } from "@/components/admin/Field";
import { StatusPill } from "@/components/admin/StatusPill";

import type { Database } from "@/integrations/supabase/types";
import { fmtCurrency } from "@/lib/formatters";

export const Route = createFileRoute("/admin/marketing")({
  component: MarketingPage,
});

type Row = Database["public"]["Tables"]["campaigns"]["Row"];

function MarketingPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Row | null>(null);

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => (await supabase.from("campaigns").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("campaigns").insert({ name: "Новая кампания", active: true }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => { qc.invalidateQueries({ queryKey: ["campaigns"] }); setSelected(row); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); setSelected(null); toast.success("Удалено"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Маркетинг"
        subtitle="Кампании, UTM-источники и аналитика трафика."
        action={<Button onClick={() => create.mutate()} className="btn-primary-gradient"><Plus className="h-4 w-4 mr-2" />Кампания</Button>}
      />

      <UtmBuilder />

      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <div className="glass rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm" aria-label="Маркетинговые кампании">
            <thead className="admin-table-head">
              <tr><th scope="col" className="text-left p-3">Кампания</th><th scope="col" className="text-left p-3">Источник</th><th scope="col" className="text-right p-3">Бюджет</th><th scope="col" className="text-right p-3">Цель</th><th scope="col" className="text-left p-3">Статус</th></tr>
            </thead>
            <tbody>
              {campaigns.map((c: Row) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(c); } }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Кампания ${c.name}`}
                  aria-pressed={selected?.id === c.id}
                  className={`border-t border-border/40 cursor-pointer hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${selected?.id === c.id ? "bg-muted/30" : ""}`}
                >
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3">{c.source ?? "—"}</td>
                  <td className="p-3 text-right">{fmtCurrency(c.budget)}</td>
                  <td className="p-3 text-right">{c.goal_conversions ?? 0}</td>
                  <td className="p-3">
                    <StatusPill tone={c.active ? "success" : "muted"}>{c.active ? "активна" : "выключена"}</StatusPill>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Пока нет кампаний</td></tr>}
            </tbody>
          </table>
        </div>

        {selected && <CampaignEditor key={selected.id} item={selected} onDelete={() => remove.mutate(selected.id)} onSaved={() => qc.invalidateQueries({ queryKey: ["campaigns"] })} />}
      </div>
    </div>
  );
}

function CampaignEditor({ item, onSaved, onDelete }: { item: Row; onSaved: () => void; onDelete: () => void }) {
  const [form, setForm] = useState({ ...item });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("campaigns").update({
      name: form.name, source: form.source || null,
      budget: Number(form.budget ?? 0), goal_conversions: Number(form.goal_conversions ?? 0),
      start_date: form.start_date || null, end_date: form.end_date || null, active: !!form.active,
    }).eq("id", item.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Сохранено"); onSaved();
  };

  return (
    <AdminEditorShell
      switches={
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          {form.active ? "Активна" : "Выключена"}
        </label>
      }
      onDelete={onDelete}
      onSave={save}
      saving={saving}
    >
      <Field label="Название"><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Источник (utm_source)"><Input value={form.source ?? ""} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="google, instagram..." /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Бюджет, BYN"><Input type="number" value={form.budget ?? 0} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></Field>
        <Field label="Цель, конверсий"><Input type="number" value={form.goal_conversions ?? 0} onChange={(e) => setForm({ ...form, goal_conversions: e.target.value })} /></Field>
        <Field label="Старт"><Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
        <Field label="Финиш"><Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></Field>
      </div>
    </AdminEditorShell>
  );
}

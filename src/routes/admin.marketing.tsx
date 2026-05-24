import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UtmBuilder } from "@/components/admin/UtmBuilder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

export const Route = createFileRoute("/admin/marketing")({
  component: MarketingPage,
});

function MarketingPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);

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
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold gradient-text">Маркетинг</h1>
          <p className="text-sm text-muted-foreground">Кампании, UTM-источники и аналитика трафика.</p>
        </div>
        <Button onClick={() => create.mutate()} className="bg-gradient-primary glow-primary"><Plus className="h-4 w-4 mr-2" />Кампания</Button>
      </header>

      <UtmBuilder />

      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <div className="glass rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
              <tr><th className="text-left p-3">Кампания</th><th className="text-left p-3">Источник</th><th className="text-right p-3">Бюджет</th><th className="text-right p-3">Цель</th><th className="text-left p-3">Статус</th></tr>
            </thead>
            <tbody>
              {campaigns.map((c: any) => (
                <tr key={c.id} onClick={() => setSelected(c)} className={`border-t border-border/40 cursor-pointer hover:bg-muted/20 ${selected?.id === c.id ? "bg-muted/30" : ""}`}>
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3">{c.source ?? "—"}</td>
                  <td className="p-3 text-right">{Number(c.budget ?? 0).toLocaleString("ru-BY")} BYN</td>
                  <td className="p-3 text-right">{c.goal_conversions ?? 0}</td>
                  <td className="p-3">{c.active ? "● активна" : "○ выключена"}</td>
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

function CampaignEditor({ item, onSaved, onDelete }: { item: any; onSaved: () => void; onDelete: () => void }) {
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
    <div className="glass rounded-xl p-5 space-y-4 h-fit">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><span className="text-sm">{form.active ? "Активна" : "Выключена"}</span></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
          <Button size="sm" onClick={save} disabled={saving} className="bg-gradient-primary glow-primary"><Save className="h-4 w-4 mr-1" />{saving ? "..." : "Сохранить"}</Button>
        </div>
      </div>
      <div><Label>Название</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div><Label>Источник (utm_source)</Label><Input value={form.source ?? ""} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="google, instagram..." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Бюджет, BYN</Label><Input type="number" value={form.budget ?? 0} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
        <div><Label>Цель, конверсий</Label><Input type="number" value={form.goal_conversions ?? 0} onChange={(e) => setForm({ ...form, goal_conversions: e.target.value })} /></div>
        <div><Label>Старт</Label><Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
        <div><Label>Финиш</Label><Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
      </div>
    </div>
  );
}

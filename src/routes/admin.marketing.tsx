import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/marketing")({
  component: MarketingPage,
});

function MarketingPage() {
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => (await supabase.from("campaigns").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-display font-bold gradient-text">Маркетинг</h1>
        <p className="text-sm text-muted-foreground">Управление кампаниями и UTM-источниками. Полная панель — Этап 3.</p>
      </header>
      <div className="glass rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
            <tr><th className="text-left p-3">Кампания</th><th className="text-left p-3">Источник</th><th className="text-right p-3">Бюджет</th><th className="text-right p-3">Цель</th><th className="text-left p-3">Статус</th></tr>
          </thead>
          <tbody>
            {campaigns.map((c: any) => (
              <tr key={c.id} className="border-t border-border/40">
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
    </div>
  );
}

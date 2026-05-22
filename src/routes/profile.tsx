import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Личный кабинет — event-hub.by" }, { name: "robots", content: "noindex,follow" }] }),
});

function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(p);
      const { data: o } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      setOrders(o ?? []);
    })();
  }, [user, loading, navigate]);

  if (loading || !profile) return <div className="container mx-auto px-4 py-16">Загрузка...</div>;

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Здравствуйте, {profile.full_name}</h1>
        <p className="text-muted-foreground">{profile.email}{profile.company && ` · ${profile.company}`}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-5">
          <h3 className="font-semibold mb-3">Контактные данные</h3>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-muted-foreground">Телефон</dt><dd>{profile.phone}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd>{profile.email}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Компания</dt><dd>{profile.company ?? "—"}</dd></div>
          </dl>
        </div>
        <div className="glass rounded-xl p-5">
          <h3 className="font-semibold mb-3">Статистика</h3>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-muted-foreground">Заказов</dt><dd>{orders.length}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Активных</dt><dd>{orders.filter(o => !["paid","cancelled","completed"].includes(o.status)).length}</dd></div>
          </dl>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-display font-semibold mb-4">История заявок</h2>
        {orders.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center text-muted-foreground">У вас пока нет заявок</div>
        ) : (
          <div className="space-y-2">
            {orders.map(o => (
              <div key={o.id} className="glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">Заказ #{o.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("ru-BY")}</div>
                </div>
                <div className="text-sm px-3 py-1 rounded-full glass border border-primary/30">{o.status}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" }))}>
        Выйти из аккаунта
      </Button>
    </div>
  );
}

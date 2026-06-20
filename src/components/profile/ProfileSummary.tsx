import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { fmtCurrency } from "@/lib/formatters";
import type { OrderRow, ProfileRow } from "./types";

export function ProfileSummary({ profile, orders }: { profile: ProfileRow; orders: OrderRow[] }) {
  const navigate = useNavigate();
  const active = orders.filter((o) => !["paid", "cancelled", "completed"].includes(o.status));
  const totalSum = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="glass rounded-xl p-5">
        <h3 className="font-semibold mb-3">Контактные данные</h3>
        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Телефон</dt><dd className="truncate">{profile.phone}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Email</dt><dd className="truncate">{profile.email}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Компания</dt><dd className="truncate">{profile.company ?? "—"}</dd></div>
        </dl>
      </div>
      <div className="glass rounded-xl p-5">
        <h3 className="font-semibold mb-3">Заявки</h3>
        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between"><dt className="text-muted-foreground">Всего</dt><dd>{orders.length}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Активных</dt><dd>{active.length}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">На сумму</dt><dd>{fmtCurrency(totalSum)}</dd></div>
        </dl>
      </div>
      <div className="glass rounded-xl p-5 flex flex-col gap-2">
        <h3 className="font-semibold mb-1">Действия</h3>
        <Button asChild size="sm" variant="outline"><Link to="/cart">Корзина</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/equipment">Каталог</Link></Button>
        <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" }))}>Выйти</Button>
        <div className="pt-1"><ThemeToggle /></div>
      </div>
    </div>
  );
}

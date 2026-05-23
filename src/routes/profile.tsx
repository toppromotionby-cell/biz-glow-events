import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ChevronDown, ChevronUp, Package, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { updateOwnOrder, deleteOwnOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "Личный кабинет — event-hub.by" }, { name: "robots", content: "noindex,follow" }] }),
});

const STATUS_LABEL: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  quoted: "Смета выслана",
  confirmed: "Подтверждена",
  paid: "Оплачена",
  completed: "Завершена",
  cancelled: "Отменена",
};

const STATUS_TONE: Record<string, string> = {
  new: "border-primary/40 text-primary",
  in_progress: "border-amber-400/40 text-amber-400",
  quoted: "border-sky-400/40 text-sky-400",
  confirmed: "border-emerald-400/40 text-emerald-400",
  paid: "border-emerald-500/50 text-emerald-500",
  completed: "border-muted-foreground/40 text-muted-foreground",
  cancelled: "border-destructive/40 text-destructive",
};

function formatBYN(n: number | null | undefined) {
  return new Intl.NumberFormat("ru-BY", { style: "currency", currency: "BYN", maximumFractionDigits: 0 }).format(Number(n ?? 0));
}

function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, { items: any[]; timeline: any[] }>>({});
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ client_name: "", client_phone: "", client_email: "", client_company: "", event_date: "", notes: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const updateFn = useServerFn(updateOwnOrder);
  const deleteFn = useServerFn(deleteOwnOrder);

  async function reloadOrders() {
    const { data: o } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders(o ?? []);
  }

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(p);
      await reloadOrders();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, navigate]);

  async function toggle(orderId: string) {
    if (expanded === orderId) { setExpanded(null); return; }
    setExpanded(orderId);
    if (!details[orderId]) {
      const [{ data: items }, { data: timeline }] = await Promise.all([
        supabase.from("order_items").select("*").eq("order_id", orderId),
        supabase.from("order_timeline").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
      ]);
      setDetails((d) => ({ ...d, [orderId]: { items: items ?? [], timeline: timeline ?? [] } }));
    }
  }

  function openEdit(o: any) {
    setEditing(o);
    setEditForm({
      client_name: o.client_name ?? "",
      client_phone: o.client_phone ?? "",
      client_email: o.client_email ?? "",
      client_company: o.client_company ?? "",
      event_date: o.event_date ?? "",
      notes: o.notes ?? "",
    });
  }

  async function submitEdit() {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await updateFn({ data: {
        id: editing.id,
        client_name: editForm.client_name.trim(),
        client_phone: editForm.client_phone.trim(),
        client_email: editForm.client_email.trim(),
        client_company: editForm.client_company.trim() || null,
        event_date: editForm.event_date || null,
        notes: editForm.notes.trim() || null,
      }});
      toast.success("Заявка обновлена");
      setEditing(null);
      setDetails((d) => { const c = { ...d }; delete c[editing.id]; return c; });
      await reloadOrders();
    } catch (e: any) {
      toast.error(e?.message ?? "Ошибка сохранения");
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteFn({ data: { id: deleteId } });
      toast.success("Заявка удалена");
      setOrders((arr) => arr.filter((x) => x.id !== deleteId));
      setDeleteId(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  }

  const canEdit = (status: string) => ["new", "consultation", "estimate"].includes(status);


  if (loading || !profile) return <div className="container mx-auto px-4 py-16">Загрузка...</div>;

  const active = orders.filter((o) => !["paid", "cancelled", "completed"].includes(o.status));
  const totalSum = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Здравствуйте, {profile.full_name}</h1>
        <p className="text-muted-foreground">{profile.email}{profile.company && ` · ${profile.company}`}</p>
      </div>

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
            <div className="flex justify-between"><dt className="text-muted-foreground">На сумму</dt><dd>{formatBYN(totalSum)}</dd></div>
          </dl>
        </div>
        <div className="glass rounded-xl p-5 flex flex-col gap-2">
          <h3 className="font-semibold mb-1">Действия</h3>
          <Button asChild size="sm" variant="outline"><Link to="/cart">Корзина</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/equipment">Каталог</Link></Button>
          <Button size="sm" variant="ghost" onClick={() => supabase.auth.signOut().then(() => navigate({ to: "/" }))}>Выйти</Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChangePasswordCard />
        <div className="glass rounded-xl p-6 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold mb-1">Тема оформления</h3>
            <p className="text-sm text-muted-foreground">Светлая, тёмная или системная</p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-display font-semibold mb-4">История заявок</h2>
        {orders.length === 0 ? (
          <div className="glass rounded-xl p-10 text-center">
            <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">У вас пока нет заявок</p>
            <Button asChild><Link to="/equipment">Перейти в каталог</Link></Button>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => {
              const isOpen = expanded === o.id;
              const d = details[o.id];
              return (
                <div key={o.id} className="glass rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggle(o.id)}
                    className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-foreground/5 transition"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">Заявка #{o.id.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString("ru-BY")}
                        {o.event_date && ` · мероприятие ${new Date(o.event_date).toLocaleDateString("ru-BY")}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {o.total > 0 && <div className="text-sm tabular-nums">{formatBYN(o.total)}</div>}
                      <div className={`text-xs px-3 py-1 rounded-full border ${STATUS_TONE[o.status] ?? "border-border"}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </div>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border/50 p-4 space-y-4 bg-background/30">
                      {!d ? (
                        <div className="text-sm text-muted-foreground">Загрузка...</div>
                      ) : (
                        <>
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Позиции ({d.items.length})</h4>
                            {d.items.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Без позиций</p>
                            ) : (
                              <ul className="text-sm divide-y divide-border/40">
                                {d.items.map((it) => (
                                  <li key={it.id} className="py-2 flex justify-between gap-3">
                                    <span className="truncate">{it.title} <span className="text-muted-foreground">× {it.qty}</span></span>
                                    <span className="tabular-nums shrink-0">{formatBYN(Number(it.price) * it.qty)}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {d.timeline.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2">История</h4>
                              <ol className="text-xs space-y-1.5">
                                {d.timeline.map((t) => (
                                  <li key={t.id} className="flex gap-3">
                                    <span className="text-muted-foreground tabular-nums shrink-0">
                                      {new Date(t.created_at).toLocaleString("ru-BY", { dateStyle: "short", timeStyle: "short" })}
                                    </span>
                                    <span>{t.event}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                          {o.notes && (
                            <div>
                              <h4 className="text-sm font-semibold mb-1">Комментарий</h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{o.notes}</p>
                            </div>
                          )}
                          {canEdit(o.status) && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
                              <Button size="sm" variant="outline" onClick={() => openEdit(o)}>
                                <Pencil className="h-3.5 w-3.5 mr-1.5" /> Редактировать
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(o.id)}>
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Удалить
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Редактирование заявки</DialogTitle>
            <DialogDescription>Изменения будут отправлены менеджеру.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ed-name">Имя</Label>
              <Input id="ed-name" value={editForm.client_name} onChange={(e) => setEditForm((f) => ({ ...f, client_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ed-phone">Телефон</Label>
                <Input id="ed-phone" value={editForm.client_phone} onChange={(e) => setEditForm((f) => ({ ...f, client_phone: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ed-email">Email</Label>
                <Input id="ed-email" type="email" value={editForm.client_email} onChange={(e) => setEditForm((f) => ({ ...f, client_email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ed-company">Компания</Label>
                <Input id="ed-company" value={editForm.client_company} onChange={(e) => setEditForm((f) => ({ ...f, client_company: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ed-date">Дата мероприятия</Label>
                <Input id="ed-date" type="date" value={editForm.event_date} onChange={(e) => setEditForm((f) => ({ ...f, event_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ed-notes">Комментарий</Label>
              <Textarea id="ed-notes" rows={3} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>Отмена</Button>
            <Button onClick={submitEdit} disabled={savingEdit}>{savingEdit ? "Сохранение..." : "Сохранить"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить заявку?</AlertDialogTitle>
            <AlertDialogDescription>
              Заявка и её позиции будут удалены безвозвратно. Менеджер получит уведомление.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

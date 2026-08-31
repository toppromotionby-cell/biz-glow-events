import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ChangePasswordCard } from "@/components/ChangePasswordCard";
import { updateOwnOrder, deleteOwnOrder } from "@/lib/orders.functions";
import { maxQtyForItem } from "@/lib/pricing";
import { addToCart, clearCart, type CartEntityType } from "@/lib/cart";
import { ProfileSummary } from "@/components/profile/ProfileSummary";
import { OrderHistoryList } from "@/components/profile/OrderHistoryList";
import { EditOrderDialog } from "@/components/profile/EditOrderDialog";
import { DeleteOrderDialog } from "@/components/profile/DeleteOrderDialog";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import type {
  EditOrderForm,
  OrderDetails,
  OrderItemRow,
  OrderRow,
  ProfileRow,
} from "@/components/profile/types";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "Личный кабинет — event-hub.by" },
      { name: "description", content: "Личный кабинет event-hub.by: ваши заявки, заказы оборудования, статусы и контактные данные в одном месте." },
      { property: "og:title", content: "Личный кабинет — event-hub.by" },
      { property: "og:description", content: "Управляйте заявками и заказами оборудования в личном кабинете event-hub.by." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
});

const EMPTY_EDIT: EditOrderForm = {
  client_name: "", client_phone: "", client_email: "",
  client_company: "", event_date: "", notes: "",
};

function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, OrderDetails>>({});
  const [editing, setEditing] = useState<OrderRow | null>(null);
  const [editForm, setEditForm] = useState<EditOrderForm>(EMPTY_EDIT);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    const meta = user?.user_metadata as { must_change_password?: boolean } | undefined;
    setMustChangePassword(Boolean(meta?.must_change_password));
  }, [user]);

  const updateFn = useServerFn(updateOwnOrder);
  const deleteFn = useServerFn(deleteOwnOrder);

  async function reloadOrders() {
    const { data: o } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders((o ?? []) as OrderRow[]);
  }

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile((p ?? null) as ProfileRow | null);
      await reloadOrders();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, navigate]);

  // Refs стабилизируют realtime-подписку — иначе на каждом рендере она бы пересоздавалась.
  const detailsRef = useRef<Record<string, OrderDetails>>({});
  useEffect(() => { detailsRef.current = details; }, [details]);

  // Debounce: при шквале realtime-событий (пакетная правка заказа админом) обновляем один раз.
  const debouncedReloadOrders = useDebouncedCallback(() => { reloadOrders(); }, 400);
  const debouncedRefreshDetails = useDebouncedCallback((oid: string) => { refreshDetails(oid); }, 300);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`profile-orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, (payload) => {
        debouncedReloadOrders();
        const newRow = payload.new as Partial<OrderRow> | null;
        const oldRow = payload.old as Partial<OrderRow> | null;
        const oid = newRow?.id ?? oldRow?.id;
        if (oid && detailsRef.current[oid]) debouncedRefreshDetails(oid);
        if (newRow?.status === "confirmed" && oldRow?.status !== "confirmed") {
          toast.success("Ваш заказ подтверждён менеджером");
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_timeline" }, (payload) => {
        const oid = (payload.new as { order_id?: string } | null)?.order_id;
        if (oid && detailsRef.current[oid]) debouncedRefreshDetails(oid);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function refreshDetails(orderId: string) {
    const [{ data: items }, { data: timeline }] = await Promise.all([
      supabase.from("order_items").select("*").eq("order_id", orderId),
      supabase.from("order_timeline").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
    ]);
    setDetails((d) => ({
      ...d,
      [orderId]: {
        items: (items ?? []) as OrderDetails["items"],
        timeline: (timeline ?? []) as OrderDetails["timeline"],
      },
    }));
  }

  async function toggle(orderId: string) {
    if (expanded === orderId) { setExpanded(null); return; }
    setExpanded(orderId);
    await refreshDetails(orderId);
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
      const editId = editing.id;
      setEditing(null);
      setDetails((d) => { const c = { ...d }; delete c[editId]; return c; });
      await reloadOrders();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setDeleting(false);
    }
  }

  // Хелперы, сохранены для будущих UI-точек входа (повтор заказа из истории).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function repeatOrder(orderId: string) {
    const d = details[orderId];
    if (!d || d.items.length === 0) { toast.error("Нет позиций для повтора"); return; }
    const ok = await confirm({
      title: "Заменить корзину?",
      description: "Текущая корзина будет очищена и заполнена позициями этой заявки.",
      confirmText: "Заменить",
    });
    if (!ok) return;
    clearCart();
    for (const it of d.items as OrderItemRow[]) {
      const meta = (it.meta as { slug?: string } | null) ?? null;
      addToCart({
        id: it.entity_id ?? meta?.slug ?? it.id,
        entity_type: it.entity_type as CartEntityType,
        slug: meta?.slug ?? it.entity_id ?? it.id,
        title: it.title,
        price: Number(it.price ?? 0),
        qty: Math.min(Number(it.qty ?? 1) || 1, maxQtyForItem(it.entity_type as CartEntityType)),
      });
    }
    toast.success("Позиции добавлены в корзину");
    navigate({ to: "/cart" });
  }

  if (loading || !profile) return <div className="page-shell section-y">Загрузка...</div>;

  // Временный пароль из письма — до смены кабинет закрыт.
  if (mustChangePassword) {
    return (
      <div className="page-shell section-y max-w-md space-y-4">
        <div className="glass-strong rounded-2xl p-6 space-y-2">
          <h1 className="text-2xl font-display font-bold gradient-text">Задайте свой пароль</h1>
          <p className="text-sm text-muted-foreground">
            Вы вошли с временным паролем из письма. Придумайте постоянный пароль — после этого
            откроется личный кабинет.
          </p>
        </div>
        <ChangePasswordCard
          title="Новый пароль"
          onSuccess={() => setMustChangePassword(false)}
        />
      </div>
    );
  }

  return (
    <div className="page-shell py-12 max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Здравствуйте, {profile.full_name}</h1>
        <p className="text-muted-foreground">{profile.email}{profile.company && ` · ${profile.company}`}</p>
      </div>

      <ProfileSummary profile={profile} orders={orders} />

      <div>
        <ChangePasswordCard />
      </div>

      <OrderHistoryList
        orders={orders}
        expanded={expanded}
        details={details}
        onToggle={toggle}
      />

      <EditOrderDialog
        open={!!editing}
        form={editForm}
        onChange={setEditForm}
        onCancel={() => setEditing(null)}
        onSubmit={submitEdit}
        saving={savingEdit}
      />

      <DeleteOrderDialog
        open={!!deleteId}
        deleting={deleting}
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />

      {confirmDialog}
    </div>
  );
}

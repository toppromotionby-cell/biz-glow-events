// Хук с мутациями списка заказов: статус, оплата, удаление, подтверждение, повторная отправка письма.
// Инкапсулирует все toast-ы и invalidateQueries, чтобы роут не разрастался.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { notify } from "@/lib/notify";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteOrderAdmin,
  confirmOrderAdmin,
  resendOrderConfirmationEmailAdmin,
} from "@/lib/orders.functions";
import type { OrderStatus } from "@/components/admin/orders/types";

const ORDERS_KEY = ["admin-orders"] as const;
const ORDER_MODAL_KEY = ["order-modal"] as const;
const ORDER_TIMELINE_KEY = ["order-modal-timeline"] as const;

export function useOrderMutations() {
  const qc = useQueryClient();
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ORDERS_KEY });
    qc.invalidateQueries({ queryKey: ORDER_MODAL_KEY });
    qc.invalidateQueries({ queryKey: ORDER_TIMELINE_KEY });
  };

  // Запись событий status_changed:* и paid_changed выполняет триггер БД
  // public.log_order_status_change (см. миграцию Stage 5).
  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: OrderStatus }) => {
      // Этап 3: если ответственного нет, закрепляем заказ за тем, кто двигает статус.
      const patch: { status: OrderStatus; manager_id?: string } = { status: newStatus };
      if (newStatus !== "new") {
        const { data: cur } = await supabase.from("orders").select("manager_id").eq("id", id).maybeSingle();
        if (!cur?.manager_id) {
          const { data: auth } = await supabase.auth.getUser();
          if (auth?.user?.id) patch.manager_id = auth.user.id;
        }
      }
      const { error } = await supabase.from("orders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { notify.success("Статус обновлён"); invalidateAll(); },
    onError: (e: Error) => notify.error(e?.message ?? "Не удалось изменить статус"),
  });


  const updatePaid = useMutation({
    mutationFn: async ({ id, newPaid }: { id: string; newPaid: number; prevPaid: number }) => {
      const { error } = await supabase.from("orders").update({ paid: newPaid }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { notify.success("Оплата обновлена"); invalidateAll(); },
    onError: (e: Error) => notify.error(e?.message ?? "Не удалось обновить оплату"),
  });

  const deleteFn = useServerFn(deleteOrderAdmin);
  const deleteOrder = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      notify.success("Заказ удалён");
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
    },
    onError: (e: Error) => notify.error(e?.message ?? "Не удалось удалить заказ"),
  });

  const confirmFn = useServerFn(confirmOrderAdmin);
  const resendFn = useServerFn(resendOrderConfirmationEmailAdmin);

  const resendEmail = useMutation({
    mutationFn: async (id: string) => resendFn({ data: { id } }),
    onSuccess: (res, id) => {
      if (res?.emailSent) {
        notify.email("Письмо клиенту отправлено повторно");
      } else {
        notify.error(`Не удалось отправить письмо: ${res?.emailError ?? "неизвестная ошибка"}`, {
          action: { label: "Повторить", onClick: () => resendEmail.mutate(id) },
        });
      }
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
      qc.invalidateQueries({ queryKey: ORDER_TIMELINE_KEY });
    },
    onError: (e: Error, id) =>
      notify.error(e?.message ?? "Не удалось отправить письмо", {
        action: { label: "Повторить", onClick: () => resendEmail.mutate(id) },
      }),
  });

  const confirmOrder = useMutation({
    mutationFn: async (id: string) => confirmFn({ data: { id } }),
    onSuccess: (res, id) => {
      if (res?.emailSent) {
        notify.email("Заказ подтверждён — клиенту отправлено письмо");
      } else {
        notify.warning(
          `Заказ подтверждён, но письмо не доставлено: ${res?.emailError ?? "неизвестная ошибка"}`,
          {
            action: { label: "Отправить повторно", onClick: () => resendEmail.mutate(id) },
          },
        );
      }
      invalidateAll();
    },
    onError: (e: Error) => notify.error(e?.message ?? "Не удалось подтвердить заказ"),
  });

  return { updateStatus, updatePaid, deleteOrder, resendEmail, confirmOrder };
}

export type OrderMutations = ReturnType<typeof useOrderMutations>;

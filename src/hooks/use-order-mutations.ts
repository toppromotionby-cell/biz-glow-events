// Хук с мутациями списка заказов: статус, оплата, удаление, подтверждение, повторная отправка письма.
// Инкапсулирует все toast-ы и invalidateQueries, чтобы роут не разрастался.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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
      const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Статус обновлён"); invalidateAll(); },
    onError: (e: Error) => toast.error(e?.message ?? "Не удалось изменить статус"),
  });

  const updatePaid = useMutation({
    mutationFn: async ({ id, newPaid }: { id: string; newPaid: number; prevPaid: number }) => {
      const { error } = await supabase.from("orders").update({ paid: newPaid }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Оплата обновлена"); invalidateAll(); },
    onError: (e: Error) => toast.error(e?.message ?? "Не удалось обновить оплату"),
  });

  const deleteFn = useServerFn(deleteOrderAdmin);
  const deleteOrder = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Заказ удалён");
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Не удалось удалить заказ"),
  });

  const confirmFn = useServerFn(confirmOrderAdmin);
  const resendFn = useServerFn(resendOrderConfirmationEmailAdmin);

  const resendEmail = useMutation({
    mutationFn: async (id: string) => resendFn({ data: { id } }),
    onSuccess: (res, id) => {
      if (res?.emailSent) {
        toast.success("Письмо клиенту отправлено повторно");
      } else {
        toast.error(`Не удалось отправить письмо: ${res?.emailError ?? "неизвестная ошибка"}`, {
          duration: 8000,
          action: { label: "Повторить", onClick: () => resendEmail.mutate(id) },
        });
      }
      qc.invalidateQueries({ queryKey: ORDERS_KEY });
      qc.invalidateQueries({ queryKey: ORDER_TIMELINE_KEY });
    },
    onError: (e: Error, id) =>
      toast.error(e?.message ?? "Не удалось отправить письмо", {
        duration: 8000,
        action: { label: "Повторить", onClick: () => resendEmail.mutate(id) },
      }),
  });

  const confirmOrder = useMutation({
    mutationFn: async (id: string) => confirmFn({ data: { id } }),
    onSuccess: (res, id) => {
      if (res?.emailSent) {
        toast.success("Заказ подтверждён — клиенту отправлено письмо");
      } else {
        toast.warning(
          `Заказ подтверждён, но письмо не доставлено: ${res?.emailError ?? "неизвестная ошибка"}`,
          {
            duration: 10000,
            action: { label: "Отправить повторно", onClick: () => resendEmail.mutate(id) },
          },
        );
      }
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e?.message ?? "Не удалось подтвердить заказ"),
  });

  return { updateStatus, updatePaid, deleteOrder, resendEmail, confirmOrder };
}

export type OrderMutations = ReturnType<typeof useOrderMutations>;

// Лейблы и тонировки для статусов заказа и событий таймлайна в личном кабинете.
export const STATUS_LABEL: Record<string, string> = {
  new: "Новая",
  consultation: "Консультация",
  estimate: "Смета",
  in_progress: "В работе",
  quoted: "Смета выслана",
  contract: "Договор",
  confirmed: "Подтверждена",
  paid: "Оплачена",
  completed: "Завершена",
  cancelled: "Отменена",
};

export const STATUS_TONE: Record<string, string> = {
  new: "border-primary/40 text-primary",
  consultation: "border-primary/40 text-primary",
  estimate: "border-sky-400/40 text-sky-400",
  in_progress: "border-amber-400/40 text-amber-400",
  quoted: "border-sky-400/40 text-sky-400",
  contract: "border-violet-400/40 text-violet-400",
  confirmed: "border-emerald-400/40 text-emerald-400",
  paid: "border-emerald-500/50 text-emerald-500",
  completed: "border-muted-foreground/40 text-muted-foreground",
  cancelled: "border-destructive/40 text-destructive",
};

export const TIMELINE_EVENT_LABEL: Record<string, string> = {
  order_created: "Заявка создана",
  order_confirmed_by_admin: "Заказ подтверждён менеджером",
  status_changed: "Статус изменён",
  note_added: "Добавлен комментарий",
  quote_sent: "Смета отправлена",
  payment_received: "Оплата получена",
  confirmation_email_sent: "Письмо клиенту отправлено",
  confirmation_email_failed: "Ошибка отправки письма клиенту",
};

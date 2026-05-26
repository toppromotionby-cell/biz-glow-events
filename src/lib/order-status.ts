// Единый источник правды по статусам заказов и форматированию денег.
export const ORDER_STATUS_LABEL: Record<string, string> = {
  new: "Новый",
  consultation: "Консультация",
  estimate: "Смета",
  contract: "Договор",
  in_progress: "В работе",
  quoted: "Смета выслана",
  confirmed: "Подтв.",
  paid: "Оплачен",
  completed: "Завершён",
  cancelled: "Отменён",
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-300 border-blue-400/30",
  consultation: "bg-cyan-500/15 text-cyan-300 border-cyan-400/30",
  estimate: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  contract: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  in_progress: "bg-orange-500/15 text-orange-300 border-orange-400/30",
  quoted: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  confirmed: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  completed: "bg-green-600/15 text-green-300 border-green-500/30",
  cancelled: "bg-red-500/15 text-red-300 border-red-400/30",
};

// Единый формат денег для заказов: совпадает с тем, что показывает админка
// (`1 500 BYN`). Используется и в админ-UI, и в клиентских письмах, чтобы
// клиент видел ровно ту же сумму и валюту.
export function formatOrderBYN(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return `${v.toLocaleString("ru-BY", { maximumFractionDigits: 0 })} BYN`;
}

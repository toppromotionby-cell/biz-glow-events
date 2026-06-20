// Хелпер отображения номера заказа.
// БД хранит человекочитаемый `order_number` (формат ДД/ММ/ГГГГ-NN),
// присваивается триггером при INSERT. Для старых записей fallback на UUID.
export function displayOrderNumber(order: { id: string; order_number?: string | null } | null | undefined): string {
  if (!order) return "";
  const n = (order.order_number ?? "").trim();
  if (n) return n;
  return order.id.slice(0, 8).toUpperCase();
}

// Только для документов (КП/счёт/договор/акт): UPPER-вид без слешей,
// чтобы вписывался в номера документов (например, "20.06.2026-01").
export function documentOrderNumber(order: { id: string; order_number?: string | null }): string {
  const n = (order.order_number ?? "").trim();
  if (n) return n.replaceAll("/", ".");
  return order.id.slice(0, 8).toUpperCase();
}

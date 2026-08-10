// Публичная серверная функция для записи сигналов спроса из браузера.
// Данные обезличены: только тип позиции, её id и тип события.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  events: z
    .array(
      z.object({
        entity_type: z.enum(["zones", "tech_equipment", "services", "production_items", "attractions"]),
        entity_id: z.string().uuid(),
        event: z.enum(["view", "detail", "cart", "quote", "order"]),
        qty: z.number().int().min(1).max(10).optional(),
      }),
    )
    .min(1)
    .max(20),
});

export const trackDemand = createServerFn({ method: "POST" })
  .inputValidator((i) => Schema.parse(i))
  .handler(async ({ data }) => {
    const { recordDemand } = await import("@/lib/demand.server");
    await recordDemand(data.events);
    return { ok: true };
  });

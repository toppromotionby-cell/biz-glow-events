ALTER TABLE public.promo_codes ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Заполняем существующие строки по дате создания (старые — позже).
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS rn
  FROM public.promo_codes
)
UPDATE public.promo_codes p SET sort_order = ordered.rn
FROM ordered WHERE ordered.id = p.id;

CREATE INDEX IF NOT EXISTS promo_codes_sort_order_idx ON public.promo_codes (sort_order);
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS cost_mode text NOT NULL DEFAULT 'amount',
  ADD COLUMN IF NOT EXISTS cost_input numeric NOT NULL DEFAULT 0;

ALTER TABLE public.promo_quote_items
  ADD COLUMN IF NOT EXISTS cost_mode text NOT NULL DEFAULT 'amount',
  ADD COLUMN IF NOT EXISTS cost_input numeric NOT NULL DEFAULT 0;

UPDATE public.quote_items SET cost_input = COALESCE(cost, 0) WHERE cost_input = 0 AND COALESCE(cost, 0) <> 0;
UPDATE public.promo_quote_items SET cost_input = COALESCE(cost, 0) WHERE cost_input = 0 AND COALESCE(cost, 0) <> 0;

ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_cost_mode_chk CHECK (cost_mode IN ('amount', 'percent'));
ALTER TABLE public.promo_quote_items
  ADD CONSTRAINT promo_quote_items_cost_mode_chk CHECK (cost_mode IN ('amount', 'percent'));
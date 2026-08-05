ALTER TABLE public.promo_quotes
  ADD COLUMN IF NOT EXISTS show_item_includes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_section_subtotals boolean NOT NULL DEFAULT true;
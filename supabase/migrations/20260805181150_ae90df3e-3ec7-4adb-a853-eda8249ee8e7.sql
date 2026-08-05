ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_response text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_comment text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

ALTER TABLE public.promo_quotes
  ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_response text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_comment text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS promo_quotes_public_token_key ON public.promo_quotes (public_token);
CREATE INDEX IF NOT EXISTS quotes_valid_idx ON public.quotes (status, sent_at);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS clarification_token uuid UNIQUE DEFAULT gen_random_uuid();

UPDATE public.orders
  SET clarification_token = gen_random_uuid()
  WHERE clarification_token IS NULL;
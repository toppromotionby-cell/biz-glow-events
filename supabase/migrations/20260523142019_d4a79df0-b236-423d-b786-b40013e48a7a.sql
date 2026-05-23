CREATE TABLE public.cart_drafts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cart_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cart" ON public.cart_drafts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own cart" ON public.cart_drafts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own cart" ON public.cart_drafts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own cart" ON public.cart_drafts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER cart_drafts_touch_updated_at
  BEFORE UPDATE ON public.cart_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
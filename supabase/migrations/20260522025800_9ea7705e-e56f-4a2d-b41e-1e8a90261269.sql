
-- Table
CREATE TABLE public.order_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('invoice','contract','custom')),
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  mime_type text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_attachments_order ON public.order_attachments(order_id);

ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage attachments"
  ON public.order_attachments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Users view own order attachments"
  ON public.order_attachments FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_attachments.order_id AND o.user_id = auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('order-attachments', 'order-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff read order-attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'order-attachments'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Staff upload order-attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'order-attachments'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Staff update order-attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'order-attachments'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Staff delete order-attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'order-attachments'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  );

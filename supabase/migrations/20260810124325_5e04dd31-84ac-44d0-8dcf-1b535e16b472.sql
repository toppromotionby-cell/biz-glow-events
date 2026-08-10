CREATE TABLE public.demand_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.demand_events TO service_role;

ALTER TABLE public.demand_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read demand events"
ON public.demand_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX demand_events_entity_idx ON public.demand_events (entity_type, entity_id, created_at DESC);
CREATE INDEX demand_events_created_idx ON public.demand_events (created_at DESC);

CREATE TABLE public.stacking_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id text NOT NULL,
  tenant_name text NOT NULL,
  industry text NOT NULL DEFAULT '',
  sqft integer NOT NULL DEFAULT 0,
  floor text NOT NULL DEFAULT '1',
  lease_expiration text NOT NULL DEFAULT 'N/A',
  notes text DEFAULT '',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stacking_plans_building ON public.stacking_plans(building_id);

ALTER TABLE public.stacking_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read stacking plans"
ON public.stacking_plans FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Auth users can insert stacking plans"
ON public.stacking_plans FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Auth users can update stacking plans"
ON public.stacking_plans FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Auth users can delete stacking plans"
ON public.stacking_plans FOR DELETE TO authenticated
USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.stacking_plans;

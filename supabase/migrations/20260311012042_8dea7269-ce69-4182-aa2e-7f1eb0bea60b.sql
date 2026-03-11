
CREATE TABLE public.pipeline_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  building_id text NOT NULL,
  stage text NOT NULL DEFAULT 'meeting_set',
  notes text[] NOT NULL DEFAULT '{}',
  last_activity timestamptz NOT NULL DEFAULT now(),
  is_manual boolean NOT NULL DEFAULT false,
  prospect_name text,
  prospect_company text,
  prospect_email text,
  prospect_phone text,
  prospect_sqft integer,
  sent_touchpoints jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, building_id)
);

ALTER TABLE public.pipeline_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pipeline deals" ON public.pipeline_deals FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert pipeline deals" ON public.pipeline_deals FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update pipeline deals" ON public.pipeline_deals FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete pipeline deals" ON public.pipeline_deals FOR DELETE TO public USING (true);

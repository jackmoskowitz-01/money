CREATE TABLE public.custom_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  enrichment jsonb DEFAULT NULL,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read custom prospects"
  ON public.custom_prospects FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Auth users can insert custom prospects"
  ON public.custom_prospects FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Auth users can update custom prospects"
  ON public.custom_prospects FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Auth users can delete custom prospects"
  ON public.custom_prospects FOR DELETE TO authenticated
  USING (true);

-- Allow anon for webhook inserts (Zapier won't have auth token)
CREATE POLICY "Anon can insert via webhook"
  ON public.custom_prospects FOR INSERT TO anon
  WITH CHECK (true);
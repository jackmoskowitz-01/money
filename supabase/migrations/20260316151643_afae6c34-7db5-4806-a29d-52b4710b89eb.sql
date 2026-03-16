
CREATE TABLE public.critical_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prospect_id text,
  prospect_name text NOT NULL DEFAULT '',
  building_name text NOT NULL DEFAULT '',
  date_type text NOT NULL,
  date_value date NOT NULL,
  description text NOT NULL DEFAULT '',
  remind_days_before integer NOT NULL DEFAULT 30,
  acknowledged boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  lease_abstract_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.critical_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own critical dates"
ON public.critical_dates FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own critical dates"
ON public.critical_dates FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own critical dates"
ON public.critical_dates FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own critical dates"
ON public.critical_dates FOR DELETE TO authenticated
USING (user_id = auth.uid());

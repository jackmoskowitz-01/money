
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS brain_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE public.copilot_brain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'general',
  fact text NOT NULL,
  context text NOT NULL DEFAULT '',
  confidence real NOT NULL DEFAULT 0.8,
  source text NOT NULL DEFAULT 'conversation',
  prospect_id text,
  prospect_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.copilot_brain ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own brain entries"
ON public.copilot_brain FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own brain entries"
ON public.copilot_brain FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own brain entries"
ON public.copilot_brain FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own brain entries"
ON public.copilot_brain FOR DELETE TO authenticated
USING (user_id = auth.uid());

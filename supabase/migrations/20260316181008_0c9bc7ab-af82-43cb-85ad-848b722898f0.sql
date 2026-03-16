
ALTER TABLE public.pipeline_deals 
  ADD COLUMN IF NOT EXISTS outcome text DEFAULT null,
  ADD COLUMN IF NOT EXISTS outcome_reason text DEFAULT '';

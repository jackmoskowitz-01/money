
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS ai_auto_brain_extraction boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_email_performance_loop boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_deal_pattern_learning boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_activity_insights boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_style_training boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_scoop_synthesis boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_contact_memory boolean NOT NULL DEFAULT false;

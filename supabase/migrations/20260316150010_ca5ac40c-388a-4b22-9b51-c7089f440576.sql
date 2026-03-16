ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS calendar_connected boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS copilot_memory boolean NOT NULL DEFAULT true;
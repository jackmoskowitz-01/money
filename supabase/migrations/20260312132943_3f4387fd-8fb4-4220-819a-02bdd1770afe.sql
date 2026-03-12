CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  brokerage text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email_signature text NOT NULL DEFAULT '',
  email_tone text NOT NULL DEFAULT 'professional',
  email_greeting text NOT NULL DEFAULT 'Hi',
  meeting_lead_weeks text NOT NULL DEFAULT '2',
  notify_pipeline_changes boolean NOT NULL DEFAULT true,
  notify_new_scoops boolean NOT NULL DEFAULT true,
  notify_task_reminders boolean NOT NULL DEFAULT true,
  notify_weekly_digest boolean NOT NULL DEFAULT false,
  default_market text NOT NULL DEFAULT 'dc-metro',
  activity_categories text NOT NULL DEFAULT 'Calls, Tours, Emails, Meetings, Proposals',
  dark_mode boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own settings" ON public.user_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE TO authenticated USING (user_id = auth.uid());
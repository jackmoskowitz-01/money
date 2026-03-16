
CREATE TABLE public.email_threads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id text,
  building_id text,
  prospect_name text NOT NULL DEFAULT '',
  prospect_email text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  body_preview text NOT NULL DEFAULT '',
  template_used text NOT NULL DEFAULT '',
  tone_used text NOT NULL DEFAULT '',
  outreach_reason text NOT NULL DEFAULT '',
  industry text NOT NULL DEFAULT '',
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  reply_detected boolean NOT NULL DEFAULT false,
  reply_at timestamp with time zone,
  reply_content text,
  reply_sentiment text,
  is_relevant boolean NOT NULL DEFAULT true,
  relevance_score real NOT NULL DEFAULT 0,
  spam_reason text,
  ai_suggested_replies jsonb NOT NULL DEFAULT '[]'::jsonb,
  response_time_hours real,
  thread_status text NOT NULL DEFAULT 'sent',
  activity_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own threads" ON public.email_threads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own threads" ON public.email_threads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own threads" ON public.email_threads FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own threads" ON public.email_threads FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_email_threads_user ON public.email_threads (user_id);
CREATE INDEX idx_email_threads_status ON public.email_threads (thread_status);
CREATE INDEX idx_email_threads_sent ON public.email_threads (sent_at DESC);

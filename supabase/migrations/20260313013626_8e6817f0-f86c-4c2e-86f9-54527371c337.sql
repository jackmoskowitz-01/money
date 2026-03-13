
CREATE TABLE public.copilot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages" ON public.copilot_messages
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own messages" ON public.copilot_messages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own messages" ON public.copilot_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_copilot_messages_user_conv ON public.copilot_messages (user_id, conversation_id, created_at);

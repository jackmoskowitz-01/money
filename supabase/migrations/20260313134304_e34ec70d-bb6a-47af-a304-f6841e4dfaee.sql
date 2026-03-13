
CREATE TABLE public.copilot_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'general',
  parsed_structure TEXT NOT NULL,
  original_filename TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.copilot_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own templates" ON public.copilot_templates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own templates" ON public.copilot_templates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own templates" ON public.copilot_templates FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own templates" ON public.copilot_templates FOR DELETE TO authenticated USING (user_id = auth.uid());

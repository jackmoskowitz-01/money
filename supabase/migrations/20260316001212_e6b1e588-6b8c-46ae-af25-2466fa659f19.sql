
-- Task comments table
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL DEFAULT '',
  author_initials text NOT NULL DEFAULT 'AN',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read task comments" ON public.task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert task comments" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own comments" ON public.task_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Enable realtime for task comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;

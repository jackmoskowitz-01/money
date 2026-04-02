-- Task enhancements: status field, activity feed, push subscriptions

-- 1. Add status column to tasks (replaces simple boolean completed)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'not_started';

-- Backfill: mark existing completed tasks
UPDATE public.tasks SET status = 'completed' WHERE completed = true AND status = 'not_started';

-- 2. Task activity log (assignment history, status changes, etc.)
CREATE TABLE IF NOT EXISTS public.task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text NOT NULL DEFAULT '',
  action text NOT NULL,  -- 'created', 'assigned', 'reassigned', 'status_changed', 'completed', 'commented'
  detail jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON public.task_activity(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_created_at ON public.task_activity(created_at DESC);

ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read task_activity" ON public.task_activity FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert task_activity" ON public.task_activity FOR INSERT TO authenticated WITH CHECK (true);

-- Add task_activity to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_activity;

-- 3. Push notification subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  keys jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

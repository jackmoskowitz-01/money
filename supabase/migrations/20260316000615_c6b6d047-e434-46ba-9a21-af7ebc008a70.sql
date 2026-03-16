
ALTER TABLE public.tasks
  ADD COLUMN assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN assigned_to_name text NOT NULL DEFAULT '';

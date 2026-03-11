
-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  avatar_initials text NOT NULL DEFAULT 'AN',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_initials)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'full_name', 'AN'), 2))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Company contacts table
CREATE TABLE public.company_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id text NOT NULL,
  name text NOT NULL,
  email text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  mobile_phone text,
  direct_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read contacts" ON public.company_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert contacts" ON public.company_contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update contacts" ON public.company_contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete contacts" ON public.company_contacts FOR DELETE TO authenticated USING (true);

-- Activities table
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  building_id text NOT NULL DEFAULT '',
  type text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  timestamp timestamptz NOT NULL DEFAULT now(),
  outreach_reason_used text
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read activities" ON public.activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update activities" ON public.activities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete activities" ON public.activities FOR DELETE TO authenticated USING (true);

-- Broker assignments table
CREATE TABLE public.broker_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL UNIQUE,
  building_id text NOT NULL,
  broker_id text NOT NULL,
  broker_name text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read assignments" ON public.broker_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert assignments" ON public.broker_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update assignments" ON public.broker_assignments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete assignments" ON public.broker_assignments FOR DELETE TO authenticated USING (true);

-- Tasks table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  building_id text,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'other',
  priority text NOT NULL DEFAULT 'medium',
  due_date timestamptz NOT NULL DEFAULT now(),
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can read tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update tasks" ON public.tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete tasks" ON public.tasks FOR DELETE TO authenticated USING (true);

-- Update existing tables: restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can delete pipeline deals" ON public.pipeline_deals;
DROP POLICY IF EXISTS "Anyone can insert pipeline deals" ON public.pipeline_deals;
DROP POLICY IF EXISTS "Anyone can read pipeline deals" ON public.pipeline_deals;
DROP POLICY IF EXISTS "Anyone can update pipeline deals" ON public.pipeline_deals;
CREATE POLICY "Auth users can read pipeline deals" ON public.pipeline_deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert pipeline deals" ON public.pipeline_deals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update pipeline deals" ON public.pipeline_deals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete pipeline deals" ON public.pipeline_deals FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can insert scoops" ON public.scoops;
DROP POLICY IF EXISTS "Anyone can read scoops" ON public.scoops;
DROP POLICY IF EXISTS "Anyone can update scoops" ON public.scoops;
CREATE POLICY "Auth users can read scoops" ON public.scoops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert scoops" ON public.scoops FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update scoops" ON public.scoops FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can insert comments" ON public.scoop_comments;
DROP POLICY IF EXISTS "Anyone can read comments" ON public.scoop_comments;
CREATE POLICY "Auth users can read comments" ON public.scoop_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert comments" ON public.scoop_comments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete likes" ON public.scoop_likes;
DROP POLICY IF EXISTS "Anyone can insert likes" ON public.scoop_likes;
DROP POLICY IF EXISTS "Anyone can read likes" ON public.scoop_likes;
CREATE POLICY "Auth users can read likes" ON public.scoop_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert likes" ON public.scoop_likes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can delete likes" ON public.scoop_likes FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can insert verifications" ON public.scoop_verifications;
DROP POLICY IF EXISTS "Anyone can read verifications" ON public.scoop_verifications;
CREATE POLICY "Auth users can read verifications" ON public.scoop_verifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert verifications" ON public.scoop_verifications FOR INSERT TO authenticated WITH CHECK (true);

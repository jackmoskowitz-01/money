-- ============================================
-- Multi-tenancy: Organizations & Memberships
-- ============================================

-- Role enum for organization members
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

-- Organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Organization members (links users to orgs)
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Super admin flag on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- Add organization_id to all team-scoped tables
ALTER TABLE public.pipeline_deals ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.custom_prospects ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.email_threads ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.task_comments ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.scoops ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.scoop_comments ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.broker_assignments ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.company_contacts ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.copilot_brain ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.copilot_messages ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.copilot_templates ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.critical_dates ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.prospect_files ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.prospect_lists ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.prospect_owners ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.stacking_plans ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Indexes for fast org-scoped queries
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_org ON public.pipeline_deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_prospects_org ON public.custom_prospects(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_org ON public.activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_org ON public.email_threads(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON public.tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_scoops_org ON public.scoops(organization_id);
CREATE INDEX IF NOT EXISTS idx_broker_assignments_org ON public.broker_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_company_contacts_org ON public.company_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_copilot_brain_org ON public.copilot_brain(organization_id);
CREATE INDEX IF NOT EXISTS idx_prospect_lists_org ON public.prospect_lists(organization_id);
CREATE INDEX IF NOT EXISTS idx_prospect_owners_org ON public.prospect_owners(organization_id);
CREATE INDEX IF NOT EXISTS idx_stacking_plans_org ON public.stacking_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_critical_dates_org ON public.critical_dates(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

-- ============================================
-- Helper function: get user's organization_id
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- ============================================
-- Helper function: check if user is super admin
-- ============================================
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ============================================
-- RLS Policies for organizations
-- ============================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can do anything with orgs"
  ON public.organizations FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "Members can view their own org"
  ON public.organizations FOR SELECT
  USING (id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- ============================================
-- RLS Policies for organization_members
-- ============================================
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all memberships"
  ON public.organization_members FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "Members can view their org members"
  ON public.organization_members FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- ============================================
-- Update RLS on data tables to scope by org
-- (Drop old permissive policies, add org-scoped ones)
-- ============================================

-- Helper macro: For each data table, allow SELECT/INSERT/UPDATE/DELETE
-- only if the row's organization_id matches the user's org, OR user is super admin.

-- pipeline_deals
DROP POLICY IF EXISTS "Authenticated users can read pipeline_deals" ON public.pipeline_deals;
DROP POLICY IF EXISTS "Authenticated users can insert pipeline_deals" ON public.pipeline_deals;
DROP POLICY IF EXISTS "Authenticated users can update pipeline_deals" ON public.pipeline_deals;
DROP POLICY IF EXISTS "Authenticated users can delete pipeline_deals" ON public.pipeline_deals;
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.pipeline_deals;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.pipeline_deals;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.pipeline_deals;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.pipeline_deals;

CREATE POLICY "Org-scoped read pipeline_deals" ON public.pipeline_deals FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert pipeline_deals" ON public.pipeline_deals FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update pipeline_deals" ON public.pipeline_deals FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete pipeline_deals" ON public.pipeline_deals FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- custom_prospects
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.custom_prospects;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.custom_prospects;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.custom_prospects;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.custom_prospects;

CREATE POLICY "Org-scoped read custom_prospects" ON public.custom_prospects FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert custom_prospects" ON public.custom_prospects FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update custom_prospects" ON public.custom_prospects FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete custom_prospects" ON public.custom_prospects FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- activities
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.activities;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.activities;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.activities;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.activities;

CREATE POLICY "Org-scoped read activities" ON public.activities FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert activities" ON public.activities FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update activities" ON public.activities FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete activities" ON public.activities FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- tasks
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.tasks;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.tasks;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.tasks;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.tasks;

CREATE POLICY "Org-scoped read tasks" ON public.tasks FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert tasks" ON public.tasks FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update tasks" ON public.tasks FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete tasks" ON public.tasks FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- scoops
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.scoops;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.scoops;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.scoops;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.scoops;
DROP POLICY IF EXISTS "Anyone can read scoops" ON public.scoops;
DROP POLICY IF EXISTS "Anyone can insert scoops" ON public.scoops;
DROP POLICY IF EXISTS "Anyone can update scoops" ON public.scoops;

CREATE POLICY "Org-scoped read scoops" ON public.scoops FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert scoops" ON public.scoops FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update scoops" ON public.scoops FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete scoops" ON public.scoops FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- email_threads
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.email_threads;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.email_threads;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.email_threads;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.email_threads;
DROP POLICY IF EXISTS "Users can read own email threads" ON public.email_threads;
DROP POLICY IF EXISTS "Users can insert own email threads" ON public.email_threads;
DROP POLICY IF EXISTS "Users can update own email threads" ON public.email_threads;

CREATE POLICY "Org-scoped read email_threads" ON public.email_threads FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert email_threads" ON public.email_threads FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update email_threads" ON public.email_threads FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete email_threads" ON public.email_threads FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- broker_assignments
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.broker_assignments;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.broker_assignments;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.broker_assignments;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.broker_assignments;

CREATE POLICY "Org-scoped read broker_assignments" ON public.broker_assignments FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert broker_assignments" ON public.broker_assignments FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update broker_assignments" ON public.broker_assignments FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete broker_assignments" ON public.broker_assignments FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- company_contacts
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.company_contacts;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.company_contacts;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.company_contacts;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.company_contacts;

CREATE POLICY "Org-scoped read company_contacts" ON public.company_contacts FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert company_contacts" ON public.company_contacts FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update company_contacts" ON public.company_contacts FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete company_contacts" ON public.company_contacts FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- copilot_brain
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.copilot_brain;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.copilot_brain;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.copilot_brain;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.copilot_brain;
DROP POLICY IF EXISTS "Users can manage own copilot brain" ON public.copilot_brain;
DROP POLICY IF EXISTS "Users can read own brain facts" ON public.copilot_brain;
DROP POLICY IF EXISTS "Users can insert brain facts" ON public.copilot_brain;
DROP POLICY IF EXISTS "Users can update own brain facts" ON public.copilot_brain;
DROP POLICY IF EXISTS "Users can delete own brain facts" ON public.copilot_brain;

CREATE POLICY "Org-scoped read copilot_brain" ON public.copilot_brain FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert copilot_brain" ON public.copilot_brain FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update copilot_brain" ON public.copilot_brain FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete copilot_brain" ON public.copilot_brain FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- prospect_lists
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.prospect_lists;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.prospect_lists;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.prospect_lists;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.prospect_lists;
DROP POLICY IF EXISTS "Users can manage own prospect lists" ON public.prospect_lists;
DROP POLICY IF EXISTS "Users can read own prospect lists" ON public.prospect_lists;
DROP POLICY IF EXISTS "Users can insert prospect lists" ON public.prospect_lists;
DROP POLICY IF EXISTS "Users can update own prospect lists" ON public.prospect_lists;
DROP POLICY IF EXISTS "Users can delete own prospect lists" ON public.prospect_lists;

CREATE POLICY "Org-scoped read prospect_lists" ON public.prospect_lists FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert prospect_lists" ON public.prospect_lists FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update prospect_lists" ON public.prospect_lists FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete prospect_lists" ON public.prospect_lists FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- critical_dates
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.critical_dates;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.critical_dates;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.critical_dates;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.critical_dates;
DROP POLICY IF EXISTS "Users can read own critical dates" ON public.critical_dates;
DROP POLICY IF EXISTS "Users can insert critical dates" ON public.critical_dates;
DROP POLICY IF EXISTS "Users can update own critical dates" ON public.critical_dates;
DROP POLICY IF EXISTS "Users can delete own critical dates" ON public.critical_dates;

CREATE POLICY "Org-scoped read critical_dates" ON public.critical_dates FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert critical_dates" ON public.critical_dates FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update critical_dates" ON public.critical_dates FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete critical_dates" ON public.critical_dates FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- prospect_owners
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.prospect_owners;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.prospect_owners;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.prospect_owners;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.prospect_owners;

CREATE POLICY "Org-scoped read prospect_owners" ON public.prospect_owners FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert prospect_owners" ON public.prospect_owners FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update prospect_owners" ON public.prospect_owners FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete prospect_owners" ON public.prospect_owners FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- stacking_plans
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.stacking_plans;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.stacking_plans;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.stacking_plans;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.stacking_plans;

CREATE POLICY "Org-scoped read stacking_plans" ON public.stacking_plans FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert stacking_plans" ON public.stacking_plans FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update stacking_plans" ON public.stacking_plans FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete stacking_plans" ON public.stacking_plans FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- prospect_files
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.prospect_files;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.prospect_files;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.prospect_files;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.prospect_files;

CREATE POLICY "Org-scoped read prospect_files" ON public.prospect_files FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert prospect_files" ON public.prospect_files FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update prospect_files" ON public.prospect_files FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete prospect_files" ON public.prospect_files FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- copilot_messages (keep user-scoped within org)
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.copilot_messages;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.copilot_messages;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.copilot_messages;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.copilot_messages;
DROP POLICY IF EXISTS "Users can read own messages" ON public.copilot_messages;
DROP POLICY IF EXISTS "Users can insert messages" ON public.copilot_messages;

CREATE POLICY "Org-scoped read copilot_messages" ON public.copilot_messages FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert copilot_messages" ON public.copilot_messages FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- copilot_templates
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.copilot_templates;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.copilot_templates;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.copilot_templates;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.copilot_templates;
DROP POLICY IF EXISTS "Users can read own templates" ON public.copilot_templates;
DROP POLICY IF EXISTS "Users can insert templates" ON public.copilot_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.copilot_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON public.copilot_templates;

CREATE POLICY "Org-scoped read copilot_templates" ON public.copilot_templates FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert copilot_templates" ON public.copilot_templates FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update copilot_templates" ON public.copilot_templates FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete copilot_templates" ON public.copilot_templates FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- task_comments (inherit from parent task's org)
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.task_comments;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.task_comments;
DROP POLICY IF EXISTS "Enable update for authenticated" ON public.task_comments;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON public.task_comments;

CREATE POLICY "Org-scoped read task_comments" ON public.task_comments FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert task_comments" ON public.task_comments FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped update task_comments" ON public.task_comments FOR UPDATE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped delete task_comments" ON public.task_comments FOR DELETE
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- scoop_comments
DROP POLICY IF EXISTS "Enable read for authenticated" ON public.scoop_comments;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.scoop_comments;
DROP POLICY IF EXISTS "Anyone can read scoop comments" ON public.scoop_comments;
DROP POLICY IF EXISTS "Anyone can insert scoop comments" ON public.scoop_comments;

CREATE POLICY "Org-scoped read scoop_comments" ON public.scoop_comments FOR SELECT
  USING (organization_id = public.get_user_org_id() OR public.is_super_admin());
CREATE POLICY "Org-scoped insert scoop_comments" ON public.scoop_comments FOR INSERT
  WITH CHECK (organization_id = public.get_user_org_id() OR public.is_super_admin());

-- Note: scoop_likes and scoop_verifications are session-based, not org-scoped.
-- cached_buildings and cached_company_news are shared/global caches, no org scoping needed.
-- user_settings stays user-scoped (personal preferences) but we add org_id for context.
-- profiles RLS stays as-is (users read all profiles, update own).

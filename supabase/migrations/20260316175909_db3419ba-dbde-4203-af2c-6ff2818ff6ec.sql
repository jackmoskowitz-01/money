
-- Prospect lists table
CREATE TABLE public.prospect_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  industry text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lists" ON public.prospect_lists FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own lists" ON public.prospect_lists FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own lists" ON public.prospect_lists FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own lists" ON public.prospect_lists FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Prospect list items table
CREATE TABLE public.prospect_list_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id uuid REFERENCES public.prospect_lists(id) ON DELETE CASCADE NOT NULL,
  tenant_id text NOT NULL,
  building_id text NOT NULL DEFAULT '',
  tenant_name text NOT NULL DEFAULT '',
  added_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own list items" ON public.prospect_list_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.prospect_lists WHERE id = list_id AND user_id = auth.uid())
);
CREATE POLICY "Users can insert own list items" ON public.prospect_list_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.prospect_lists WHERE id = list_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete own list items" ON public.prospect_list_items FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.prospect_lists WHERE id = list_id AND user_id = auth.uid())
);

-- Unique constraint to prevent duplicates
CREATE UNIQUE INDEX prospect_list_items_unique ON public.prospect_list_items (list_id, tenant_id);

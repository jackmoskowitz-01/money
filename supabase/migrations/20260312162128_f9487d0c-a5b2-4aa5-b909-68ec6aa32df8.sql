CREATE TABLE public.prospect_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  owner_name text NOT NULL DEFAULT '',
  claimed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.prospect_owners ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read ownership (to see who owns a prospect)
CREATE POLICY "Auth users can read prospect owners"
  ON public.prospect_owners FOR SELECT
  TO authenticated
  USING (true);

-- Only allow inserting if no owner exists yet (UNIQUE constraint handles this)
CREATE POLICY "Auth users can claim unowned prospects"
  ON public.prospect_owners FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Only the owner can update their own claim
CREATE POLICY "Only owner can update their claim"
  ON public.prospect_owners FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

-- Only the owner can release their claim
CREATE POLICY "Only owner can release their claim"
  ON public.prospect_owners FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());
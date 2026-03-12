CREATE TABLE public.cached_company_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  company_name text NOT NULL DEFAULT '',
  news_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

ALTER TABLE public.cached_company_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read cached news"
  ON public.cached_company_news FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage cached news"
  ON public.cached_company_news FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
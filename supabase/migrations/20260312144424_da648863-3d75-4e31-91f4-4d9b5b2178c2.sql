
CREATE TABLE public.cached_buildings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  rating DOUBLE PRECISION,
  rating_count INTEGER NOT NULL DEFAULT 0,
  types TEXT[] NOT NULL DEFAULT '{}',
  business_status TEXT NOT NULL DEFAULT 'OPERATIONAL',
  photo_url TEXT,
  building_data JSONB NOT NULL DEFAULT '{}',
  query_index INTEGER NOT NULL DEFAULT 0,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Allow authenticated users to read cached buildings
ALTER TABLE public.cached_buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached buildings"
  ON public.cached_buildings FOR SELECT
  TO authenticated
  USING (true);

-- Service role will insert/update via edge function
CREATE POLICY "Service role can manage cached buildings"
  ON public.cached_buildings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

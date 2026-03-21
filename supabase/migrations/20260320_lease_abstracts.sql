CREATE TABLE IF NOT EXISTS public.lease_abstracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  prospect_id TEXT,
  prospect_name TEXT NOT NULL DEFAULT '',
  building_name TEXT NOT NULL DEFAULT '',
  building_address TEXT NOT NULL DEFAULT '',

  -- Core lease terms
  tenant_name TEXT NOT NULL DEFAULT '',
  landlord_name TEXT NOT NULL DEFAULT '',
  premises_sf INTEGER,
  floor_suite TEXT DEFAULT '',
  lease_type TEXT DEFAULT '',

  -- Dates
  commencement_date TEXT,
  expiration_date TEXT,
  term_months INTEGER,

  -- Rent
  base_rent_psf NUMERIC,
  rent_schedule JSONB DEFAULT '[]'::jsonb,
  escalation_type TEXT DEFAULT '',
  escalation_rate NUMERIC,
  free_rent_months INTEGER DEFAULT 0,

  -- Concessions
  ti_allowance_psf NUMERIC,
  parking_spaces INTEGER,
  parking_rate NUMERIC,

  -- Options
  renewal_options JSONB DEFAULT '[]'::jsonb,
  expansion_options JSONB DEFAULT '[]'::jsonb,
  termination_options JSONB DEFAULT '[]'::jsonb,

  -- Other
  operating_expenses TEXT DEFAULT '',
  security_deposit TEXT DEFAULT '',
  assignment_subletting TEXT DEFAULT '',
  notable_clauses TEXT DEFAULT '',

  -- Meta
  source_filename TEXT DEFAULT '',
  raw_abstract TEXT DEFAULT '',
  completeness_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lease_abstracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own lease abstracts"
  ON public.lease_abstracts FOR ALL
  USING (auth.uid() = user_id);

// Custom prospects storage — Supabase-backed with localStorage migration

import { supabase } from '@/integrations/supabase/client';

export type ProspectEnrichment = {
  industry: string | null;
  employeeCount: string | null;
  companySize: string | null;
  headquarters: string | null;
  officeLocations: string[];
  description: string | null;
  keyContacts?: { name: string; title: string; relevance: string }[];
  recentNews: { headline: string; date: string; summary: string; signal: string }[];
  spaceDetails: {
    currentSqft: string | null;
    buildingName: string | null;
    leaseExpiration: string | null;
  };
  creSignals: string[];
  confidenceScore: number;
  enrichedAt: string;
  citations: string[];
};

export type CustomProspect = {
  id: string;
  name: string;
  website: string;
  address: string;
  createdAt: string;
  source?: string;
  enrichment?: ProspectEnrichment;
};

const CUSTOM_PROSPECTS_KEY = 'dealflow-custom-prospects';

type DbProspect = {
  id: string;
  name: string;
  website: string;
  address: string;
  enrichment: Record<string, unknown> | null;
  source: string;
  created_at: string;
};

const toProspect = (row: DbProspect): CustomProspect => ({
  id: row.id,
  name: row.name,
  website: row.website,
  address: row.address,
  createdAt: row.created_at,
  source: row.source,
  enrichment: row.enrichment as unknown as ProspectEnrichment | undefined,
});

/** Async: Get all custom prospects from DB */
export const getCustomProspectsAsync = async (): Promise<CustomProspect[]> => {
  const { data, error } = await supabase
    .from('custom_prospects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('getCustomProspectsAsync error:', error);
    return getCustomProspects(); // fallback to localStorage
  }
  return (data as DbProspect[]).map(toProspect);
};

/** Sync fallback: Get from localStorage (legacy) */
export const getCustomProspects = (): CustomProspect[] => {
  try {
    const stored = localStorage.getItem(CUSTOM_PROSPECTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

/** Add a prospect — saves to both DB and localStorage */
export const addCustomProspect = (prospect: Omit<CustomProspect, 'id' | 'createdAt'>): CustomProspect => {
  const prospects = getCustomProspects();
  const newProspect: CustomProspect = {
    ...prospect,
    id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(CUSTOM_PROSPECTS_KEY, JSON.stringify([newProspect, ...prospects]));

  // Also save to DB (fire-and-forget)
  supabase.from('custom_prospects' as any).insert({
    id: newProspect.id,
    name: newProspect.name,
    website: newProspect.website || '',
    address: newProspect.address || '',
    enrichment: newProspect.enrichment as unknown as Record<string, unknown> || null,
    source: 'manual',
  }).then(({ error }: any) => {
    if (error) console.error('DB insert prospect error:', error);
  });

  return newProspect;
};

/** Update a prospect — updates both DB and localStorage */
export const updateCustomProspect = (id: string, updates: Partial<CustomProspect>): CustomProspect | undefined => {
  const prospects = getCustomProspects();
  const idx = prospects.findIndex(p => p.id === id);
  if (idx !== -1) {
    prospects[idx] = { ...prospects[idx], ...updates };
    localStorage.setItem(CUSTOM_PROSPECTS_KEY, JSON.stringify(prospects));
  }

  // Also update DB
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.website !== undefined) dbUpdates.website = updates.website;
  if (updates.address !== undefined) dbUpdates.address = updates.address;
  if (updates.enrichment !== undefined) dbUpdates.enrichment = updates.enrichment as unknown as Record<string, unknown>;
  dbUpdates.updated_at = new Date().toISOString();

  supabase.from('custom_prospects' as any).update(dbUpdates).eq('id', id).then(({ error }: any) => {
    if (error) console.error('DB update prospect error:', error);
  });

  return idx !== -1 ? prospects[idx] : undefined;
};

/** Get a single prospect — checks DB first, falls back to localStorage */
export const getCustomProspect = (id: string): CustomProspect | undefined => {
  return getCustomProspects().find(p => p.id === id);
};

/** Async: Get a single prospect from DB */
export const getCustomProspectAsync = async (id: string): Promise<CustomProspect | undefined> => {
  const { data, error } = await supabase
    .from('custom_prospects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) {
    return getCustomProspect(id); // fallback
  }
  return toProspect(data as DbProspect);
};

/** Migrate localStorage prospects to DB (run once) */
export const migrateLocalProspectsToDb = async () => {
  const local = getCustomProspects();
  if (local.length === 0) return;

  for (const p of local) {
    const { error } = await supabase.from('custom_prospects').upsert({
      id: p.id,
      name: p.name,
      website: p.website || '',
      address: p.address || '',
      enrichment: p.enrichment as unknown as Record<string, unknown> || null,
      source: 'manual',
      created_at: p.createdAt,
    }, { onConflict: 'id' });
    if (error) console.error('Migration error for', p.name, error);
  }
  console.log(`Migrated ${local.length} prospects to DB`);
};

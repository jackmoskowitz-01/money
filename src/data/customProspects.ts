// Custom prospects storage (localStorage-backed)

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
  enrichment?: ProspectEnrichment;
};

const CUSTOM_PROSPECTS_KEY = 'dealflow-custom-prospects';

export const getCustomProspects = (): CustomProspect[] => {
  try {
    const stored = localStorage.getItem(CUSTOM_PROSPECTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

export const addCustomProspect = (prospect: Omit<CustomProspect, 'id' | 'createdAt'>): CustomProspect => {
  const prospects = getCustomProspects();
  const newProspect: CustomProspect = {
    ...prospect,
    id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(CUSTOM_PROSPECTS_KEY, JSON.stringify([newProspect, ...prospects]));
  return newProspect;
};

export const updateCustomProspect = (id: string, updates: Partial<CustomProspect>): CustomProspect | undefined => {
  const prospects = getCustomProspects();
  const idx = prospects.findIndex(p => p.id === id);
  if (idx === -1) return undefined;
  prospects[idx] = { ...prospects[idx], ...updates };
  localStorage.setItem(CUSTOM_PROSPECTS_KEY, JSON.stringify(prospects));
  return prospects[idx];
};

export const getCustomProspect = (id: string): CustomProspect | undefined => {
  return getCustomProspects().find(p => p.id === id);
};

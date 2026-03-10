// Custom prospects storage (localStorage-backed)

export type CustomProspect = {
  id: string;
  name: string;
  website: string;
  address: string;
  createdAt: string;
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

export const getCustomProspect = (id: string): CustomProspect | undefined => {
  return getCustomProspects().find(p => p.id === id);
};

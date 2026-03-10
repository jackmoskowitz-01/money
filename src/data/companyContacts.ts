// Company contacts — localStorage-backed multi-contact support per tenant

export type CompanyContact = {
  id: string;
  name: string;
  email: string;
  title: string;
  mobilePhone?: string;
  directPhone?: string;
  addedAt: string;
};

const STORAGE_KEY = 'dealflow-company-contacts';

const getAll = (): Record<string, CompanyContact[]> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveAll = (data: Record<string, CompanyContact[]>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

/** Get contacts for a specific tenant (by tenantId or prospectId) */
export const getContacts = (entityId: string): CompanyContact[] => {
  return getAll()[entityId] || [];
};

/** Add a contact to an entity */
export const addContact = (entityId: string, contact: Omit<CompanyContact, 'id' | 'addedAt'>): CompanyContact => {
  const all = getAll();
  const newContact: CompanyContact = {
    ...contact,
    id: `cc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    addedAt: new Date().toISOString(),
  };
  if (!all[entityId]) all[entityId] = [];
  all[entityId].push(newContact);
  saveAll(all);
  return newContact;
};

/** Remove a contact */
export const removeContact = (entityId: string, contactId: string) => {
  const all = getAll();
  if (!all[entityId]) return;
  all[entityId] = all[entityId].filter(c => c.id !== contactId);
  saveAll(all);
};

/** Update a contact */
export const updateContact = (entityId: string, contactId: string, updates: Partial<Omit<CompanyContact, 'id' | 'addedAt'>>) => {
  const all = getAll();
  if (!all[entityId]) return;
  const idx = all[entityId].findIndex(c => c.id === contactId);
  if (idx >= 0) {
    all[entityId][idx] = { ...all[entityId][idx], ...updates };
    saveAll(all);
  }
};

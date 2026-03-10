// Prospect Lists — lightweight local-storage–backed lists

export type ProspectListEntry = {
  tenantId: string;
  buildingId: string;
  tenantName: string;
  addedAt: string;
};

export type ProspectList = {
  id: string;
  name: string;
  createdAt: string;
  entries: ProspectListEntry[];
};

const LISTS_KEY = 'dealflow-prospect-lists';

const seedLists: ProspectList[] = [
  {
    id: 'pl-1',
    name: 'Q2 Priority Outreach',
    createdAt: '2025-03-01T00:00:00Z',
    entries: [],
  },
  {
    id: 'pl-2',
    name: 'Lease Expirations 2025',
    createdAt: '2025-02-15T00:00:00Z',
    entries: [],
  },
];

export const getProspectLists = (): ProspectList[] => {
  try {
    const stored = localStorage.getItem(LISTS_KEY);
    const lists: ProspectList[] = stored ? JSON.parse(stored) : seedLists;
    if (!stored) localStorage.setItem(LISTS_KEY, JSON.stringify(seedLists));
    return lists;
  } catch {
    return [];
  }
};

export const createProspectList = (name: string): ProspectList => {
  const lists = getProspectLists();
  const newList: ProspectList = {
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name,
    createdAt: new Date().toISOString(),
    entries: [],
  };
  localStorage.setItem(LISTS_KEY, JSON.stringify([newList, ...lists]));
  return newList;
};

export const addProspectsToList = (
  listId: string,
  prospects: { tenantId: string; buildingId: string; tenantName: string }[]
): number => {
  const lists = getProspectLists();
  const list = lists.find(l => l.id === listId);
  if (!list) return 0;

  let added = 0;
  for (const p of prospects) {
    if (!list.entries.some(e => e.tenantId === p.tenantId)) {
      list.entries.push({ ...p, addedAt: new Date().toISOString() });
      added++;
    }
  }
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
  return added;
};

export const removeProspectFromList = (listId: string, tenantId: string) => {
  const lists = getProspectLists();
  const list = lists.find(l => l.id === listId);
  if (!list) return;
  list.entries = list.entries.filter(e => e.tenantId !== tenantId);
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
};

export const deleteProspectList = (listId: string) => {
  const lists = getProspectLists().filter(l => l.id !== listId);
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
};

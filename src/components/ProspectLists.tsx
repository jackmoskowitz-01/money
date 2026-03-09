import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Users, Search, ChevronDown, ChevronRight, Building2, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { buildings, type Tenant, type Building } from '@/data/mockData';

export type ProspectList = {
  id: string;
  name: string;
  industry: string;
  prospects: { tenantId: string; buildingId: string }[];
  createdAt: string;
};

const LISTS_KEY = 'dealflow-prospect-lists';

const getLists = (): ProspectList[] => {
  try {
    const stored = localStorage.getItem(LISTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

const saveLists = (lists: ProspectList[]) => {
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
};

// Get all unique industries
const getAllIndustries = (): string[] => {
  const industries = new Set<string>();
  buildings.forEach(b => b.tenants.forEach(t => {
    t.industry.split('/').forEach(i => industries.add(i.trim()));
    industries.add(t.industry);
  }));
  return Array.from(industries).sort();
};

// Get all tenants with building info
const getAllProspects = (): { tenant: Tenant; building: Building }[] => {
  const prospects: { tenant: Tenant; building: Building }[] = [];
  buildings.forEach(b => b.tenants.forEach(t => prospects.push({ tenant: t, building: b })));
  return prospects;
};

const ProspectLists = () => {
  const [lists, setLists] = useState<ProspectList[]>(getLists);
  const [expandedList, setExpandedList] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListIndustry, setNewListIndustry] = useState('');
  const [addingToList, setAddingToList] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const industries = useMemo(getAllIndustries, []);
  const allProspects = useMemo(getAllProspects, []);

  const updateLists = (updated: ProspectList[]) => {
    setLists(updated);
    saveLists(updated);
  };

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    const list: ProspectList = {
      id: `list-${Date.now()}`,
      name: newListName.trim(),
      industry: newListIndustry,
      prospects: [],
      createdAt: new Date().toISOString(),
    };
    updateLists([list, ...lists]);
    setNewListName('');
    setNewListIndustry('');
    setShowCreate(false);
    setExpandedList(list.id);
    setAddingToList(list.id);
  };

  const handleDeleteList = (id: string) => {
    updateLists(lists.filter(l => l.id !== id));
    if (expandedList === id) setExpandedList(null);
  };

  const handleAddProspect = (listId: string, tenantId: string, buildingId: string) => {
    updateLists(lists.map(l => {
      if (l.id !== listId) return l;
      if (l.prospects.some(p => p.tenantId === tenantId)) return l;
      return { ...l, prospects: [...l.prospects, { tenantId, buildingId }] };
    }));
  };

  const handleRemoveProspect = (listId: string, tenantId: string) => {
    updateLists(lists.map(l => {
      if (l.id !== listId) return l;
      return { ...l, prospects: l.prospects.filter(p => p.tenantId !== tenantId) };
    }));
  };

  const getProspectInfo = (tenantId: string, buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    const tenant = building?.tenants.find(t => t.id === tenantId);
    return tenant && building ? { tenant, building } : null;
  };

  const getAvailableProspects = (list: ProspectList) => {
    const existingIds = new Set(list.prospects.map(p => p.tenantId));
    return allProspects
      .filter(p => !existingIds.has(p.tenant.id))
      .filter(p => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return p.tenant.name.toLowerCase().includes(q) ||
            p.tenant.industry.toLowerCase().includes(q) ||
            p.building.name.toLowerCase().includes(q) ||
            p.tenant.contactName.toLowerCase().includes(q);
        }
        if (list.industry) {
          return p.tenant.industry.toLowerCase().includes(list.industry.toLowerCase());
        }
        return true;
      });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {lists.length} list{lists.length !== 1 ? 's' : ''} · {lists.reduce((sum, l) => sum + l.prospects.length, 0)} total prospects
        </p>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> New List
        </Button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Card className="border-primary/30 bg-card p-4">
              <Input
                placeholder="List name (e.g. Legal Firms Q2)"
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                className="mb-3 border-border bg-secondary/50"
              />
              <div className="mb-3">
                <label className="mb-1.5 block text-xs text-muted-foreground">Filter by Industry (optional)</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setNewListIndustry('')}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      !newListIndustry ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All Industries
                  </button>
                  {industries.slice(0, 12).map(ind => (
                    <button
                      key={ind}
                      onClick={() => setNewListIndustry(ind)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        newListIndustry === ind ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button size="sm" onClick={handleCreateList} disabled={!newListName.trim()}>Create List</Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lists */}
      {lists.length === 0 && !showCreate ? (
        <Card className="border-border bg-card p-8 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No prospect lists yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Create a list to organize prospects by industry</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {lists.map(list => {
            const isExpanded = expandedList === list.id;
            const isAdding = addingToList === list.id;
            const available = isAdding ? getAvailableProspects(list) : [];

            return (
              <Card key={list.id} className="border-border bg-card overflow-hidden">
                {/* List Header */}
                <button
                  onClick={() => {
                    setExpandedList(isExpanded ? null : list.id);
                    if (isAdding && isExpanded) setAddingToList(null);
                  }}
                  className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-secondary/30"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{list.name}</p>
                      {list.industry && (
                        <Badge variant="outline" className="bg-primary/10 text-[10px] text-primary">{list.industry}</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {list.prospects.length} prospect{list.prospects.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setAddingToList(isAdding ? null : list.id);
                        if (!isExpanded) setExpandedList(list.id);
                        setSearchQuery('');
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add
                    </Button>
                    <button
                      onClick={() => handleDeleteList(list.id)}
                      className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </button>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border px-3 pb-3">
                        {/* Add Prospect Panel */}
                        {isAdding && (
                          <div className="mt-3 mb-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-medium text-foreground">Add Prospects</p>
                              <button onClick={() => { setAddingToList(null); setSearchQuery(''); }}>
                                <X className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </div>
                            <div className="relative mb-2">
                              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                placeholder="Search by name, industry, building..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="h-8 border-border bg-background pl-8 text-xs"
                              />
                            </div>
                            <div className="max-h-48 space-y-1 overflow-y-auto">
                              {available.length === 0 ? (
                                <p className="py-2 text-center text-[11px] text-muted-foreground">
                                  {searchQuery ? 'No matching prospects' : 'All prospects already added'}
                                </p>
                              ) : (
                                available.map(({ tenant, building }) => (
                                  <button
                                    key={tenant.id}
                                    onClick={() => handleAddProspect(list.id, tenant.id, building.id)}
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-secondary"
                                  >
                                    <Plus className="h-3 w-3 shrink-0 text-primary" />
                                    <div className="flex-1 min-w-0">
                                      <p className="truncate text-xs font-medium text-foreground">{tenant.name}</p>
                                      <p className="truncate text-[10px] text-muted-foreground">
                                        {tenant.industry} · {building.name}
                                      </p>
                                    </div>
                                    <Badge variant="outline" className="shrink-0 text-[9px]">{tenant.contactName}</Badge>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {/* Prospect List */}
                        {list.prospects.length === 0 && !isAdding ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">
                            No prospects yet — click "Add" to get started
                          </p>
                        ) : (
                          <div className="mt-2 space-y-1">
                            {list.prospects.map(p => {
                              const info = getProspectInfo(p.tenantId, p.buildingId);
                              if (!info) return null;
                              return (
                                <div
                                  key={p.tenantId}
                                  className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary/30"
                                >
                                  <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <div className="flex-1 min-w-0">
                                    <p className="truncate text-xs font-medium text-foreground">{info.tenant.name}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                      <span>{info.tenant.industry}</span>
                                      <span>·</span>
                                      <span className="flex items-center gap-0.5">
                                        <Building2 className="h-2.5 w-2.5" />
                                        {info.building.name}
                                      </span>
                                      <span>·</span>
                                      <span>{info.tenant.contactName}</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveProspect(list.id, p.tenantId)}
                                    className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProspectLists;

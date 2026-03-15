import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, X, UserPlus } from 'lucide-react';
import { type Building, type Tenant } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type StackingPlanProps = {
  building: Building;
  onTenantsChange?: (tenants: Tenant[]) => void;
};

type ManualTenant = {
  id: string;
  name: string;
  industry: string;
  sqft: number;
  floor: string;
  leaseExpiration: string;
  notes?: string;
};

type FloorEntry = {
  floor: number;
  tenants: { name: string; sqft: number; leaseExpiration: string; urgency: string; isManual?: boolean }[];
};

const STORAGE_KEY_PREFIX = 'stacking-tenants-';

function getManualTenants(buildingId: string): ManualTenant[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${buildingId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveManualTenants(buildingId: string, tenants: ManualTenant[]) {
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${buildingId}`, JSON.stringify(tenants));
}

const StackingPlan = ({ building, onTenantsChange }: StackingPlanProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [manualTenants, setManualTenants] = useState<ManualTenant[]>([]);
  const [newTenant, setNewTenant] = useState({ name: '', industry: '', sqft: '', floor: '', leaseExpiration: '' });

  useEffect(() => {
    setManualTenants(getManualTenants(building.id));
  }, [building.id]);

  const allTenants = useMemo(() => {
    const manualAsTenants: Tenant[] = manualTenants.map(mt => ({
      id: mt.id,
      name: mt.name,
      industry: mt.industry || 'Unknown',
      sqft: mt.sqft || 0,
      floor: mt.floor || '1',
      leaseExpiration: mt.leaseExpiration || 'N/A',
      contactName: '',
      contactTitle: '',
      contactEmail: '',
      headcount: 0,
      outreachReasons: [],
    }));
    return [...building.tenants, ...manualAsTenants];
  }, [building.tenants, manualTenants]);

  const floorData = useMemo(() => {
    const floors: FloorEntry[] = [];
    const maxFloor = Math.max(building.floors, ...allTenants.map(t => {
      if (t.floor.includes('-')) return Number(t.floor.split('-')[1]) || 1;
      return Number(t.floor) || 1;
    }));

    for (let f = maxFloor; f >= 1; f--) {
      const matchingTenants = allTenants.filter(t => {
        const floorStr = t.floor;
        if (floorStr.includes('-')) {
          const [start, end] = floorStr.split('-').map(Number);
          return f >= start && f <= end;
        }
        return Number(floorStr) === f;
      });

      const tenantEntries = matchingTenants.map(t => {
        const floorSpan = t.floor.includes('-')
          ? Number(t.floor.split('-')[1]) - Number(t.floor.split('-')[0]) + 1
          : 1;
        const highUrgency = t.outreachReasons?.some(r => r.urgency === 'high');
        const medUrgency = t.outreachReasons?.some(r => r.urgency === 'medium');
        const isManual = manualTenants.some(mt => mt.id === t.id);
        return {
          name: t.name,
          sqft: Math.round(t.sqft / floorSpan),
          leaseExpiration: t.leaseExpiration,
          urgency: highUrgency ? 'high' : medUrgency ? 'medium' : 'low',
          isManual,
        };
      });

      floors.push({ floor: f, tenants: tenantEntries });
    }

    return floors;
  }, [allTenants, building.floors, manualTenants]);

  const getUrgencyColor = (urgency: string, isManual?: boolean) => {
    if (isManual) return 'bg-accent/15 border-accent/30';
    switch (urgency) {
      case 'high': return 'bg-destructive/15 border-destructive/30';
      case 'medium': return 'bg-primary/15 border-primary/30';
      default: return 'bg-success/15 border-success/30';
    }
  };

  const handleAddTenant = () => {
    if (!newTenant.name.trim()) return;
    const mt: ManualTenant = {
      id: `manual-${Date.now()}`,
      name: newTenant.name.trim(),
      industry: newTenant.industry.trim(),
      sqft: Number(newTenant.sqft) || 0,
      floor: newTenant.floor.trim() || '1',
      leaseExpiration: newTenant.leaseExpiration.trim() || 'N/A',
    };
    const updated = [...manualTenants, mt];
    setManualTenants(updated);
    saveManualTenants(building.id, updated);
    setNewTenant({ name: '', industry: '', sqft: '', floor: '', leaseExpiration: '' });
    setShowAddForm(false);
    onTenantsChange?.(allTenants);
  };

  const handleRemoveManual = (id: string) => {
    const updated = manualTenants.filter(t => t.id !== id);
    setManualTenants(updated);
    saveManualTenants(building.id, updated);
  };

  const visibleFloors = expanded ? floorData : floorData.slice(0, 8);
  const hasMore = floorData.length > 8;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1 text-sm font-semibold text-foreground"
        >
          Stacking Plan
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] px-2 gap-1"
          onClick={() => setShowAddForm(prev => !prev)}
        >
          <UserPlus className="h-3 w-3" />
          Add Tenant
        </Button>
      </div>

      {/* Add Tenant Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-2 rounded-md border border-accent/30 bg-accent/5 p-2 space-y-1.5">
              <div className="flex gap-1.5">
                <Input
                  placeholder="Tenant name *"
                  value={newTenant.name}
                  onChange={e => setNewTenant(p => ({ ...p, name: e.target.value }))}
                  className="h-7 text-[11px]"
                />
                <Input
                  placeholder="Industry"
                  value={newTenant.industry}
                  onChange={e => setNewTenant(p => ({ ...p, industry: e.target.value }))}
                  className="h-7 text-[11px] w-24"
                />
              </div>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Floor"
                  value={newTenant.floor}
                  onChange={e => setNewTenant(p => ({ ...p, floor: e.target.value }))}
                  className="h-7 text-[11px] w-16"
                />
                <Input
                  placeholder="Sq Ft"
                  type="number"
                  value={newTenant.sqft}
                  onChange={e => setNewTenant(p => ({ ...p, sqft: e.target.value }))}
                  className="h-7 text-[11px] w-20"
                />
                <Input
                  placeholder="Lease exp (e.g. 6/2027)"
                  value={newTenant.leaseExpiration}
                  onChange={e => setNewTenant(p => ({ ...p, leaseExpiration: e.target.value }))}
                  className="h-7 text-[11px] flex-1"
                />
              </div>
              <div className="flex gap-1.5 justify-end">
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="h-6 text-[10px]" onClick={handleAddTenant} disabled={!newTenant.name.trim()}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-px">
        {visibleFloors.map((floor) => (
          <div
            key={floor.floor}
            className={`flex items-stretch gap-0 rounded-sm border overflow-hidden ${
              floor.tenants.length === 0 ? 'bg-muted/30 border-border' : 'border-border'
            }`}
          >
            <span className="w-5 shrink-0 text-[10px] font-bold text-muted-foreground flex items-center justify-center bg-background/50">
              {floor.floor}
            </span>
            <div className="flex-1 min-w-0">
              {floor.tenants.length === 0 ? (
                <div className="px-2 py-1">
                  <span className="text-[10px] italic text-muted-foreground/60">Vacant</span>
                </div>
              ) : (
                <div className="flex h-full">
                  {floor.tenants.map((t, i) => {
                    const totalSqft = floor.tenants.reduce((sum, tt) => sum + (tt.sqft || 1), 0);
                    const widthPct = totalSqft > 0 ? Math.max(((t.sqft || 1) / totalSqft) * 100, 20) : 100 / floor.tenants.length;
                    return (
                      <div
                        key={i}
                        className={`px-1.5 py-1 ${getUrgencyColor(t.urgency, t.isManual)} ${
                          i > 0 ? 'border-l border-border/50' : ''
                        }`}
                        style={{ width: floor.tenants.length > 1 ? `${widthPct}%` : '100%' }}
                      >
                        <div className="flex items-center justify-between gap-0.5">
                          <span className="text-[10px] font-medium text-foreground truncate">
                            {t.name}
                            {t.isManual && <span className="text-[8px] text-accent ml-0.5">✦</span>}
                          </span>
                          <span className="text-[8px] text-muted-foreground shrink-0">{t.leaseExpiration}</span>
                        </div>
                        {t.sqft > 0 && floor.tenants.length > 1 && (
                          <span className="text-[8px] text-muted-foreground">{(t.sqft / 1000).toFixed(0)}k SF</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 w-full text-center text-[10px] text-primary hover:underline"
        >
          +{floorData.length - 8} more floors
        </button>
      )}

      {/* Manual tenants list for removal */}
      {manualTenants.length > 0 && (
        <div className="mt-2 space-y-0.5">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Manually Added</p>
          {manualTenants.map(mt => (
            <div key={mt.id} className="flex items-center justify-between rounded px-1.5 py-0.5 bg-accent/5 text-[10px]">
              <span className="text-foreground font-medium truncate">{mt.name} <span className="text-muted-foreground">· Fl {mt.floor}</span></span>
              <button onClick={() => handleRemoveManual(mt.id)} className="text-muted-foreground hover:text-destructive ml-1">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-destructive/30" /> Urgent</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary/30" /> Medium</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success/30" /> Stable</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-muted/50" /> Vacant</span>
        {manualTenants.length > 0 && (
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent/30" /> Manual</span>
        )}
      </div>
    </div>
  );
};

export default StackingPlan;

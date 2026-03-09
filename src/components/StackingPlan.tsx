import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { type Building } from '@/data/mockData';

type StackingPlanProps = {
  building: Building;
};

type FloorEntry = {
  floor: number;
  tenants: { name: string; sqft: number; leaseExpiration: string; urgency: string }[];
};

const StackingPlan = ({ building }: StackingPlanProps) => {
  const [expanded, setExpanded] = useState(false);

  const floorData = useMemo(() => {
    const floors: FloorEntry[] = [];

    for (let f = building.floors; f >= 1; f--) {
      const matchingTenants = building.tenants.filter(t => {
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
        const highUrgency = t.outreachReasons.some(r => r.urgency === 'high');
        const medUrgency = t.outreachReasons.some(r => r.urgency === 'medium');
        return {
          name: t.name,
          sqft: Math.round(t.sqft / floorSpan),
          leaseExpiration: t.leaseExpiration,
          urgency: highUrgency ? 'high' : medUrgency ? 'medium' : 'low',
        };
      });

      floors.push({ floor: f, tenants: tenantEntries });
    }

    return floors;
  }, [building]);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'bg-destructive/15 border-destructive/30';
      case 'medium': return 'bg-primary/15 border-primary/30';
      default: return 'bg-success/15 border-success/30';
    }
  };

  const visibleFloors = expanded ? floorData : floorData.slice(0, 8);
  const hasMore = floorData.length > 8;

  return (
    <div className="w-full">
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="mb-2 flex w-full items-center justify-between text-sm font-semibold text-foreground"
      >
        Stacking Plan
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div className="space-y-px">
        {visibleFloors.map((floor) => (
          <div
            key={floor.floor}
            className={`flex items-center gap-1 rounded-sm border px-2 py-1 ${
              floor.tenants.length === 0 ? 'bg-muted/30 border-border' : getUrgencyColor(floor.tenants[0].urgency)
            }`}
          >
            <span className="w-5 shrink-0 text-[10px] font-bold text-muted-foreground">{floor.floor}</span>
            <div className="flex-1 min-w-0">
              {floor.tenants.length === 0 ? (
                <span className="text-[10px] italic text-muted-foreground/60">Vacant</span>
              ) : floor.tenants.length === 1 ? (
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-medium text-foreground truncate">{floor.tenants[0].name}</span>
                  <span className="text-[9px] text-muted-foreground shrink-0">{floor.tenants[0].leaseExpiration}</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-x-2">
                  {floor.tenants.map((t, i) => (
                    <span key={i} className="text-[10px] text-foreground">
                      <span className="font-medium">{t.name}</span>
                      <span className="text-muted-foreground ml-0.5">({t.leaseExpiration})</span>
                    </span>
                  ))}
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

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-destructive/30" /> Urgent</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary/30" /> Medium</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success/30" /> Stable</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-muted/50" /> Vacant</span>
      </div>
    </div>
  );
};

export default StackingPlan;

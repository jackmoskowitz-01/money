import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { type Building } from '@/data/mockData';

type StackingPlanProps = {
  building: Building;
};

const StackingPlan = ({ building }: StackingPlanProps) => {
  const floorData = useMemo(() => {
    const floors: { floor: number; tenant?: string; sqft: number; leaseExpiration?: string; urgency?: string }[] = [];

    for (let f = building.floors; f >= 1; f--) {
      const tenant = building.tenants.find(t => {
        const floorStr = t.floor;
        if (floorStr.includes('-')) {
          const [start, end] = floorStr.split('-').map(Number);
          return f >= start && f <= end;
        }
        return Number(floorStr) === f;
      });

      if (tenant) {
        const highUrgency = tenant.outreachReasons.some(r => r.urgency === 'high');
        const medUrgency = tenant.outreachReasons.some(r => r.urgency === 'medium');
        floors.push({
          floor: f,
          tenant: tenant.name,
          sqft: Math.round(tenant.sqft / (tenant.floor.includes('-') ? (Number(tenant.floor.split('-')[1]) - Number(tenant.floor.split('-')[0]) + 1) : 1)),
          leaseExpiration: tenant.leaseExpiration,
          urgency: highUrgency ? 'high' : medUrgency ? 'medium' : 'low',
        });
      } else {
        floors.push({ floor: f, sqft: Math.round(building.sqft / building.floors) });
      }
    }

    return floors;
  }, [building]);

  const getFloorColor = (floor: typeof floorData[0]) => {
    if (!floor.tenant) return 'bg-muted/30 border-border';
    switch (floor.urgency) {
      case 'high': return 'bg-destructive/15 border-destructive/30';
      case 'medium': return 'bg-primary/15 border-primary/30';
      default: return 'bg-success/15 border-success/30';
    }
  };

  return (
    <div className="w-full">
      <h3 className="mb-3 text-sm font-semibold text-foreground">Stacking Plan</h3>
      <div className="space-y-0.5">
        {floorData.map((floor, i) => (
          <motion.div
            key={floor.floor}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className={`flex items-center rounded-sm border px-3 py-1.5 ${getFloorColor(floor)}`}
          >
            <span className="w-6 text-[10px] font-bold text-muted-foreground">{floor.floor}</span>
            <div className="flex-1">
              {floor.tenant ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{floor.tenant}</span>
                  <span className="text-[10px] text-muted-foreground">{floor.leaseExpiration}</span>
                </div>
              ) : (
                <span className="text-[10px] italic text-muted-foreground/60">Vacant</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-destructive/30" /> Urgent</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-primary/30" /> Medium</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-success/30" /> Stable</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-muted/50" /> Vacant</span>
      </div>
    </div>
  );
};

export default StackingPlan;

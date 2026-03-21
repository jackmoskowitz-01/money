import { BarChart3, Users, Ruler, TrendingUp, Clock } from 'lucide-react';
import { buildings } from '@/data/mockData';
import type { PipelineItem } from '@/data/pipelineData';
import { Card } from '@/components/ui/card';

interface PipelineStatsProps {
  pipeline: PipelineItem[];
}

export const PipelineStats = ({ pipeline }: PipelineStatsProps) => {
  const prospects = pipeline.filter(p => p.stage === 'hot_prospect').length;
  const activeDeals = pipeline.filter(p => ['meeting_set', 'meeting_held', 'moving_forward'].includes(p.stage)).length;
  const totalSqft = pipeline.reduce((sum, p) => {
    if (p.isManual) return sum + (p.prospectSqft || 0);
    const building = buildings.find(b => b.id === p.buildingId);
    const tenant = building?.tenants.find(t => t.id === p.tenantId);
    return sum + (tenant?.sqft || 0);
  }, 0);
  const wonDeals = pipeline.filter(p => p.stage === 'won').length;
  const closedLost = pipeline.filter(p => ['closed', 'lost'].includes(p.stage)).length;
  const decidedTotal = wonDeals + closedLost;
  const winRate = decidedTotal > 0 ? Math.round((wonDeals / decidedTotal) * 100) : 0;
  const avgDaysInStage = (() => {
    const now = Date.now();
    const active = pipeline.filter(p => !['won', 'closed', 'lost'].includes(p.stage));
    if (active.length === 0) return 0;
    const totalDays = active.reduce((sum, p) => {
      return sum + Math.max(1, Math.round((now - new Date(p.lastActivity).getTime()) / 86400000));
    }, 0);
    return Math.round(totalDays / active.length);
  })();

  const stats = [
    { label: 'Prospects', value: prospects, icon: Users, color: 'text-warning' },
    { label: 'Active Deals', value: activeDeals, icon: BarChart3, color: 'text-info' },
    { label: 'Won', value: wonDeals, icon: TrendingUp, color: 'text-success' },
    { label: 'Total SF', value: totalSqft > 0 ? `${(totalSqft / 1000).toFixed(0)}K` : '0', icon: Ruler, color: 'text-primary' },
    { label: 'Win Rate', value: `${winRate}%`, icon: TrendingUp, color: winRate >= 20 ? 'text-success' : 'text-muted-foreground' },
    { label: 'Avg Days in Stage', value: avgDaysInStage, icon: Clock, color: avgDaysInStage > 14 ? 'text-destructive' : 'text-success' },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
      {stats.map(s => (
        <Card key={s.label} className="border-border bg-card p-3 flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary ${s.color}`}>
            <s.icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground leading-none">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        </Card>
      ))}
    </div>
  );
};

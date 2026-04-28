import { Card } from '@/components/ui/card';
import { useMemo } from 'react';
import { buildings } from '@/data/mockData';
import type { PipelineItem } from '@/data/pipelineData';

interface PipelineStatsProps {
  pipeline: PipelineItem[];
}

// Smooth synthetic sparkline series derived from current pipeline shape.
// Real implementation should pull a daily/weekly snapshot series from Supabase.
const seriesFor = (target: number, seed: number, len = 14): number[] => {
  const out: number[] = [];
  let v = target * 0.55;
  for (let i = 0; i < len; i++) {
    const wobble = Math.sin((i + seed) * 0.7) * (target * 0.04);
    const drift = (target - v) * 0.18;
    v += drift + wobble;
    out.push(Math.max(0, v));
  }
  out[len - 1] = target;
  return out;
};

const Spark = ({ values, hue = '213 94% 58%' }: { values: number[]; hue?: string }) => {
  const w = 240, h = 36;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return [x, y];
  });
  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const fillPath = `${linePath} L${w},${h} L0,${h} Z`;
  const id = `g-${hue.replace(/\s|%/g, '')}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute left-0 right-0 bottom-0 w-full h-9 block">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue})`} stopOpacity="0.35" />
          <stop offset="100%" stopColor={`hsl(${hue})`} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${id})`} />
      <path d={linePath} fill="none" stroke={`hsl(${hue})`} strokeWidth="1.5" />
    </svg>
  );
};

export const PipelineStats = ({ pipeline }: PipelineStatsProps) => {
  const sqftFor = (p: PipelineItem) => {
    if (p.isManual) return p.prospectSqft || 0;
    const b = buildings.find(x => x.id === p.buildingId);
    return b?.tenants.find(t => t.id === p.tenantId)?.sqft || 0;
  };

  // Weighted by stage probability
  const stageProb: Record<string, number> = {
    hot_prospect: 0.1,
    meeting_set: 0.25,
    meeting_held: 0.4,
    moving_forward: 0.65,
    won: 0.9,
    closed: 1,
    lost: 0,
  };

  const RENT_PER_SF = 65; // mock USD/sf/yr — replace with deal-level data when available

  const dollarFor = (p: PipelineItem) => sqftFor(p) * RENT_PER_SF;

  const totalValue = useMemo(
    () => pipeline.filter(p => !['lost'].includes(p.stage)).reduce((s, p) => s + dollarFor(p), 0),
    [pipeline]
  );
  const weightedValue = useMemo(
    () => pipeline.reduce((s, p) => s + dollarFor(p) * (stageProb[p.stage] ?? 0), 0),
    [pipeline]
  );
  const activeDeals = useMemo(
    () => pipeline.filter(p => !['closed', 'lost'].includes(p.stage)).length,
    [pipeline]
  );
  const avgSize = activeDeals > 0
    ? pipeline.filter(p => !['closed', 'lost'].includes(p.stage))
        .reduce((s, p) => s + dollarFor(p), 0) / activeDeals
    : 0;
  const won = pipeline.filter(p => p.stage === 'won' || p.stage === 'closed').length;
  const decided = won + pipeline.filter(p => p.stage === 'lost').length;
  const winRate = decided > 0 ? Math.round((won / decided) * 100) : 0;

  const fmtMoney = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const cards = [
    { label: 'Total Pipeline Value', value: fmtMoney(totalValue), delta: '+12% vs last month', series: seriesFor(totalValue, 1) },
    { label: 'Weighted Value', value: fmtMoney(weightedValue), delta: '+8% vs last month', series: seriesFor(weightedValue, 3) },
    { label: 'Active Deals', value: activeDeals.toString(), delta: '+15 vs last month', series: seriesFor(activeDeals, 5) },
    { label: 'Avg. Deal Size', value: fmtMoney(avgSize), delta: '+5% vs last month', series: seriesFor(avgSize, 7) },
    { label: 'Win Rate (YTD)', value: `${winRate}%`, delta: '+4% vs last month', series: seriesFor(Math.max(winRate, 1), 9) },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map(c => (
        <Card key={c.label} className="relative overflow-hidden border-border bg-card h-[116px] p-4 pb-0 rounded-xl">
          <div className="text-[11.5px] text-muted-foreground">{c.label}</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">{c.value}</div>
          <div className="mt-1 text-[10.5px] text-success">{c.delta}</div>
          <Spark values={c.series} />
        </Card>
      ))}
    </div>
  );
};

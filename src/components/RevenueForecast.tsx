import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPipeline, stageLabels, type PipelineStage } from '@/data/pipelineData';
import { buildings } from '@/data/mockData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Probability of closing by stage
const stageProbability: Record<PipelineStage, number> = {
  hot_prospect: 0.10,
  meeting_set: 0.20,
  meeting_held: 0.35,
  moving_forward: 0.60,
  won: 1.0,
  closed: 0,
  lost: 0,
};

// Estimated commission rate (% of annual rent)
const COMMISSION_RATE = 0.04; // 4% of first-year rent
const AVG_RENT_PSF = 55; // $55/SF average DC rent

const stageBarColors: Record<PipelineStage, string> = {
  hot_prospect: 'hsl(var(--destructive))',
  meeting_set: 'hsl(var(--info))',
  meeting_held: 'hsl(var(--primary))',
  moving_forward: 'hsl(var(--warning))',
  won: 'hsl(var(--success))',
  closed: 'hsl(var(--muted-foreground))',
  lost: 'hsl(var(--destructive))',
};

const formatCurrency = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const RevenueForecast = () => {
  const pipeline = getPipeline();

  const forecastData = useMemo(() => {
    const activeStages: PipelineStage[] = ['hot_prospect', 'meeting_set', 'meeting_held', 'moving_forward', 'won'];

    const stageForecasts = activeStages.map(stage => {
      const prospects = pipeline.filter(p => p.stage === stage);
      let totalSqft = 0;

      prospects.forEach(p => {
        if (p.isManual && p.prospectSqft) {
          totalSqft += p.prospectSqft;
        } else {
          const building = buildings.find(b => b.id === p.buildingId);
          const tenant = building?.tenants.find(t => t.id === p.tenantId);
          if (tenant) totalSqft += tenant.sqft;
        }
      });

      const grossRevenue = totalSqft * AVG_RENT_PSF * COMMISSION_RATE;
      const probability = stageProbability[stage];
      const weightedRevenue = grossRevenue * probability;

      return {
        stage,
        label: stageLabels[stage],
        count: prospects.length,
        totalSqft,
        grossRevenue,
        probability: Math.round(probability * 100),
        weightedRevenue,
      };
    });

    return stageForecasts;
  }, [pipeline]);

  const totalWeighted = forecastData.reduce((sum, d) => sum + d.weightedRevenue, 0);
  const totalGross = forecastData.reduce((sum, d) => sum + d.grossRevenue, 0);
  const wonRevenue = forecastData.find(d => d.stage === 'won')?.grossRevenue || 0;

  // Top deals by potential value
  const topDeals = useMemo(() => {
    return pipeline
      .filter(p => !['closed', 'lost'].includes(p.stage))
      .map(p => {
        let sqft = 0;
        let name = '';
        if (p.isManual) {
          sqft = p.prospectSqft || 0;
          name = p.prospectCompany || p.prospectName || 'Manual Prospect';
        } else {
          const building = buildings.find(b => b.id === p.buildingId);
          const tenant = building?.tenants.find(t => t.id === p.tenantId);
          sqft = tenant?.sqft || 0;
          name = tenant?.name || 'Unknown';
        }
        const gross = sqft * AVG_RENT_PSF * COMMISSION_RATE;
        const weighted = gross * stageProbability[p.stage];
        return { name, stage: p.stage, sqft, gross, weighted };
      })
      .sort((a, b) => b.weighted - a.weighted)
      .slice(0, 5);
  }, [pipeline]);

  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-success" />
          <h3 className="font-display text-sm font-bold">Revenue Forecast</h3>
        </div>
        <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
          {formatCurrency(totalWeighted)} weighted
        </Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-md bg-success/10 p-2.5 text-center">
          <p className="text-lg font-bold text-success">{formatCurrency(wonRevenue)}</p>
          <p className="text-[9px] text-success/70">Won Revenue</p>
        </div>
        <div className="rounded-md bg-primary/10 p-2.5 text-center">
          <p className="text-lg font-bold text-primary">{formatCurrency(totalWeighted)}</p>
          <p className="text-[9px] text-primary/70">Weighted Pipeline</p>
        </div>
        <div className="rounded-md bg-muted p-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{formatCurrency(totalGross)}</p>
          <p className="text-[9px] text-muted-foreground">Gross Pipeline</p>
        </div>
      </div>

      {/* Weighted Revenue by Stage Chart */}
      <div className="h-40 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={forecastData.filter(d => d.weightedRevenue > 0)} barCategoryGap="20%">
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => formatCurrency(v)}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              formatter={(value: number) => [formatCurrency(value), 'Weighted Rev']}
            />
            <Bar dataKey="weightedRevenue" radius={[4, 4, 0, 0]}>
              {forecastData.filter(d => d.weightedRevenue > 0).map((entry) => (
                <Cell key={entry.stage} fill={stageBarColors[entry.stage]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stage Breakdown Table */}
      <div className="mb-4">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">By Stage</p>
        <div className="space-y-1">
          {forecastData.filter(d => d.count > 0).map((d, i) => (
            <motion.div
              key={d.stage}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-2 py-1"
            >
              <span className="text-[10px] text-muted-foreground w-24 truncate">{d.label}</span>
              <Badge variant="outline" className="text-[8px] px-1 py-0">{d.count}</Badge>
              <span className="text-[10px] text-muted-foreground/60">{d.probability}%</span>
              <div className="flex-1 text-right">
                <span className="text-[10px] font-semibold text-foreground">{formatCurrency(d.weightedRevenue)}</span>
                <span className="text-[9px] text-muted-foreground/50 ml-1">/ {formatCurrency(d.grossRevenue)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Top Deals */}
      {topDeals.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top Deals by Value</p>
          <div className="space-y-1.5">
            {topDeals.map((deal, i) => (
              <motion.div
                key={deal.name}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-2 rounded-md bg-secondary/20 px-2.5 py-1.5"
              >
                <span className="text-[10px] font-semibold text-foreground truncate flex-1">{deal.name}</span>
                <Badge variant="outline" className="text-[8px] px-1 py-0 shrink-0">
                  {stageLabels[deal.stage]}
                </Badge>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {deal.sqft.toLocaleString()} SF
                </span>
                <span className="text-[10px] font-bold text-success shrink-0">
                  {formatCurrency(deal.weighted)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {pipeline.filter(p => !['closed', 'lost'].includes(p.stage)).length === 0 && (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-center">
          <AlertTriangle className="h-4 w-4 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground">Add prospects to your pipeline to see revenue forecasts</p>
        </div>
      )}
    </Card>
  );
};

export default RevenueForecast;

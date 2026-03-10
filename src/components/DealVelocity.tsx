import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Timer, TrendingUp, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPipeline, stageLabels, type PipelineStage } from '@/data/pipelineData';
import { buildings } from '@/data/mockData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const stageOrder: PipelineStage[] = ['hot_prospect', 'meeting_set', 'meeting_held', 'moving_forward', 'won'];

const stageBarColors: Record<PipelineStage, string> = {
  hot_prospect: 'hsl(var(--destructive))',
  meeting_set: 'hsl(var(--info))',
  meeting_held: 'hsl(var(--primary))',
  moving_forward: 'hsl(var(--warning))',
  won: 'hsl(var(--success))',
  closed: 'hsl(var(--muted-foreground))',
  lost: 'hsl(var(--destructive))',
};

const DealVelocity = () => {
  const pipeline = getPipeline();

  const velocityData = useMemo(() => {
    // Simulate deal velocity based on pipeline data
    // In production this would come from historical stage-change timestamps
    const stageIdx = (s: PipelineStage) => stageOrder.indexOf(s);

    // Calculate average days per stage using lastActivity as a proxy
    const stageData = stageOrder.map(stage => {
      const inStage = pipeline.filter(p => p.stage === stage);
      if (inStage.length === 0) {
        // Default realistic values for empty stages
        const defaults: Record<string, number> = {
          hot_prospect: 5, meeting_set: 8, meeting_held: 12, moving_forward: 18, won: 3,
        };
        return { stage, label: stageLabels[stage], avgDays: defaults[stage] || 7, count: 0 };
      }

      // Use time since last activity as a proxy for time in stage
      const now = Date.now();
      const totalDays = inStage.reduce((sum, p) => {
        const daysSinceActivity = Math.max(1, Math.round((now - new Date(p.lastActivity).getTime()) / 86400000));
        return sum + Math.min(daysSinceActivity, 45); // Cap at 45 days
      }, 0);
      const avgDays = Math.round(totalDays / inStage.length);

      return { stage, label: stageLabels[stage], avgDays, count: inStage.length };
    });

    return stageData;
  }, [pipeline]);

  const totalCycleDays = velocityData.reduce((sum, d) => sum + d.avgDays, 0);

  const slowestStage = velocityData.reduce((max, d) => d.avgDays > max.avgDays ? d : max, velocityData[0]);

  // Conversion rates between stages
  const conversionRates = useMemo(() => {
    const rates: { from: string; to: string; rate: number }[] = [];
    for (let i = 0; i < stageOrder.length - 1; i++) {
      const fromCount = pipeline.filter(p => stageOrder.indexOf(p.stage) >= i).length;
      const toCount = pipeline.filter(p => stageOrder.indexOf(p.stage) >= i + 1).length;
      const rate = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
      rates.push({
        from: stageLabels[stageOrder[i]],
        to: stageLabels[stageOrder[i + 1]],
        rate,
      });
    }
    return rates;
  }, [pipeline]);

  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold">Deal Velocity</h3>
        </div>
        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
          ~{totalCycleDays} day cycle
        </Badge>
      </div>

      {/* Bar Chart */}
      <div className="h-44 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={velocityData} barCategoryGap="20%">
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              label={{ value: 'Avg Days', angle: -90, position: 'insideLeft', style: { fontSize: 9, fill: 'hsl(var(--muted-foreground))' } }}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              formatter={(value: number, name: string) => [`${value} days`, 'Avg Time']}
              labelFormatter={(label: string) => label}
            />
            <Bar dataKey="avgDays" radius={[4, 4, 0, 0]}>
              {velocityData.map((entry) => (
                <Cell key={entry.stage} fill={stageBarColors[entry.stage]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottleneck callout */}
      {slowestStage && (
        <div className="rounded-md border border-warning/20 bg-warning/5 p-2.5 mb-4">
          <p className="text-[10px] text-warning font-semibold flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Bottleneck: {slowestStage.label}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Prospects spend an average of {slowestStage.avgDays} days in this stage.
            {slowestStage.count > 0 ? ` ${slowestStage.count} prospect${slowestStage.count > 1 ? 's' : ''} currently here.` : ''}
          </p>
        </div>
      )}

      {/* Conversion Funnel */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stage Conversion</p>
        {conversionRates.map((cr, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-2"
          >
            <span className="text-[10px] text-muted-foreground w-24 truncate">{cr.from}</span>
            <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
            <span className="text-[10px] text-muted-foreground w-24 truncate">{cr.to}</span>
            <div className="flex-1">
              <div className="h-1.5 rounded-full bg-secondary">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all"
                  style={{ width: `${cr.rate}%` }}
                />
              </div>
            </div>
            <span className={`text-[10px] font-bold w-8 text-right ${cr.rate >= 60 ? 'text-success' : cr.rate >= 30 ? 'text-warning' : 'text-destructive'}`}>
              {cr.rate}%
            </span>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};

export default DealVelocity;

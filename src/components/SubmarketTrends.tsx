import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { submarketTrends } from '@/data/activityData';

const metrics = ['vacancy', 'absorption', 'rentPerSf'] as const;
const metricLabels: Record<string, string> = {
  vacancy: 'Vacancy Rate (%)',
  absorption: 'Net Absorption (SF)',
  rentPerSf: 'Avg Rent ($/SF)',
};

const SubmarketTrends = () => {
  const [selectedMetric, setSelectedMetric] = useState<typeof metrics[number]>('vacancy');
  const [selectedSubmarkets, setSelectedSubmarkets] = useState<string[]>(submarketTrends.map(s => s.submarket));

  const toggleSubmarket = (sm: string) => {
    setSelectedSubmarkets(prev =>
      prev.includes(sm) ? prev.filter(s => s !== sm) : [...prev, sm]
    );
  };

  const colors = ['hsl(38, 92%, 55%)', 'hsl(210, 70%, 55%)', 'hsl(152, 60%, 45%)', 'hsl(0, 72%, 51%)'];

  // Build chart data
  const chartData = submarketTrends[0].quarters.map((q, qi) => {
    const point: Record<string, any> = { quarter: q.quarter.replace('Q', 'Q') };
    submarketTrends.forEach(sm => {
      if (selectedSubmarkets.includes(sm.submarket)) {
        point[sm.submarket] = sm.quarters[qi][selectedMetric];
      }
    });
    return point;
  });

  return (
    <Card className="border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">Submarket Trends</h3>
        <div className="flex gap-1.5">
          {metrics.map(m => (
            <button
              key={m}
              onClick={() => setSelectedMetric(m)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                selectedMetric === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {metricLabels[m].split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Submarket toggles */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {submarketTrends.map((sm, i) => (
          <button
            key={sm.submarket}
            onClick={() => toggleSubmarket(sm.submarket)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              selectedSubmarkets.includes(sm.submarket) ? 'bg-primary/20 text-primary' : 'bg-secondary/50 text-muted-foreground/50'
            }`}
          >
            <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colors[i] }} />
            {sm.submarket}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          {selectedMetric === 'absorption' ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 25%, 16%)" />
              <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: 'hsl(215, 15%, 50%)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215, 15%, 50%)' }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '6px', fontSize: '11px' }}
                formatter={(v: number) => `${v.toLocaleString()} SF`}
              />
              {submarketTrends.map((sm, i) =>
                selectedSubmarkets.includes(sm.submarket) ? (
                  <Bar key={sm.submarket} dataKey={sm.submarket} fill={colors[i]} opacity={0.8} />
                ) : null
              )}
            </BarChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 25%, 16%)" />
              <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: 'hsl(215, 15%, 50%)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215, 15%, 50%)' }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '6px', fontSize: '11px' }}
                formatter={(v: number) => selectedMetric === 'vacancy' ? `${v}%` : `$${v}/SF`}
              />
              {submarketTrends.map((sm, i) =>
                selectedSubmarkets.includes(sm.submarket) ? (
                  <Line key={sm.submarket} type="monotone" dataKey={sm.submarket} stroke={colors[i]} strokeWidth={2} dot={{ r: 3 }} />
                ) : null
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default SubmarketTrends;

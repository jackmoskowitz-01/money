import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getActivities, getAssignments, brokers } from '@/data/activityData';
import { getPipeline } from '@/data/pipelineData';

const BROKER_COLORS = [
  'hsl(38, 92%, 55%)',
  'hsl(210, 70%, 55%)',
  'hsl(152, 60%, 45%)',
  'hsl(25, 85%, 55%)',
];

const BrokerLeaderboard = () => {
  const activities = getActivities();
  const assignments = getAssignments();
  const pipeline = getPipeline();

  const { barData, pieData } = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 3600000;

    const brokerStats = brokers.map((broker, i) => {
      const brokerAssignments = assignments.filter(a => a.brokerId === broker.id);
      const tenantIds = new Set(brokerAssignments.map(a => a.tenantId));

      const weekActivities = activities.filter(
        a => tenantIds.has(a.tenantId) && now - new Date(a.timestamp).getTime() < weekMs
      );

      // Count outreach activities (emails, calls, ai_emails)
      const outreach = weekActivities.filter(
        a => a.type === 'email_sent' || a.type === 'call' || a.type === 'ai_email'
      ).length;

      // Meetings set this week
      const meetingsSet = pipeline.filter(p => {
        if (p.stage !== 'meeting_set' && p.stage !== 'meeting_held') return false;
        return brokerAssignments.some(
          a => a.tenantId === p.tenantId && a.buildingId === p.buildingId
        ) && now - new Date(p.lastActivity).getTime() < weekMs;
      }).length;

      return {
        name: broker.name.split(' ')[0],
        fullName: broker.name,
        outreach,
        meetingsSet,
        color: BROKER_COLORS[i % BROKER_COLORS.length],
      };
    });

    return {
      barData: [...brokerStats].sort((a, b) => b.outreach - a.outreach),
      pieData: brokerStats.filter(b => b.meetingsSet > 0),
    };
  }, [activities, assignments, pipeline]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
        <p className="text-xs font-semibold text-foreground">{payload[0]?.payload?.fullName || label}</p>
        <p className="text-[11px] text-muted-foreground">{payload[0]?.value} outreach activities</p>
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 shadow-lg">
        <p className="text-xs font-semibold text-foreground">{payload[0]?.payload?.fullName}</p>
        <p className="text-[11px] text-muted-foreground">{payload[0]?.value} meetings set</p>
      </div>
    );
  };

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      {/* Bar Chart - Outreach */}
      <Card className="border-border bg-card p-3 col-span-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xs font-bold">Outreach by Broker</h3>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0">This Week</Badge>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={barData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 25%, 16%)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(215, 15%, 50%)' }} axisLine={false} tickLine={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: 'hsl(210, 20%, 92%)', fontWeight: 500 }} axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(222, 30%, 14%, 0.5)' }} />
            <Bar dataKey="outreach" radius={[0, 4, 4, 0]} barSize={24}>
              {barData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Pie Chart - Meetings Set */}
      <Card className="border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-bold">Meetings Set by Broker</h3>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0">This Week</Badge>
        </div>
        {pieData.length === 0 ? (
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-xs text-muted-foreground">No meetings set this week</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={3}
                dataKey="meetingsSet"
                nameKey="fullName"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="hsl(222, 40%, 9%)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend
                formatter={(value: string) => (
                  <span className="text-[11px] text-foreground">{value}</span>
                )}
                iconSize={8}
                wrapperStyle={{ fontSize: 11 }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};

export default BrokerLeaderboard;

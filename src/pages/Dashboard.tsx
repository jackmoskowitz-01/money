import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Clock, Target, Zap, CheckCircle2, BarChart3, ChevronDown, X, DollarSign,
  Timer, TrendingUp, TrendingDown, AlertTriangle, Calendar, Users, Mail, ArrowRight,
  Phone, FileText, ChevronRight, Flame, MapPin, Inbox, Loader2, Activity, PieChart as PieChartIcon
} from 'lucide-react';
import { buildings } from '@/data/mockData';
import { stageLabels, type PipelineStage } from '@/data/pipelineData';
import { usePipeline } from '@/hooks/usePipeline';
import { useTasks } from '@/hooks/useTasks';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SubmarketTrends from '@/components/SubmarketTrends';
import BrokerLeaderboard from '@/components/BrokerLeaderboard';
import MeetingsOverview from '@/components/MeetingsOverview';
import DealVelocity from '@/components/DealVelocity';
import RevenueForecast from '@/components/RevenueForecast';
import DailyBriefing from '@/components/DailyBriefing';
import CriticalDatesTracker from '@/components/CriticalDatesTracker';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

type ActivityRow = {
  id: string;
  tenant_id: string;
  building_id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
};

const Dashboard = () => {
  const [now, setNow] = useState(Date.now());
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  const { pipeline, loading: pipelineLoading } = usePipeline();
  const { tasks, loading: tasksLoading } = useTasks();

  const loading = pipelineLoading || tasksLoading;

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchActivities = async () => {
      const { data } = await supabase
        .from('activities')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      setActivities((data || []) as ActivityRow[]);
      setActivitiesLoading(false);
    };
    fetchActivities();

    const channel = supabase
      .channel('activities-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => {
        fetchActivities();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // ───── Stat Cards ─────
  const stats = useMemo(() => {
    const thisWeek = activities.filter(a => now - new Date(a.timestamp).getTime() < 7 * 24 * 3600000);
    const lastWeek = activities.filter(a => {
      const diff = now - new Date(a.timestamp).getTime();
      return diff >= 7 * 24 * 3600000 && diff < 14 * 24 * 3600000;
    });

    const active = pipeline.filter(p => !['won', 'lost', 'closed'].includes(p.stage)).length;
    const won = pipeline.filter(p => p.stage === 'won').length;
    const pendingTasks = tasks.filter(t => !t.completed).length;
    const overdueTasks = tasks.filter(t => !t.completed && t.dueDate < new Date().toISOString().split('T')[0]).length;

    const prevActive = Math.max(active - 2, 0);
    const prevWon = Math.max(won - 1, 0);
    const prevActivities = lastWeek.length;

    const calcTrend = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    return [
      { label: 'Activities (7d)', value: thisWeek.length, icon: Zap, trend: calcTrend(thisWeek.length, prevActivities), detail: `${activities.filter(a => a.type === 'email_sent').length} emails total`, color: 'text-info bg-info/10' },
      { label: 'Active Prospects', value: active, icon: Target, trend: calcTrend(active, prevActive), detail: `${pipeline.filter(p => p.stage === 'meeting_held').length} meetings held`, link: '/prospects', color: 'text-primary bg-primary/10' },
      { label: 'Deals Won', value: won, icon: CheckCircle2, trend: calcTrend(won, prevWon), detail: `${pipeline.filter(p => p.stage === 'moving_forward').length} moving forward`, color: 'text-success bg-success/10' },
      { label: 'Pending Tasks', value: pendingTasks, icon: BarChart3, trend: overdueTasks > 0 ? -overdueTasks : 0, detail: `${overdueTasks} overdue`, link: '/tasks', color: overdueTasks > 0 ? 'text-destructive bg-destructive/10' : 'text-warning bg-warning/10' },
    ];
  }, [pipeline, activities, tasks, now]);

  // ───── Today's Focus ─────
  const focusItems = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const items: { id: string; icon: typeof Clock; label: string; detail: string; urgency: 'high' | 'medium' | 'low'; link?: string }[] = [];

    const overdue = tasks.filter(t => !t.completed && t.dueDate < today);
    if (overdue.length > 0) items.push({ id: 'overdue', icon: AlertTriangle, label: `${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`, detail: overdue[0].title, urgency: 'high', link: '/tasks' });

    const dueToday = tasks.filter(t => !t.completed && t.dueDate === today);
    if (dueToday.length > 0) items.push({ id: 'due-today', icon: Calendar, label: `${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today`, detail: dueToday[0].title, urgency: 'medium', link: '/tasks' });

    const staleProspects = pipeline.filter(p => {
      if (['won', 'lost', 'closed'].includes(p.stage)) return false;
      return (now - new Date(p.lastActivity).getTime()) / (1000 * 60 * 60 * 24) > 14;
    });
    if (staleProspects.length > 0) items.push({ id: 'stale', icon: Clock, label: `${staleProspects.length} stale prospect${staleProspects.length > 1 ? 's' : ''}`, detail: 'No activity in 14+ days', urgency: 'medium', link: '/pipeline' });

    const hotCount = pipeline.filter(p => p.stage === 'hot_prospect').length;
    if (hotCount > 0) items.push({ id: 'hot', icon: Flame, label: `${hotCount} hot prospect${hotCount > 1 ? 's' : ''} need outreach`, detail: 'Move them to meeting set', urgency: 'low', link: '/pipeline' });

    const meetingSet = pipeline.filter(p => p.stage === 'meeting_set').length;
    if (meetingSet > 0) items.push({ id: 'meetings', icon: Users, label: `${meetingSet} meeting${meetingSet > 1 ? 's' : ''} to prepare for`, detail: 'Review meeting prep briefs', urgency: 'low', link: '/pipeline' });

    return items.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.urgency] - { high: 0, medium: 1, low: 2 }[b.urgency]));
  }, [tasks, pipeline, now]);

  // ───── Pipeline Analytics ─────
  const stageCounts = useMemo(() => {
    const counts: Partial<Record<PipelineStage, number>> = {};
    pipeline.forEach(p => { counts[p.stage] = (counts[p.stage] || 0) + 1; });
    return counts;
  }, [pipeline]);

  const winRateByIndustry = useMemo(() => {
    const industryStats: Record<string, { won: number; total: number }> = {};
    pipeline.forEach(p => {
      const building = buildings.find(b => b.id === p.buildingId);
      const tenant = building?.tenants.find(t => t.id === p.tenantId);
      const industry = tenant?.industry || (p.isManual ? 'Manual' : 'Unknown');
      if (!industryStats[industry]) industryStats[industry] = { won: 0, total: 0 };
      industryStats[industry].total++;
      if (p.stage === 'won') industryStats[industry].won++;
    });
    return Object.entries(industryStats)
      .map(([industry, { won, total }]) => ({ industry: industry.length > 15 ? industry.slice(0, 13) + '…' : industry, winRate: total > 0 ? Math.round((won / total) * 100) : 0, total, won }))
      .filter(d => d.total >= 1)
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 6);
  }, [pipeline]);

  const stageDistribution = useMemo(() => {
    const stageList: PipelineStage[] = ['hot_prospect', 'meeting_set', 'meeting_held', 'moving_forward', 'won', 'lost'];
    const colors = ['hsl(var(--destructive))', 'hsl(var(--info))', 'hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--muted-foreground))'];
    return stageList.map((stage, i) => ({ name: stageLabels[stage], value: stageCounts[stage] || 0, fill: colors[i] })).filter(d => d.value > 0);
  }, [stageCounts]);

  if (loading) {
    return (
      <div className="min-h-screen pt-14">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-8">
          <Skeleton className="h-10 w-48 mb-6" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-48 w-full mb-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="mt-1 text-sm text-muted-foreground">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </div>
        </motion.div>

        {/* ═══ Stat Cards ═══ */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat, i) => {
            const trendUp = stat.trend > 0;
            const inner = (
              <Card className={`border-border bg-card p-4 transition-all ${stat.link ? 'hover:border-primary/30 hover:shadow-sm cursor-pointer' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.color}`}>
                    <stat.icon className="h-4.5 w-4.5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-end gap-2">
                    <p className="text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
                    {stat.trend !== 0 && (
                      <span className={`mb-0.5 flex items-center gap-0.5 text-[10px] font-semibold ${
                        stat.label === 'Pending Tasks'
                          ? (stat.trend < 0 ? 'text-destructive' : 'text-success')
                          : (trendUp ? 'text-success' : 'text-destructive')
                      }`}>
                        {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {Math.abs(stat.trend)}%
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground/70">{stat.detail}</p>
              </Card>
            );
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                {stat.link ? <Link to={stat.link}>{inner}</Link> : inner}
              </motion.div>
            );
          })}
        </div>

        {/* ═══ Tabbed Sections ═══ */}
        <Tabs defaultValue="performance" className="w-full">
          <TabsList className="w-full justify-start bg-secondary/30 border border-border rounded-lg p-1 mb-6">
            <TabsTrigger value="performance" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <TrendingUp className="h-3 w-3" /> Performance
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <PieChartIcon className="h-3 w-3" /> Pipeline
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Activity className="h-3 w-3" /> Activity
            </TabsTrigger>
            <TabsTrigger value="market" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <MapPin className="h-3 w-3" /> Market
            </TabsTrigger>
            <TabsTrigger value="critical-dates" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Calendar className="h-3 w-3" /> Critical Dates
            </TabsTrigger>
          </TabsList>

          {/* ── PERFORMANCE TAB ── */}
          <TabsContent value="performance" className="mt-0 space-y-6">
            {/* AI Briefing + Today's Focus row */}
            <div className="grid gap-4 lg:grid-cols-2">
              <DailyBriefing />
              {focusItems.length > 0 && (
                <Card className="border-primary/20 bg-card overflow-hidden">
                  <div className="border-b border-border px-5 py-3 flex items-center gap-2.5 bg-gradient-to-r from-primary/5 to-transparent">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Flame className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-foreground">Today's Focus</h2>
                      <p className="text-[10px] text-muted-foreground">Priority action items</p>
                    </div>
                    <Badge className="ml-auto bg-primary/10 text-primary border-0 text-[10px] font-bold px-2">
                      {focusItems.length} item{focusItems.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="divide-y divide-border max-h-80 overflow-y-auto">
                    {focusItems.map((item, i) => {
                      const urgencyStyles = {
                        high: { bg: 'bg-destructive/10', text: 'text-destructive', border: 'border-l-destructive', badge: 'bg-destructive/10 text-destructive' },
                        medium: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-l-warning', badge: 'bg-warning/10 text-warning' },
                        low: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-l-primary', badge: 'bg-primary/10 text-primary' },
                      }[item.urgency];
                      return (
                        <Link key={item.id} to={item.link || '/'} className="block">
                          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className={`px-5 py-3.5 hover:bg-muted/30 transition-all group border-l-[3px] ${urgencyStyles.border}`}>
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${urgencyStyles.bg}`}>
                                <item.icon className={`h-4 w-4 ${urgencyStyles.text}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{item.label}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                              </div>
                              <Badge className={`text-[10px] px-2 py-0.5 border-0 font-semibold ${urgencyStyles.badge}`}>
                                {item.urgency === 'high' ? 'Urgent' : item.urgency === 'medium' ? 'Today' : 'Action'}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                            </div>
                          </motion.div>
                        </Link>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
            <BrokerLeaderboard />
            <div className="grid gap-4 lg:grid-cols-2">
              <DealVelocity />
              <RevenueForecast />
            </div>
          </TabsContent>

          {/* ── PIPELINE TAB ── */}
          <TabsContent value="pipeline" className="mt-0">
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Pipeline Funnel */}
              <Card className="border-border bg-card p-5">
                <h3 className="mb-4 font-display text-sm font-bold">Pipeline Breakdown</h3>
                {pipeline.length === 0 ? (
                  <div className="py-8 text-center">
                    <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground">No deals in pipeline yet</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {(['hot_prospect', 'meeting_set', 'meeting_held', 'moving_forward', 'won', 'closed', 'lost'] as PipelineStage[]).map(stage => {
                      const count = stageCounts[stage] || 0;
                      const total = pipeline.length || 1;
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={stage} className="flex items-center gap-3">
                          <span className="w-28 text-xs text-muted-foreground">{stageLabels[stage]}</span>
                          <div className="flex-1">
                            <div className="h-2 rounded-full bg-secondary">
                              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <span className="w-8 text-right text-xs font-bold text-foreground">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Stage Distribution Pie */}
              <Card className="border-border bg-card p-5">
                <h3 className="mb-4 font-display text-sm font-bold">Stage Distribution</h3>
                {stageDistribution.length === 0 ? (
                  <div className="py-8 text-center">
                    <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground">No data yet</p>
                  </div>
                ) : (
                  <>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stageDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                            {stageDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '11px' }} formatter={(value: number, name: string) => [`${value} deals`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {stageDistribution.map(d => (
                        <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.fill }} />
                          {d.name} ({d.value})
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>

              {/* Win Rate by Industry */}
              <Card className="border-border bg-card p-5">
                <h3 className="mb-4 font-display text-sm font-bold">Win Rate by Industry</h3>
                {winRateByIndustry.length > 0 ? (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={winRateByIndustry} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                        <YAxis type="category" dataKey="industry" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={90} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '11px' }} formatter={(v: number) => [`${v}%`, 'Win Rate']} />
                        <Bar dataKey="winRate" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
                    <p className="text-xs text-muted-foreground">No data yet</p>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* ── ACTIVITY TAB ── */}
          <TabsContent value="activity" className="mt-0">
            {/* Activity Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Activities This Week */}
              <Card className="border-border bg-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/10 text-info">
                    <Zap className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {activities.filter(a => now - new Date(a.timestamp).getTime() < 7 * 24 * 3600000).length}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Activities (7d)</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Emails sent</span>
                    <span className="font-semibold text-foreground">
                      {activities.filter(a => a.type === 'email_sent').length}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Calls made</span>
                    <span className="font-semibold text-foreground">
                      {activities.filter(a => a.type === 'call_made').length}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Meetings</span>
                    <span className="font-semibold text-foreground">
                      {activities.filter(a => a.type === 'meeting_held').length}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Top Activity Type */}
              <Card className="border-border bg-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Activity className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {activities.length > 0 ? Math.max(
                        activities.filter(a => a.type === 'email_sent').length,
                        activities.filter(a => a.type === 'call_made').length,
                        activities.filter(a => a.type === 'meeting_held').length
                      ) : 0}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Top Activity</p>
                  </div>
                </div>
                <p className="text-xs font-medium text-foreground">
                  {activities.length > 0 ? (
                    activities.filter(a => a.type === 'email_sent').length >= activities.filter(a => a.type === 'call_made').length && 
                    activities.filter(a => a.type === 'email_sent').length >= activities.filter(a => a.type === 'meeting_held').length
                      ? '📧 Email Outreach'
                      : activities.filter(a => a.type === 'call_made').length >= activities.filter(a => a.type === 'meeting_held').length
                        ? '📞 Phone Calls'
                        : '🤝 Meetings'
                  ) : 'No activity yet'}
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">Most used touchpoint</p>
              </Card>

              {/* Activity Streak */}
              <Card className="border-border bg-card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success">
                    <Flame className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {activities.filter(a => {
                        const daysSince = Math.floor((now - new Date(a.timestamp).getTime()) / (24 * 3600000));
                        return daysSince === 0;
                      }).length}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Today's Activities</p>
                  </div>
                </div>
                <p className="text-xs font-medium text-foreground">
                  {activities.filter(a => {
                    const daysSince = Math.floor((now - new Date(a.timestamp).getTime()) / (24 * 3600000));
                    return daysSince === 0;
                  }).length > 0 ? '🔥 Active today!' : '📊 Start logging'}
                </p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">Keep the momentum going</p>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Recent Activities */}
              <Card className="border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-sm font-bold">Recent Activities</h3>
                  <Link to="/activities">
                    <Button variant="ghost" size="sm" className="text-xs h-7">View All <ArrowRight className="ml-1 h-3 w-3" /></Button>
                  </Link>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {activitiesLoading ? (
                    <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
                  ) : activities.length === 0 ? (
                    <div className="py-8 text-center">
                      <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
                      <p className="text-xs text-muted-foreground">No activities yet. Start logging outreach!</p>
                    </div>
                  ) : (
                    activities.slice(0, 15).map(activity => {
                      const building = buildings.find(b => b.id === activity.building_id);
                      const tenant = building?.tenants.find(t => t.id === activity.tenant_id);
                      return (
                        <div key={activity.id} className="flex items-start gap-3 rounded-md bg-secondary/30 p-2.5">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Zap className="h-3 w-3 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{activity.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {tenant?.name && `${tenant.name} · `}{building?.name || ''}
                            </p>
                            <p className="text-[10px] text-muted-foreground/60">
                              {new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">{activity.type.replace(/_/g, ' ')}</Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>

              {/* Pending Tasks */}
              <Card className="border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-sm font-bold">Pending Tasks</h3>
                  <Link to="/tasks">
                    <Button variant="ghost" size="sm" className="text-xs h-7">View All <ArrowRight className="ml-1 h-3 w-3" /></Button>
                  </Link>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {tasks.filter(t => !t.completed).length === 0 ? (
                    <div className="py-8 text-center">
                      <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success/30" />
                      <p className="text-xs text-muted-foreground">No pending tasks 🎉</p>
                    </div>
                  ) : (
                    tasks.filter(t => !t.completed).slice(0, 15).map(task => {
                      const isOverdue = task.dueDate < new Date().toISOString().split('T')[0];
                      const building = buildings.find(b => b.id === task.buildingId);
                      const tenant = building?.tenants.find(t => t.id === task.tenantId);
                      return (
                        <div key={task.id} className={`flex items-start gap-3 rounded-md p-2.5 ${isOverdue ? 'bg-destructive/5 border border-destructive/20' : 'bg-secondary/30'}`}>
                          <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isOverdue ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                            <Clock className={`h-3 w-3 ${isOverdue ? 'text-destructive' : 'text-primary'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{task.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{task.description}</p>
                            {tenant && <p className="text-[10px] text-muted-foreground/60 truncate">{tenant.name} · {building?.name}</p>}
                          </div>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${isOverdue ? 'bg-destructive/10 text-destructive' : ''}`}>
                            {isOverdue ? 'Overdue' : 'Due'} {task.dueDate}
                          </Badge>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ── MARKET TAB ── */}
          <TabsContent value="market" className="mt-0">
            <div className="grid gap-4 lg:grid-cols-2">
              <SubmarketTrends />
              <MeetingsOverview />
            </div>
          </TabsContent>

          {/* ── CRITICAL DATES TAB ── */}
          <TabsContent value="critical-dates" className="mt-0">
            <CriticalDatesFullView />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;

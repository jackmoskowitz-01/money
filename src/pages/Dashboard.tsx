import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Building2, Clock, ExternalLink, Filter, Target, Zap, CheckCircle2, BarChart3, ChevronDown, X, Users, Mail, Loader2, Copy, Check, Send } from 'lucide-react';
import { newsItems, buildings, getCategoryColor, type NewsItem, type Tenant, type Building } from '@/data/mockData';
import { getPipeline, stageLabels, type PipelineStage } from '@/data/pipelineData';
import { getActivities, getTasks, getAssignments, brokers } from '@/data/activityData';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import SubmarketTrends from '@/components/SubmarketTrends';
import EmailDisplay from '@/components/EmailDisplay';

const categories = ['all', 'lease', 'sale', 'expansion', 'vacancy', 'market', 'contraction'] as const;

const Dashboard = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedStat, setExpandedStat] = useState<string | null>(null);
  // Personal analytics
  const pipeline = getPipeline();
  const activities = getActivities();
  const tasks = getTasks();
  const assignments = getAssignments();

  const stats = useMemo(() => {
    const won = pipeline.filter(p => p.stage === 'won').length;
    const active = pipeline.filter(p => !['won', 'lost'].includes(p.stage)).length;
    const activitiesThisWeek = activities.filter(a => {
      const diff = Date.now() - new Date(a.timestamp).getTime();
      return diff < 7 * 24 * 3600000;
    }).length;
    const pendingTasks = tasks.filter(t => !t.completed).length;

    return [
      { label: 'Active Prospects', value: String(active), icon: Target, trend: `${pipeline.filter(p => p.stage === 'contacted').length} contacted`, link: '/prospects' },
      { label: 'Deals Won', value: String(won), icon: CheckCircle2, trend: `${pipeline.filter(p => p.stage === 'proposal_sent').length} proposals out` },
      { label: 'Activities (7d)', value: String(activitiesThisWeek), icon: Zap, trend: `${activities.filter(a => a.type === 'email_sent').length} emails total` },
      { label: 'Pending Tasks', value: String(pendingTasks), icon: BarChart3, trend: `${tasks.filter(t => !t.completed && t.dueDate < new Date().toISOString().split('T')[0]).length} overdue`, link: '/tasks' },
    ];
  }, [pipeline, activities, tasks]);

  // Pipeline stage breakdown
  const stageCounts = useMemo(() => {
    const counts: Partial<Record<PipelineStage, number>> = {};
    pipeline.forEach(p => { counts[p.stage] = (counts[p.stage] || 0) + 1; });
    return counts;
  }, [pipeline]);

  // Broker leaderboard
  const brokerStats = useMemo(() => {
    return brokers.map(broker => {
      const brokerAssignments = assignments.filter(a => a.brokerId === broker.id);
      const brokerActivities = activities.filter(a =>
        brokerAssignments.some(ba => ba.tenantId === a.tenantId)
      );
      return {
        ...broker,
        prospects: brokerAssignments.length,
        activities: brokerActivities.length,
      };
    }).sort((a, b) => b.activities - a.activities);
  }, [assignments, activities]);

  const filteredNews = activeCategory === 'all'
    ? newsItems
    : newsItems.filter(n => n.category === activeCategory);

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Your pipeline performance and market intelligence
          </p>
        </motion.div>

        {/* Personal Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat, i) => {
            const isExpandable = stat.label === 'Activities (7d)' || stat.label === 'Pending Tasks';
            const isExpanded = expandedStat === stat.label;
            const inner = (
              <Card
                className={`border-border bg-card p-4 transition-colors ${stat.link || isExpandable ? 'hover:border-primary/30 hover:bg-secondary/30 cursor-pointer' : ''}`}
                onClick={isExpandable ? () => setExpandedStat(isExpanded ? null : stat.label) : undefined}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <stat.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                  {isExpandable && (
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{stat.trend}</p>
              </Card>
            );
            return (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                {stat.link && !isExpandable ? <Link to={stat.link}>{inner}</Link> : inner}
              </motion.div>
            );
          })}
        </div>

        {/* Expanded Activities / Tasks Drawer */}
        <AnimatePresence>
          {expandedStat === 'Activities (7d)' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-8"
            >
              <Card className="border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold">Recent Activities</h3>
                  <div className="flex items-center gap-2">
                    <Link to="/activities">
                      <Button variant="ghost" size="sm" className="text-xs h-7">View All →</Button>
                    </Link>
                    <button onClick={() => setExpandedStat(null)} className="rounded p-1 hover:bg-secondary">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {activities.slice(0, 10).map(activity => {
                    const building = buildings.find(b => b.id === activity.buildingId);
                    const tenant = building?.tenants.find(t => t.id === activity.tenantId);
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
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                          {activity.type.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}

          {expandedStat === 'Pending Tasks' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-8"
            >
              <Card className="border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold">Pending Tasks</h3>
                  <div className="flex items-center gap-2">
                    <Link to="/tasks">
                      <Button variant="ghost" size="sm" className="text-xs h-7">View All →</Button>
                    </Link>
                    <button onClick={() => setExpandedStat(null)} className="rounded p-1 hover:bg-secondary">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {tasks.filter(t => !t.completed).slice(0, 10).map(task => {
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
                          {tenant && (
                            <p className="text-[10px] text-muted-foreground/60 truncate">
                              {tenant.name} · {building?.name}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${isOverdue ? 'bg-destructive/10 text-destructive' : ''}`}>
                            {isOverdue ? 'Overdue' : 'Due'} {task.dueDate}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                  {tasks.filter(t => !t.completed).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No pending tasks 🎉</p>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pipeline Breakdown + Submarket Trends */}
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          {/* Pipeline Funnel */}
          <Card className="border-border bg-card p-4">
            <h3 className="mb-3 font-display text-sm font-bold">Pipeline Breakdown</h3>
            <div className="space-y-2">
              {(['not_contacted', 'contacted', 'meeting_set', 'proposal_sent', 'won', 'lost'] as PipelineStage[]).map(stage => {
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
          </Card>

          {/* Submarket Trends */}
          <SubmarketTrends />
        </div>

        {/* Team + Broker Leaderboard */}
        <div className="mb-8">
          <Card className="border-border bg-card p-4">
            <h3 className="mb-3 font-display text-sm font-bold">Team Activity</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {brokerStats.map(broker => (
                <div key={broker.id} className="rounded-md bg-secondary/50 p-3 text-center">
                  <div className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${broker.color}`}>
                    {broker.initials}
                  </div>
                  <p className="text-xs font-medium text-foreground">{broker.name}</p>
                  <p className="text-[11px] text-muted-foreground">{broker.prospects} prospects · {broker.activities} activities</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* News Feed */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Market News</h2>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredNews.map((news, i) => (
                <motion.div key={news.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card className="border-border bg-card p-4 transition-colors hover:bg-secondary/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge variant="outline" className={getCategoryColor(news.category)}>{news.category}</Badge>
                          <span className="text-xs text-muted-foreground">{news.date}</span>
                        </div>
                        <h3 className="mb-1 text-sm font-semibold text-foreground">{news.title}</h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">{news.summary}</p>
                        <p className="mt-2 text-xs text-muted-foreground/60">{news.source}</p>
                      </div>
                      <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40" />
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Hot Prospects Sidebar */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Hot Prospects</h2>
            <div className="space-y-3">
              {buildings.flatMap(b =>
                b.tenants.filter(t =>
                  t.outreachReasons.some(r => r.urgency === 'high')
                ).map(t => ({ tenant: t, building: b }))
              ).slice(0, 6).map(({ tenant, building }, i) => (
                <motion.div key={tenant.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link to={`/building/${building.id}/tenant/${tenant.id}`}>
                    <Card className="border-border bg-card p-3 transition-all hover:border-primary/30 hover:shadow-[var(--shadow-glow)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground">{building.name}</p>
                        </div>
                        <Badge variant="outline" className="bg-destructive/20 text-destructive text-[10px]">HIGH</Badge>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Lease expires {tenant.leaseExpiration} · {tenant.sqft.toLocaleString()} SF
                      </p>
                      <p className="mt-1 text-[11px] text-primary">
                        {tenant.outreachReasons.filter(r => r.urgency === 'high').length} urgent reasons to reach out →
                      </p>
                    </Card>
                  </Link>
                </motion.div>
              ))}

              <Link to="/map">
                <Button variant="outline" className="mt-2 w-full text-xs">View All on Map →</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

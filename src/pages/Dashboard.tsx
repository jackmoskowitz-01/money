import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Building2, Clock, ExternalLink, Filter, Target, Zap, CheckCircle2, BarChart3, ChevronDown, X, Users, Mail, Loader2, Copy, Check, Send, Plus, Search, RefreshCw } from 'lucide-react';
import { newsItems as staticNewsItems, buildings, getCategoryColor, type NewsItem, type Tenant, type Building } from '@/data/mockData';
import { toast } from 'sonner';
import { getPipeline, stageLabels, type PipelineStage } from '@/data/pipelineData';
import { getActivities, getTasks, getAssignments, brokers } from '@/data/activityData';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import SubmarketTrends from '@/components/SubmarketTrends';
import EmailDisplay from '@/components/EmailDisplay';
import BrokerLeaderboard from '@/components/BrokerLeaderboard';
import MeetingsOverview from '@/components/MeetingsOverview';

const categories = ['all', 'lease', 'sale', 'expansion', 'vacancy', 'market', 'contraction'] as const;

const OUTREACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-outreach`;


type ProspectMatch = { tenant: Tenant; building: Building };

const getAffectedProspects = (news: NewsItem): ProspectMatch[] => {
  const matches: ProspectMatch[] = [];
  const seen = new Set<string>();

  buildings.forEach(building => {
    building.tenants.forEach(tenant => {
      if (tenant.isClient) return;
      if (seen.has(tenant.id)) return;

      // Direct relation
      const directTenant = news.relatedTenants?.includes(tenant.id);
      const directBuilding = news.relatedBuildings?.includes(building.id);
      // Category-based: vacancy news affects tenants in high-vacancy buildings
      const categoryMatch =
        (news.category === 'vacancy' && building.vacancyRate > 15) ||
        (news.category === 'market' && tenant.industry.toLowerCase().includes('legal') && news.title.toLowerCase().includes('law')) ||
        (news.category === 'market' && tenant.industry.toLowerCase().includes('lobby') && news.title.toLowerCase().includes('lobby')) ||
        (news.category === 'contraction' && tenant.industry.toLowerCase().includes('consult') && news.title.toLowerCase().includes('consult')) ||
        (news.category === 'contraction' && (tenant.industry.toLowerCase().includes('nonprofit') || tenant.industry.toLowerCase().includes('association') || tenant.industry.toLowerCase().includes('think tank')) && (news.title.toLowerCase().includes('nonprofit') || news.title.toLowerCase().includes('non-profit'))) ||
        (news.category === 'market' && (tenant.industry.toLowerCase().includes('nonprofit') || tenant.industry.toLowerCase().includes('association')) && (news.title.toLowerCase().includes('nonprofit') || news.title.toLowerCase().includes('funding') || news.title.toLowerCase().includes('501')));

      if (directTenant || directBuilding || categoryMatch) {
        seen.add(tenant.id);
        matches.push({ tenant, building });
      }
    });
  });

  return matches;
};

const Dashboard = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedStat, setExpandedStat] = useState<string | null>(null);
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(null);
  const [selectedProspects, setSelectedProspects] = useState<Record<string, Set<string>>>({});
  const [generatingKeys, setGeneratingKeys] = useState<Set<string>>(new Set());
  const [generatedEmails, setGeneratedEmails] = useState<Record<string, string>>({});
  const [activeEmailKey, setActiveEmailKey] = useState<string | null>(null);
  const [manualProspects, setManualProspects] = useState<Record<string, ProspectMatch[]>>({});
  const [customProspects, setCustomProspects] = useState<Record<string, { id: string; name: string }[]>>({});
  const [prospectSearch, setProspectSearch] = useState<Record<string, string>>({});
  const [showSearchFor, setShowSearchFor] = useState<string | null>(null);

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
      { label: 'Active Prospects', value: String(active), icon: Target, trend: `${pipeline.filter(p => p.stage === 'meeting_held').length} meetings held`, link: '/prospects' },
      { label: 'Deals Won', value: String(won), icon: CheckCircle2, trend: `${pipeline.filter(p => p.stage === 'moving_forward').length} moving forward` },
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

  // All non-client tenants for manual adding
  const allNonClientProspects = useMemo(() => {
    const results: ProspectMatch[] = [];
    buildings.forEach(building => {
      building.tenants.forEach(tenant => {
        if (!tenant.isClient) results.push({ tenant, building });
      });
    });
    return results;
  }, []);

  const getSearchResults = (newsId: string, autoProspects: ProspectMatch[]) => {
    const query = (prospectSearch[newsId] || '').toLowerCase().trim();
    if (!query) return [];
    const manual = manualProspects[newsId] || [];
    const existingIds = new Set([
      ...autoProspects.map(p => p.tenant.id),
      ...manual.map(p => p.tenant.id),
    ]);
    return allNonClientProspects.filter(p =>
      !existingIds.has(p.tenant.id) &&
      (p.tenant.name.toLowerCase().includes(query) ||
       p.building.name.toLowerCase().includes(query) ||
       p.tenant.industry.toLowerCase().includes(query))
    ).slice(0, 5);
  };

  const addManualProspect = (newsId: string, prospect: ProspectMatch) => {
    setManualProspects(prev => ({
      ...prev,
      [newsId]: [...(prev[newsId] || []), prospect],
    }));
    setProspectSearch(prev => ({ ...prev, [newsId]: '' }));
    setShowSearchFor(null);
  };

  const addCustomProspect = (newsId: string, name: string) => {
    const id = `custom-${Date.now()}`;
    setCustomProspects(prev => ({
      ...prev,
      [newsId]: [...(prev[newsId] || []), { id, name: name.trim() }],
    }));
    setProspectSearch(prev => ({ ...prev, [newsId]: '' }));
    setShowSearchFor(null);
  };

  const removeCustomProspect = (newsId: string, customId: string) => {
    setCustomProspects(prev => ({
      ...prev,
      [newsId]: (prev[newsId] || []).filter(c => c.id !== customId),
    }));
    setSelectedProspects(prev => {
      const current = new Set(prev[newsId] || []);
      current.delete(customId);
      return { ...prev, [newsId]: current };
    });
  };

  const removeManualProspect = (newsId: string, tenantId: string) => {
    setManualProspects(prev => ({
      ...prev,
      [newsId]: (prev[newsId] || []).filter(p => p.tenant.id !== tenantId),
    }));
    setSelectedProspects(prev => {
      const current = new Set(prev[newsId] || []);
      current.delete(tenantId);
      return { ...prev, [newsId]: current };
    });
  };

  const toggleProspect = (newsId: string, tenantId: string) => {
    setSelectedProspects(prev => {
      const current = new Set(prev[newsId] || []);
      if (current.has(tenantId)) current.delete(tenantId);
      else current.add(tenantId);
      return { ...prev, [newsId]: current };
    });
  };

  const selectAll = (newsId: string, prospects: ProspectMatch[], customs: { id: string; name: string }[]) => {
    setSelectedProspects(prev => ({
      ...prev,
      [newsId]: new Set([...prospects.map(p => p.tenant.id), ...customs.map(c => c.id)]),
    }));
  };

  const deselectAll = (newsId: string) => {
    setSelectedProspects(prev => ({ ...prev, [newsId]: new Set() }));
  };

  const generateEmailForProspect = useCallback(async (
    tenant: Tenant,
    building: Building,
    news: NewsItem,
    key: string,
  ) => {
    if (generatedEmails[key]) return;
    setGeneratingKeys(prev => new Set(prev).add(key));
    setGeneratedEmails(prev => ({ ...prev, [key]: '' }));

    try {
      const clientsInBuilding = building.tenants
        .filter(t => t.isClient && t.id !== tenant.id)
        .map(t => t.name);

      const resp = await fetch(OUTREACH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          tenantName: tenant.name,
          buildingName: building.name,
          contactName: tenant.contactName,
          contactTitle: tenant.contactTitle,
          industry: tenant.industry,
          sqft: tenant.sqft,
          leaseExpiration: tenant.leaseExpiration,
          outreachReason: `Market news: ${news.title} — ${news.summary}`,
          vacancyRate: building.vacancyRate,
          headcount: tenant.headcount,
          clientsInBuilding,
        }),
      });

      if (!resp.ok) {
        setGeneratingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
        setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              full += content;
              setGeneratedEmails(prev => ({ ...prev, [key]: full }));
            }
          } catch { /* partial */ }
        }
      }
    } catch {
      setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
    setGeneratingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
  }, [generatedEmails]);

  const generateEmailForCustom = useCallback(async (
    customName: string,
    news: NewsItem,
    key: string,
  ) => {
    if (generatedEmails[key]) return;
    setGeneratingKeys(prev => new Set(prev).add(key));
    setGeneratedEmails(prev => ({ ...prev, [key]: '' }));

    try {
      const resp = await fetch(OUTREACH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          tenantName: customName,
          buildingName: 'Unknown',
          contactName: '',
          contactTitle: '',
          industry: '',
          sqft: 0,
          leaseExpiration: '',
          outreachReason: `Market news: ${news.title} — ${news.summary}`,
          vacancyRate: 0,
          headcount: 0,
          clientsInBuilding: [],
          isCustomProspect: true,
        }),
      });

      if (!resp.ok) {
        setGeneratingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
        setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              full += content;
              setGeneratedEmails(prev => ({ ...prev, [key]: full }));
            }
          } catch { /* partial */ }
        }
      }
    } catch {
      setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
    setGeneratingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
  }, [generatedEmails]);

  const sendToSelected = useCallback(async (newsId: string, news: NewsItem, prospects: ProspectMatch[], customs: { id: string; name: string }[]) => {
    const selected = selectedProspects[newsId];
    if (!selected || selected.size === 0) return;

    const toSend = prospects.filter(p => selected.has(p.tenant.id));
    for (const { tenant, building } of toSend) {
      const key = `news-${newsId}-${tenant.id}`;
      generateEmailForProspect(tenant, building, news, key);
    }
    const customToSend = customs.filter(c => selected.has(c.id));
    for (const custom of customToSend) {
      const key = `news-${newsId}-${custom.id}`;
      generateEmailForCustom(custom.name, news, key);
    }
  }, [selectedProspects, generateEmailForProspect, generateEmailForCustom]);

  const updateEmail = useCallback((key: string, content: string) => {
    setGeneratedEmails(prev => ({ ...prev, [key]: content }));
  }, []);

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

        {/* Broker Charts */}
        <div className="mb-8">
          <BrokerLeaderboard />
        </div>

        {/* Pipeline Breakdown + Submarket Trends */}
        <div className="mb-8 grid gap-4 lg:grid-cols-2">
          {/* Pipeline Funnel */}
          <Card className="border-border bg-card p-4">
            <h3 className="mb-3 font-display text-sm font-bold">Pipeline Breakdown</h3>
            <div className="space-y-2">
              {(['meeting_set', 'meeting_held', 'moving_forward', 'won', 'closed', 'lost'] as PipelineStage[]).map(stage => {
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

        {/* Meetings Overview */}
        <div className="mb-8">
          <MeetingsOverview />
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
              {filteredNews.map((news, i) => {
                const autoProspects = getAffectedProspects(news);
                const manual = manualProspects[news.id] || [];
                const customs = customProspects[news.id] || [];
                const allProspects = [...autoProspects, ...manual];
                const totalCount = allProspects.length + customs.length;
                const isExpanded = expandedNewsId === news.id;
                const selected = selectedProspects[news.id] || new Set();
                const allSelected = totalCount > 0 && selected.size === totalCount;
                const searchResults = getSearchResults(news.id, autoProspects);

                return (
                  <motion.div key={news.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <Card className="border-border bg-card transition-colors hover:bg-secondary/10">
                      <div className="p-4">
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

                        <button
                          onClick={() => setExpandedNewsId(isExpanded ? null : news.id)}
                          className="mt-3 flex w-full items-center gap-2 rounded-md bg-primary/5 px-3 py-2 text-left transition-colors hover:bg-primary/10"
                        >
                          <Users className="h-3.5 w-3.5 text-primary" />
                          <span className="flex-1 text-xs font-medium text-primary">
                            {totalCount > 0
                              ? `${totalCount} prospect${totalCount !== 1 ? 's' : ''} ${(manual.length + customs.length) > 0 ? `(${manual.length + customs.length} added manually)` : 'affected'}`
                              : 'Add prospects for outreach'
                            }
                          </span>
                          <ChevronDown className={`h-3.5 w-3.5 text-primary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-border px-4 py-3 space-y-2">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Select prospects to outreach</p>
                                <div className="flex items-center gap-2">
                                  {allProspects.length > 0 && (
                                    <button
                                      onClick={() => allSelected ? deselectAll(news.id) : selectAll(news.id, allProspects, customs)}
                                      className="text-[10px] text-primary hover:underline"
                                    >
                                      {allSelected ? 'Deselect All' : 'Select All'}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {allProspects.map(({ tenant, building: bldg }, idx) => {
                                const emailKey = `news-${news.id}-${tenant.id}`;
                                const isChecked = selected.has(tenant.id);
                                const isGenerating = generatingKeys.has(emailKey);
                                const hasEmail = generatedEmails[emailKey] !== undefined;
                                const hasClient = bldg.tenants.some(t => t.isClient && t.id !== tenant.id);
                                const isManual = idx >= autoProspects.length;

                                return (
                                  <div key={tenant.id} className="space-y-1">
                                    <div className="flex items-center gap-3 rounded-md bg-secondary/30 p-2.5">
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() => toggleProspect(news.id, tenant.id)}
                                        className="h-4 w-4"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <Link
                                            to={`/building/${bldg.id}/tenant/${tenant.id}`}
                                            className="text-xs font-semibold text-foreground hover:text-primary truncate"
                                          >
                                            {tenant.name}
                                          </Link>
                                          {hasClient && (
                                            <Badge variant="outline" className="text-[8px] px-1 py-0 bg-success/10 text-success border-success/30 shrink-0">
                                              ✓ Client in bldg
                                            </Badge>
                                          )}
                                          {isManual && (
                                            <Badge variant="outline" className="text-[8px] px-1 py-0 bg-accent text-accent-foreground shrink-0">
                                              Added
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground truncate">
                                          {bldg.name} · {tenant.industry} · {tenant.sqft.toLocaleString()} SF
                                        </p>
                                      </div>
                                      {isManual && !hasEmail && !isGenerating && (
                                        <button
                                          onClick={() => removeManualProspect(news.id, tenant.id)}
                                          className="shrink-0 rounded p-1 hover:bg-destructive/10"
                                        >
                                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                        </button>
                                      )}
                                      {!hasEmail && !isGenerating && (
                                        <button
                                          onClick={() => generateEmailForProspect(tenant, bldg, news, emailKey)}
                                          className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 flex items-center gap-1"
                                        >
                                          <Mail className="h-3 w-3" /> Generate
                                        </button>
                                      )}
                                      {isGenerating && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
                                      {hasEmail && !isGenerating && (
                                        <button
                                          onClick={() => setActiveEmailKey(activeEmailKey === emailKey ? null : emailKey)}
                                          className="shrink-0 rounded-md bg-success/10 px-2 py-1 text-[10px] font-medium text-success hover:bg-success/20 flex items-center gap-1"
                                        >
                                          <Check className="h-3 w-3" /> View
                                        </button>
                                      )}
                                    </div>

                                    <AnimatePresence>
                                      {activeEmailKey === emailKey && hasEmail && (
                                        <EmailDisplay
                                          emailKey={emailKey}
                                          emailContent={generatedEmails[emailKey]}
                                          isGenerating={isGenerating}
                                          label={`Email to ${tenant.contactName}`}
                                          onClose={() => setActiveEmailKey(null)}
                                          onUpdateEmail={updateEmail}
                                        />
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })}

                              {/* Custom (typed-in) prospects */}
                              {customs.map(custom => {
                                const emailKey = `news-${news.id}-${custom.id}`;
                                const isChecked = selected.has(custom.id);
                                const isGenerating = generatingKeys.has(emailKey);
                                const hasEmail = generatedEmails[emailKey] !== undefined;

                                return (
                                  <div key={custom.id} className="space-y-1">
                                    <div className="flex items-center gap-3 rounded-md bg-secondary/30 p-2.5">
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() => toggleProspect(news.id, custom.id)}
                                        className="h-4 w-4"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold text-foreground truncate">
                                            {custom.name}
                                          </span>
                                          <Badge variant="outline" className="text-[8px] px-1 py-0 bg-accent text-accent-foreground shrink-0">
                                            Custom
                                          </Badge>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">Not in database — AI will research and tailor</p>
                                      </div>
                                      {!hasEmail && !isGenerating && (
                                        <button
                                          onClick={() => removeCustomProspect(news.id, custom.id)}
                                          className="shrink-0 rounded p-1 hover:bg-destructive/10"
                                        >
                                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                        </button>
                                      )}
                                      {!hasEmail && !isGenerating && (
                                        <button
                                          onClick={() => generateEmailForCustom(custom.name, news, emailKey)}
                                          className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 flex items-center gap-1"
                                        >
                                          <Mail className="h-3 w-3" /> Generate
                                        </button>
                                      )}
                                      {isGenerating && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
                                      {hasEmail && !isGenerating && (
                                        <button
                                          onClick={() => setActiveEmailKey(activeEmailKey === emailKey ? null : emailKey)}
                                          className="shrink-0 rounded-md bg-success/10 px-2 py-1 text-[10px] font-medium text-success hover:bg-success/20 flex items-center gap-1"
                                        >
                                          <Check className="h-3 w-3" /> View
                                        </button>
                                      )}
                                    </div>

                                    <AnimatePresence>
                                      {activeEmailKey === emailKey && hasEmail && (
                                        <EmailDisplay
                                          emailKey={emailKey}
                                          emailContent={generatedEmails[emailKey]}
                                          isGenerating={isGenerating}
                                          label={`Email to ${custom.name}`}
                                          onClose={() => setActiveEmailKey(null)}
                                          onUpdateEmail={updateEmail}
                                        />
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })}

                              {/* Add Prospect Search */}
                              <div className="pt-2 border-t border-border/50">
                                {showSearchFor === news.id ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <div className="relative flex-1">
                                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                        <input
                                          type="text"
                                          placeholder="Search or type a name to add..."
                                          value={prospectSearch[news.id] || ''}
                                          onChange={e => setProspectSearch(prev => ({ ...prev, [news.id]: e.target.value }))}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter' && (prospectSearch[news.id] || '').trim()) {
                                              if (searchResults.length > 0) {
                                                addManualProspect(news.id, searchResults[0]);
                                              } else {
                                                addCustomProspect(news.id, prospectSearch[news.id]);
                                              }
                                            }
                                          }}
                                          className="w-full rounded-md border border-input bg-background pl-7 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                          autoFocus
                                        />
                                      </div>
                                      <button
                                        onClick={() => { setShowSearchFor(null); setProspectSearch(prev => ({ ...prev, [news.id]: '' })); }}
                                        className="shrink-0 rounded p-1 hover:bg-secondary"
                                      >
                                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                                      </button>
                                    </div>
                                    {searchResults.length > 0 && (
                                      <div className="space-y-1">
                                        {searchResults.map(prospect => (
                                          <button
                                            key={prospect.tenant.id}
                                            onClick={() => addManualProspect(news.id, prospect)}
                                            className="flex w-full items-center gap-3 rounded-md bg-secondary/20 p-2 text-left hover:bg-secondary/40 transition-colors"
                                          >
                                            <Plus className="h-3 w-3 text-primary shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-medium text-foreground truncate">{prospect.tenant.name}</p>
                                              <p className="text-[10px] text-muted-foreground truncate">
                                                {prospect.building.name} · {prospect.tenant.industry} · {prospect.tenant.sqft.toLocaleString()} SF
                                              </p>
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                    {(prospectSearch[news.id] || '').trim() && searchResults.length === 0 && (
                                      <button
                                        onClick={() => addCustomProspect(news.id, prospectSearch[news.id])}
                                        className="flex w-full items-center gap-3 rounded-md bg-primary/5 p-2.5 text-left hover:bg-primary/10 transition-colors"
                                      >
                                        <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium text-primary">Add "{(prospectSearch[news.id] || '').trim()}" as custom prospect</p>
                                          <p className="text-[10px] text-muted-foreground">AI will tailor outreach based on the news and what it knows about them</p>
                                        </div>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setShowSearchFor(news.id)}
                                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-[10px] font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                                  >
                                    <Plus className="h-3 w-3" /> Add prospect manually
                                  </button>
                                )}
                              </div>

                              {selected.size > 0 && (
                                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                                  <Button
                                    size="sm"
                                    className="text-xs h-8 flex-1"
                                    onClick={() => sendToSelected(news.id, news, allProspects, customs)}
                                    disabled={generatingKeys.size > 0}
                                  >
                                    {generatingKeys.size > 0 ? (
                                      <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Generating...</>
                                    ) : (
                                      <><Send className="mr-1 h-3 w-3" /> Generate for {selected.size} selected</>
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  </motion.div>
                );
              })}
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

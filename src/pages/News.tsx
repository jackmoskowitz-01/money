import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Building2, ExternalLink, Users, Mail, Loader2, Copy, Check, Send, Plus, Search, RefreshCw, FileText, Sparkles, ChevronDown, X, Filter } from 'lucide-react';
import { newsItems as staticNewsItems, buildings, getCategoryColor, type NewsItem, type Tenant, type Building } from '@/data/mockData';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import EmailDisplay from '@/components/EmailDisplay';
import { getContacts } from '@/data/companyContacts';
import { type EmailRecipient } from '@/components/RecipientPicker';

const categories = ['all', 'lease', 'sale', 'expansion', 'vacancy', 'market', 'contraction'] as const;

const allIndustries = (() => {
  const set = new Set<string>();
  buildings.forEach(b => b.tenants.forEach(t => { if (t.industry) set.add(t.industry); }));
  return Array.from(set).sort();
})();

const OUTREACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-outreach`;
const NEWS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-market-news`;

type ProspectMatch = { tenant: Tenant; building: Building };

const getAffectedProspects = (news: NewsItem): ProspectMatch[] => {
  const matches: ProspectMatch[] = [];
  const seen = new Set<string>();

  buildings.forEach(building => {
    building.tenants.forEach(tenant => {
      if (tenant.isClient) return;
      if (seen.has(tenant.id)) return;

      const directTenant = news.relatedTenants?.includes(tenant.id);
      const directBuilding = news.relatedBuildings?.includes(building.id);
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

const buildRecipients = (tenant: Tenant): EmailRecipient[] => {
  const list: EmailRecipient[] = [{
    id: 'primary',
    name: tenant.contactName,
    email: tenant.contactEmail,
    title: tenant.contactTitle,
    isPrimary: true,
  }];
  getContacts(tenant.id).forEach(c => {
    list.push({ id: c.id, name: c.name, email: c.email, title: c.title });
  });
  return list;
};

const News = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeIndustry, setActiveIndustry] = useState<string>('all');
  const [showIndustryFilter, setShowIndustryFilter] = useState(false);
  const [expandedNewsId, setExpandedNewsId] = useState<string | null>(null);
  const [selectedProspects, setSelectedProspects] = useState<Record<string, Set<string>>>({});
  const [generatingKeys, setGeneratingKeys] = useState<Set<string>>(new Set());
  const [generatedEmails, setGeneratedEmails] = useState<Record<string, string>>({});
  const [activeEmailKey, setActiveEmailKey] = useState<string | null>(null);
  const [manualProspects, setManualProspects] = useState<Record<string, ProspectMatch[]>>({});
  const [customProspects, setCustomProspects] = useState<Record<string, { id: string; name: string }[]>>({});
  const [prospectSearch, setProspectSearch] = useState<Record<string, string>>({});
  const [showSearchFor, setShowSearchFor] = useState<string | null>(null);
  const [customIntelInput, setCustomIntelInput] = useState('');
  const [customIntelItems, setCustomIntelItems] = useState<NewsItem[]>([]);
  const [showCustomIntel, setShowCustomIntel] = useState(false);
  const [liveNews, setLiveNews] = useState<NewsItem[] | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchLiveNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const resp = await fetch(NEWS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch news');
      }
      const data = await resp.json();
      if (data.news && Array.isArray(data.news)) {
        setLiveNews(data.news);
        setLastRefreshed(new Date());
        toast.success('Market news updated');
      }
    } catch (e) {
      console.error('Failed to fetch live news:', e);
      toast.error('Failed to fetch live news — showing cached data');
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveNews();
  }, [fetchLiveNews]);

  const currentNews: NewsItem[] = [...customIntelItems, ...(liveNews || staticNewsItems)];

  const addCustomIntel = useCallback(() => {
    const text = customIntelInput.trim();
    if (!text) return;
    const id = `custom-intel-${Date.now()}`;
    const newItem: NewsItem = {
      id,
      title: text.length > 80 ? text.slice(0, 77) + '...' : text,
      summary: text,
      source: 'Custom Intel',
      date: new Date().toISOString().split('T')[0],
      category: 'market',
    };
    setCustomIntelItems(prev => [newItem, ...prev]);
    setCustomIntelInput('');
    setShowCustomIntel(false);
    setExpandedNewsId(id);
    toast.success('Custom intel added — add prospects to generate outreach');
  }, [customIntelInput]);

  const filteredNews = useMemo(() => {
    let result = currentNews;
    if (activeCategory !== 'all') {
      result = result.filter(n => n.category === activeCategory);
    }
    if (activeIndustry !== 'all') {
      result = result.filter(news => {
        // Check if any affected prospect matches the industry
        const prospects = getAffectedProspects(news);
        return prospects.some(p => p.tenant.industry === activeIndustry) ||
          // Also check related tenants directly
          news.relatedTenants?.some(tid => {
            return buildings.some(b => b.tenants.some(t => t.id === tid && t.industry === activeIndustry));
          }) ||
          // Check if news text mentions the industry
          news.title.toLowerCase().includes(activeIndustry.toLowerCase()) ||
          news.summary.toLowerCase().includes(activeIndustry.toLowerCase());
      });
    }
    return result;
  }, [currentNews, activeCategory, activeIndustry]);

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
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">News</h1>
          <p className="mt-1 text-muted-foreground">Market intelligence and outreach triggers</p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* News Feed */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Market News</h2>
                {liveNews && (
                  <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px]">
                    Live
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {lastRefreshed && (
                  <span className="text-[10px] text-muted-foreground">
                    Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={fetchLiveNews}
                  disabled={newsLoading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${newsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Custom Intel Input */}
            <AnimatePresence>
              {showCustomIntel ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-4"
                >
                  <Card className="border-primary/20 bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold text-foreground">Custom Intel</p>
                      <button onClick={() => setShowCustomIntel(false)} className="ml-auto rounded p-1 hover:bg-secondary">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-2">
                      Paste a news article, market data, or type your own intel. This becomes an outreach trigger you can generate emails from.
                    </p>
                    <textarea
                      value={customIntelInput}
                      onChange={e => setCustomIntelInput(e.target.value)}
                      placeholder={"Paste an article, URL, or type market intelligence here...\n\nExample: 'The American Bar Association is reportedly exploring a move from their current 50,000 SF space at 1050 Connecticut Ave as their lease expires in Q2 2026...'"}
                      className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                      autoFocus
                    />
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-[10px] text-muted-foreground">
                        {customIntelInput.trim().length > 0 ? `${customIntelInput.trim().length} chars` : 'Start typing or paste content'}
                      </p>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={addCustomIntel}
                        disabled={!customIntelInput.trim()}
                      >
                        <Sparkles className="mr-1 h-3 w-3" /> Create Outreach Trigger
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
                  <button
                    onClick={() => setShowCustomIntel(true)}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-foreground">Drop in your own intel</p>
                      <p className="text-[10px] text-muted-foreground">Paste a news article or type custom market intelligence to generate outreach</p>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mb-4 flex flex-wrap items-center gap-2">
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

              <div className="ml-auto relative">
                <button
                  onClick={() => setShowIndustryFilter(!showIndustryFilter)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    activeIndustry !== 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  <Filter className="h-3 w-3" />
                  {activeIndustry === 'all' ? 'Industry' : activeIndustry}
                  <ChevronDown className={`h-3 w-3 transition-transform ${showIndustryFilter ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showIndustryFilter && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-card shadow-lg overflow-hidden"
                    >
                      <div className="max-h-64 overflow-y-auto p-1">
                        <button
                          onClick={() => { setActiveIndustry('all'); setShowIndustryFilter(false); }}
                          className={`w-full text-left rounded-md px-3 py-1.5 text-xs transition-colors ${
                            activeIndustry === 'all' ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-secondary'
                          }`}
                        >
                          All Industries
                        </button>
                        {allIndustries.map(ind => (
                          <button
                            key={ind}
                            onClick={() => { setActiveIndustry(ind); setShowIndustryFilter(false); }}
                            className={`w-full text-left rounded-md px-3 py-1.5 text-xs transition-colors ${
                              activeIndustry === ind ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-secondary'
                            }`}
                          >
                            {ind}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {newsLoading && !liveNews && (
              <div className="space-y-3 mb-3">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="border-border bg-card p-4 animate-pulse">
                    <div className="h-4 w-20 bg-secondary rounded mb-2" />
                    <div className="h-5 w-3/4 bg-secondary rounded mb-2" />
                    <div className="h-3 w-full bg-secondary rounded mb-1" />
                    <div className="h-3 w-2/3 bg-secondary rounded" />
                  </Card>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {filteredNews.map((news, i) => {
                const isCustomIntel = news.id.startsWith('custom-intel-');
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
                    <Card className={`border-border bg-card transition-colors hover:bg-secondary/10 ${isCustomIntel ? 'border-primary/20' : ''}`}>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="mb-2 flex items-center gap-2">
                              <Badge variant="outline" className={getCategoryColor(news.category)}>{news.category}</Badge>
                              {isCustomIntel && (
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[8px]">
                                  Your Intel
                                </Badge>
                              )}
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
                                          contactName={tenant.contactName}
                                          contactEmail={tenant.contactEmail}
                                          subject={`${news.title} — ${tenant.name}`}
                                          recipients={buildRecipients(tenant)}
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
                                          subject={`${news.title} — ${custom.name}`}
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

export default News;

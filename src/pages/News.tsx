import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Building2, ExternalLink, Users, Mail, Loader2, Copy, Check, Send, Plus, Search,
  RefreshCw, FileText, Sparkles, ChevronDown, X, Filter, Clock, Bookmark, BookmarkCheck,
  Zap, AlertTriangle, BarChart3, ListPlus, Newspaper, Eye, Rss
} from 'lucide-react';
import { buildings, getCategoryColor, type NewsItem, type Tenant, type Building } from '@/data/mockData';
import { toast } from 'sonner';
import { getUserGreeting } from '@/lib/getUserGreeting';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getProspectLists } from '@/data/prospectLists';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import EmailDisplay from '@/components/EmailDisplay';
import { getContacts } from '@/data/companyContacts';
import { type EmailRecipient } from '@/components/RecipientPicker';

const categories = ['all', 'lease', 'sale', 'expansion', 'vacancy', 'market', 'contraction'] as const;

const categoryIcons: Record<string, typeof TrendingUp> = {
  lease: Clock,
  sale: Building2,
  expansion: TrendingUp,
  vacancy: BarChart3,
  market: Zap,
  contraction: AlertTriangle,
};

const allIndustries = (() => {
  const set = new Set<string>();
  buildings.forEach(b => b.tenants.forEach(t => { if (t.industry) set.add(t.industry); }));
  return Array.from(set).sort();
})();

const OUTREACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-outreach`;
const NEWS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-market-news`;
const COMPANY_NEWS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-company-news`;

type CompanyNewsItem = NewsItem & {
  matchedCompanyId?: string;
  matchedCompanyName?: string;
  matchedBuildingId?: string;
  relevanceScore?: number;
  url?: string;
  signals?: string[];
  outreach_reason?: string;
  urgency?: 'hot' | 'warm' | 'watch';
};

// LocalStorage-backed cache so news survives reloads
const LS_LIVE_NEWS = 'dealflow_live_news';
const LS_COMPANY_NEWS = 'dealflow_company_news';
const LS_LAST_REFRESHED = 'dealflow_news_last_refreshed';
const LS_NEWS_HISTORY = 'dealflow_news_history';
const LS_BOOKMARKS = 'dealflow_news_bookmarks';
const LS_READ_IDS = 'dealflow_news_read';
const LS_INDUSTRY_NEWS = 'dealflow_industry_news';

const loadFromLS = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
};

const saveToLS = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

let cachedLiveNews: NewsItem[] | null = loadFromLS<NewsItem[] | null>(LS_LIVE_NEWS, null);
let cachedCompanyNews: CompanyNewsItem[] = loadFromLS<CompanyNewsItem[]>(LS_COMPANY_NEWS, []);
let cachedLastRefreshed: Date | null = (() => {
  const v = localStorage.getItem(LS_LAST_REFRESHED);
  return v ? new Date(JSON.parse(v)) : null;
})();
let newsHistory: Map<string, NewsItem> = new Map(
  loadFromLS<[string, NewsItem][]>(LS_NEWS_HISTORY, [])
);

const persistHistory = () => {
  saveToLS(LS_NEWS_HISTORY, Array.from(newsHistory.entries()));
};

const mergeIntoHistory = (items: NewsItem[]) => {
  items.forEach(item => {
    if (!newsHistory.has(item.id)) {
      newsHistory.set(item.id, item);
    }
  });
  persistHistory();
};

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

      const ind = tenant.industry.toLowerCase();
      const title = news.title.toLowerCase();
      const summary = news.summary.toLowerCase();

      const categoryMatch =
        (news.category === 'vacancy' && building.vacancyRate > 15) ||
        (news.category === 'lease' && new Date(tenant.leaseExpiration) < new Date('2026-09-30')) ||
        (ind.includes('legal') && (title.includes('law') || title.includes('legal') || title.includes('firm'))) ||
        ((ind.includes('lobby') || ind.includes('government')) && (title.includes('lobby') || title.includes('k street') || title.includes('hybrid'))) ||
        (ind.includes('consult') && (title.includes('consult') || title.includes('hybrid') || title.includes('cut'))) ||
        ((ind.includes('nonprofit') || ind.includes('association') || ind.includes('healthcare')) && (title.includes('nonprofit') || title.includes('non-profit') || title.includes('funding') || title.includes('501') || title.includes('downsize'))) ||
        (news.category === 'contraction' && building.vacancyRate > 18) ||
        (news.category === 'sale' && news.relatedBuildings?.includes(building.id)) ||
        (news.category === 'expansion' && (ind.includes('defense') || ind.includes('technology')) && (title.includes('expand') || title.includes('growth') || title.includes('government'))) ||
        (summary.includes('sublease') && (ind.includes('nonprofit') || ind.includes('association') || ind.includes('government')));

      if (directTenant || directBuilding || categoryMatch) {
        seen.add(tenant.id);
        matches.push({ tenant, building });
      }
    });
  });

  return matches;
};

const buildRecipients = async (tenant: Tenant): Promise<EmailRecipient[]> => {
  const list: EmailRecipient[] = [{
    id: 'primary',
    name: tenant.contactName,
    email: tenant.contactEmail,
    title: tenant.contactTitle,
    isPrimary: true,
  }];
  const contacts = await getContactsAsync(tenant.id);
  contacts.forEach(c => {
    list.push({ id: c.id, name: c.name, email: c.email, title: c.title });
  });
  return list;
};

const getTimeSince = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return dateStr;
};

const getCategorySemanticColor = (category: string) => {
  switch (category) {
    case 'lease': return 'bg-info';
    case 'sale': return 'bg-success';
    case 'expansion': return 'bg-success';
    case 'vacancy': return 'bg-warning';
    case 'market': return 'bg-primary';
    case 'contraction': return 'bg-destructive';
    default: return 'bg-muted-foreground';
  }
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
  const [liveNews, setLiveNews] = useState<NewsItem[] | null>(cachedLiveNews);
  const [companyNews, setCompanyNews] = useState<CompanyNewsItem[]>(cachedCompanyNews);
  const [industryNews, setIndustryNews] = useState<Record<string, NewsItem[]>>(() => loadFromLS<Record<string, NewsItem[]>>(LS_INDUSTRY_NEWS, {}));
  const [newsLoading, setNewsLoading] = useState(false);
  const [companyNewsLoading, setCompanyNewsLoading] = useState(false);
  const [industryNewsLoading, setIndustryNewsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(cachedLastRefreshed);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => new Set(loadFromLS<string[]>(LS_BOOKMARKS, [])));
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set(loadFromLS<string[]>(LS_READ_IDS, [])));
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const dismissNews = (id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
    if (expandedNewsId === id) setExpandedNewsId(null);
    toast('News item dismissed', {
      action: {
        label: 'Undo',
        onClick: () => setDismissedIds(prev => { const n = new Set(prev); n.delete(id); return n; }),
      },
    });
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); toast.info('Removed bookmark'); }
      else { n.add(id); toast.success('Bookmarked'); }
      saveToLS(LS_BOOKMARKS, Array.from(n));
      return n;
    });
  };

  const markAsRead = useCallback((id: string) => {
    setReadIds(prev => {
      if (prev.has(id)) return prev;
      const n = new Set(prev).add(id);
      saveToLS(LS_READ_IDS, Array.from(n));
      return n;
    });
  }, []);

  const fetchCompanyNews = useCallback(async () => {
    setCompanyNewsLoading(true);
    try {
      const companies = buildings.flatMap(b =>
        b.tenants.filter(t => !t.isClient).map(t => ({
          id: t.id,
          name: t.name,
          buildingId: b.id,
        }))
      );

      const resp = await fetch(COMPANY_NEWS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ companies }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to scan company news');
      }
      const data = await resp.json();
      if (data.companyNews && Array.isArray(data.companyNews)) {
        const mapped: CompanyNewsItem[] = data.companyNews.map((cn: CompanyNewsItem) => ({
          ...cn,
          relatedTenants: cn.matchedCompanyId ? [cn.matchedCompanyId] : undefined,
          relatedBuildings: cn.matchedBuildingId ? [cn.matchedBuildingId] : undefined,
        }));
        mergeIntoHistory(mapped);
        const allCompany = Array.from(newsHistory.values()).filter(n => n.id.startsWith('cn')) as CompanyNewsItem[];
        setCompanyNews(allCompany);
        cachedCompanyNews = allCompany;
        saveToLS(LS_COMPANY_NEWS, allCompany);
        toast.success(`Found news for ${mapped.length} companies`);
      }
    } catch (e) {
      console.error('Failed to scan company news:', e);
      toast.error('Company news scan failed');
    } finally {
      setCompanyNewsLoading(false);
    }
  }, []);

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
        mergeIntoHistory(data.news);
        const allLive = Array.from(newsHistory.values()).filter(n => !n.id.startsWith('cn') && !n.id.startsWith('custom-intel-'));
        setLiveNews(allLive);
        cachedLiveNews = allLive;
        saveToLS(LS_LIVE_NEWS, allLive);
        const now = new Date();
        setLastRefreshed(now);
        cachedLastRefreshed = now;
        saveToLS(LS_LAST_REFRESHED, now);
        toast.success('Market news updated');
      }
    } catch (e) {
      console.error('Failed to fetch live news:', e);
      toast.error('Failed to fetch live news — showing cached data');
    } finally {
      setNewsLoading(false);
    }
  }, []);

  const fetchIndustryNews = useCallback(async (ind: string) => {
    if (ind === 'all') return;
    setIndustryNewsLoading(true);
    try {
      const resp = await fetch(NEWS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ industry: ind }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 402) {
          toast.error('AI credits exhausted — add credits in Settings → Workspace → Usage');
          return;
        }
        if (resp.status === 429) {
          toast.error('Rate limit hit — please wait a moment and try again');
          return;
        }
        throw new Error(err.error || 'Failed to fetch industry news');
      }
      const data = await resp.json();
      if (data.news && Array.isArray(data.news)) {
        mergeIntoHistory(data.news);
        setIndustryNews(prev => {
          const updated = { ...prev, [ind]: data.news };
          saveToLS(LS_INDUSTRY_NEWS, updated);
          return updated;
        });
        toast.success(`Found ${data.news.length} ${ind} industry items`);
      }
    } catch (e) {
      console.error('Failed to fetch industry news:', e);
      toast.error(`Failed to fetch ${ind} news`);
    } finally {
      setIndustryNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeIndustry !== 'all' && !industryNews[activeIndustry]?.length) {
      fetchIndustryNews(activeIndustry);
    }
  }, [activeIndustry, fetchIndustryNews]);

  useEffect(() => {
    if (!cachedLiveNews) fetchLiveNews();
    if (cachedCompanyNews.length === 0) fetchCompanyNews();

    const interval = setInterval(() => {
      fetchLiveNews();
      fetchCompanyNews();
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchLiveNews, fetchCompanyNews]);

  const currentNews: NewsItem[] = useMemo(() => {
    const all = [...customIntelItems, ...companyNews, ...(liveNews || [])];
    Object.values(industryNews).forEach(items => {
      items.forEach(item => {
        if (!all.some(n => n.id === item.id)) {
          all.push(item);
        }
      });
    });
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customIntelItems, companyNews, liveNews, industryNews]);

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
    let result = currentNews.filter(n => !dismissedIds.has(n.id));
    if (activeCategory !== 'all') {
      result = result.filter(n => n.category === activeCategory);
    }
    if (activeIndustry !== 'all') {
      result = result.filter(news => {
        if ((news as any).industryTag === activeIndustry) return true;
        if (news.id.startsWith(`ind-${activeIndustry.toLowerCase().replace(/[^a-z]/g, '')}`)) return true;
        const prospects = getAffectedProspects(news);
        return prospects.some(p => p.tenant.industry === activeIndustry) ||
          news.relatedTenants?.some(tid => {
            return buildings.some(b => b.tenants.some(t => t.id === tid && t.industry === activeIndustry));
          }) ||
          news.title.toLowerCase().includes(activeIndustry.toLowerCase()) ||
          news.summary.toLowerCase().includes(activeIndustry.toLowerCase());
      });
    }
    return result;
  }, [currentNews, activeCategory, activeIndustry]);

  // Derived data for tabs
  const bookmarkedNews = useMemo(() => filteredNews.filter(n => bookmarkedIds.has(n.id)), [filteredNews, bookmarkedIds]);
  const companyOnlyNews = useMemo(() => filteredNews.filter(n => n.id.startsWith('cn')), [filteredNews]);
  const unreadCount = useMemo(() => currentNews.filter(n => !readIds.has(n.id) && !dismissedIds.has(n.id)).length, [currentNews, readIds, dismissedIds]);
  const companiesScanned = useMemo(() => {
    const set = new Set<string>();
    companyNews.forEach(cn => { if (cn.matchedCompanyName) set.add(cn.matchedCompanyName); });
    return set.size;
  }, [companyNews]);

  // ───── Stats ─────
  const signalCount = useMemo(() => {
    return companyNews.filter(cn => cn.signals && cn.signals.length > 0).length;
  }, [companyNews]);

  const hotSignalCount = useMemo(() => {
    return companyNews.filter(cn => cn.urgency === 'hot').length;
  }, [companyNews]);

  const stats = useMemo(() => [
    { label: 'Total Articles', value: currentNews.length, icon: Newspaper, color: 'text-primary bg-primary/10' },
    { label: 'Signals Detected', value: signalCount, icon: Zap, color: hotSignalCount > 0 ? 'text-destructive bg-destructive/10' : 'text-warning bg-warning/10' },
    { label: 'Companies Scanned', value: companiesScanned, icon: Building2, color: 'text-success bg-success/10' },
    { label: 'Bookmarked', value: bookmarkedIds.size, icon: Bookmark, color: 'text-warning bg-warning/10' },
  ], [currentNews.length, signalCount, hotSignalCount, companiesScanned, bookmarkedIds.size]);

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

  const addListToNews = (newsId: string, listId: string) => {
    const lists = getProspectLists();
    const list = lists.find(l => l.id === listId);
    if (!list || list.entries.length === 0) {
      toast.info('This list has no prospects');
      return;
    }

    const manual = manualProspects[newsId] || [];
    const existingIds = new Set(manual.map(p => p.tenant.id));
    let addedCount = 0;

    const newManual: ProspectMatch[] = [];
    const newCustom: { id: string; name: string }[] = [];

    for (const entry of list.entries) {
      if (existingIds.has(entry.tenantId)) continue;

      let found = false;
      for (const building of buildings) {
        const tenant = building.tenants.find(t => t.id === entry.tenantId);
        if (tenant) {
          newManual.push({ tenant, building });
          existingIds.add(entry.tenantId);
          found = true;
          addedCount++;
          break;
        }
      }

      if (!found) {
        newCustom.push({ id: entry.tenantId, name: entry.tenantName });
        addedCount++;
      }
    }

    if (newManual.length > 0) {
      setManualProspects(prev => ({
        ...prev,
        [newsId]: [...(prev[newsId] || []), ...newManual],
      }));
    }
    if (newCustom.length > 0) {
      setCustomProspects(prev => ({
        ...prev,
        [newsId]: [...(prev[newsId] || []), ...newCustom],
      }));
    }

    toast.success(`Added ${addedCount} prospects from "${list.name}"`);
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
      const greeting = await getUserGreeting();
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
          greeting,
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
      const greeting = await getUserGreeting();
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
          greeting,
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

  // ───── Shared news card renderer ─────
  const renderNewsCard = (news: NewsItem, i: number) => {
    const isCustomIntel = news.id.startsWith('custom-intel-');
    const isCompanyNews = news.id.startsWith('cn');
    const companyItem = isCompanyNews ? (news as CompanyNewsItem) : null;
    const autoProspects = getAffectedProspects(news);
    const manual = manualProspects[news.id] || [];
    const customs = customProspects[news.id] || [];
    const allProspects = [...autoProspects, ...manual];
    const totalCount = allProspects.length + customs.length;
    const isExpanded = expandedNewsId === news.id;
    const selected = selectedProspects[news.id] || new Set();
    const allSelected = totalCount > 0 && selected.size === totalCount;
    const searchResults = getSearchResults(news.id, autoProspects);
    const isBookmarked = bookmarkedIds.has(news.id);
    const isRead = readIds.has(news.id);
    const CategoryIcon = categoryIcons[news.category] || Zap;

    return (
      <motion.div
        key={news.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.03 }}
        className="relative pl-12 pb-6"
      >
        {/* Timeline dot */}
        <div className={`absolute left-3.5 top-4 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-background ${
          isCustomIntel ? 'bg-primary' : isRead ? 'bg-muted-foreground/30' : 'bg-primary'
        }`}>
          <div className="h-1.5 w-1.5 rounded-full bg-background" />
        </div>

        {/* Time label */}
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[10px] font-medium text-muted-foreground">{getTimeSince(news.date)}</span>
          {isCustomIntel && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[8px] py-0">
              Your Intel
            </Badge>
          )}
          {isCompanyNews && companyItem?.matchedCompanyName && (
            <Badge variant="outline" className="bg-accent text-accent-foreground text-[8px] py-0">
              📡 {companyItem.matchedCompanyName}
            </Badge>
          )}
          {(news as any).url && (
            <a
              href={(news as any).url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink className="h-2.5 w-2.5" /> Source
            </a>
          )}
        </div>

        <Card className={`border-border bg-card overflow-hidden transition-all ${
          isExpanded ? 'ring-1 ring-primary/20' : 'hover:border-primary/20'
        } ${isRead ? 'opacity-75' : ''}`}>
          {/* Category stripe — semantic colors */}
          <div className={`h-0.5 ${getCategorySemanticColor(news.category)}`} />

          <div className="p-4">
            {/* Top row */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-md ${getCategoryColor(news.category)} bg-opacity-20`}>
                  <CategoryIcon className="h-3 w-3" />
                </div>
                <Badge variant="outline" className={`text-[10px] ${getCategoryColor(news.category)}`}>{news.category}</Badge>
                <span className="text-[10px] text-muted-foreground/60">{news.source}</span>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleBookmark(news.id); }}
                  className="rounded p-1.5 hover:bg-secondary transition-colors"
                  title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                >
                  {isBookmarked
                    ? <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
                    : <Bookmark className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-foreground" />
                  }
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(`${news.title}\n\n${news.summary}`);
                    toast.success('Copied to clipboard');
                  }}
                  className="rounded p-1.5 hover:bg-secondary transition-colors"
                  title="Copy"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-foreground" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); dismissNews(news.id); }}
                  className="rounded p-1.5 hover:bg-destructive/10 transition-colors"
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-destructive" />
                </button>
                {totalCount > 0 && !isExpanded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedNewsId(news.id);
                      selectAll(news.id, allProspects, customs);
                      sendToSelected(news.id, news, allProspects, customs);
                    }}
                    className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 flex items-center gap-1 ml-1 transition-colors"
                    title="Generate emails for all prospects"
                  >
                    <Mail className="h-3 w-3" /> Quick Draft
                  </button>
                )}
              </div>
            </div>

            {/* Headline + summary */}
            <h3
              className="mb-1.5 text-sm font-semibold text-foreground leading-snug cursor-pointer hover:text-primary transition-colors"
              onClick={() => {
                setExpandedNewsId(isExpanded ? null : news.id);
                if (!isRead) markAsRead(news.id);
              }}
            >
              {news.title}
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground mb-2">{news.summary}</p>

            {/* Signal badges + outreach reason */}
            {isCompanyNews && companyItem && (companyItem.signals?.length || companyItem.outreach_reason) && (
              <div className="mb-3 space-y-1.5">
                {companyItem.signals && companyItem.signals.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {companyItem.urgency === 'hot' && (
                      <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[9px] px-1.5 py-0 font-bold animate-pulse">
                        🔥 HOT
                      </Badge>
                    )}
                    {companyItem.urgency === 'warm' && (
                      <Badge className="bg-warning/15 text-warning border-warning/30 text-[9px] px-1.5 py-0 font-bold">
                        ⚡ WARM
                      </Badge>
                    )}
                    {companyItem.signals.map(signal => (
                      <Badge key={signal} variant="outline" className="text-[8px] px-1.5 py-0 bg-primary/5 text-primary border-primary/20">
                        {signal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                    {companyItem.relevanceScore && companyItem.relevanceScore >= 70 && (
                      <span className="text-[9px] text-muted-foreground ml-1">Score: {companyItem.relevanceScore}</span>
                    )}
                  </div>
                )}
                {companyItem.outreach_reason && (
                  <div className="flex items-start gap-1.5 rounded-md bg-primary/5 border border-primary/10 px-2.5 py-1.5">
                    <Sparkles className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                    <p className="text-[11px] text-primary font-medium leading-snug">{companyItem.outreach_reason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Prospect bar */}
            <button
              onClick={() => {
                setExpandedNewsId(isExpanded ? null : news.id);
                if (!isRead) markAsRead(news.id);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors ${
                totalCount > 0 ? 'bg-primary/5 hover:bg-primary/10' : 'bg-secondary/30 hover:bg-secondary/50'
              }`}
            >
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="flex-1 text-xs font-medium text-primary">
                {totalCount > 0
                  ? `${totalCount} prospect${totalCount !== 1 ? 's' : ''} matched`
                  : 'Add prospects for outreach'
                }
              </span>
              {(manual.length + customs.length) > 0 && (
                <span className="text-[10px] text-muted-foreground">+{manual.length + customs.length} added</span>
              )}
              <ChevronDown className={`h-3.5 w-3.5 text-primary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Expanded prospect panel */}
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
                              tenantId={tenant.id}
                              tenantName={tenant.name}
                              buildingId={bldg.id}
                              buildingName={bldg.name}
                              outreachReason={news.title}
                              onClose={() => setActiveEmailKey(null)}
                              onUpdateEmail={updateEmail}
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {/* Custom prospects */}
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
                              tenantName={custom.name}
                              outreachReason={news.title}
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowSearchFor(news.id)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-[10px] font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                        >
                          <Plus className="h-3 w-3" /> Add prospect manually
                        </button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-[10px] font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors"
                            >
                              <ListPlus className="h-3 w-3" /> Add a list
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="end">
                            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Choose a List
                            </p>
                            {(() => {
                              const lists = getProspectLists();
                              return lists.length > 0 ? (
                                <div className="max-h-48 space-y-0.5 overflow-y-auto">
                                  {lists.map(list => (
                                    <button
                                      key={list.id}
                                      onClick={() => addListToNews(news.id, list.id)}
                                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
                                    >
                                      <span className="truncate">{list.name}</span>
                                      <Badge variant="outline" className="text-[9px] shrink-0">{list.entries.length}</Badge>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="px-2 py-3 text-[11px] text-muted-foreground text-center">No lists yet — create one from Tasks → Lists</p>
                              );
                            })()}
                          </PopoverContent>
                        </Popover>
                      </div>
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
  };

  const renderTimeline = (items: NewsItem[]) => (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-0">
        {items.length > 0 ? (
          items.map((news, i) => renderNewsCard(news, i))
        ) : (
          <div className="pl-12 py-12 text-center">
            <Newspaper className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">No articles found</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters or refresh the feed</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Market Intelligence</h1>
              <p className="mt-1 text-sm text-muted-foreground">Real-time news matched to your prospect universe</p>
            </div>
            <div className="flex items-center gap-2">
              {lastRefreshed && (
                <span className="text-[10px] text-muted-foreground">
                  Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={fetchCompanyNews}
                disabled={companyNewsLoading}
              >
                <Search className={`h-3.5 w-3.5 ${companyNewsLoading ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">Scan Companies</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => { fetchLiveNews(); fetchCompanyNews(); }}
                disabled={newsLoading || companyNewsLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${newsLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh All</span>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ═══ Custom Intel (Dialog) ═══ */}
        <div className="mb-6">
          <Dialog open={showCustomIntel} onOpenChange={setShowCustomIntel}>
            <DialogTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border p-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-foreground">Drop in your own intel</p>
                  <p className="text-[10px] text-muted-foreground">Paste a news article or type custom market intelligence to generate outreach</p>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-primary" />
                  Custom Intel
                </DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                Paste a news article, market data, or type your own intel. This becomes an outreach trigger you can generate emails from.
              </p>
              <textarea
                value={customIntelInput}
                onChange={e => setCustomIntelInput(e.target.value)}
                placeholder={"Paste an article, URL, or type market intelligence here...\n\nExample: 'The American Bar Association is reportedly exploring a move from their current 50,000 SF space at 1050 Connecticut Ave as their lease expires in Q2 2026...'"}
                className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  {customIntelInput.trim().length > 0 ? `${customIntelInput.trim().length} chars` : 'Start typing or paste content'}
                </p>
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={addCustomIntel}
                  disabled={!customIntelInput.trim()}
                >
                  <Sparkles className="mr-1 h-3 w-3" /> Create Outreach Trigger
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* ═══ Loading indicator ═══ */}
        {(newsLoading || companyNewsLoading || industryNewsLoading) && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span className="text-xs text-primary">
              {industryNewsLoading
                ? `Searching latest ${activeIndustry} industry news...`
                : newsLoading && companyNewsLoading
                ? 'Searching real-time market news & scanning your companies...'
                : newsLoading
                ? 'Searching real-time market news via Perplexity...'
                : 'Scanning your companies for recent news...'}
            </span>
          </div>
        )}

        {/* ═══ Tabbed Sections ═══ */}
        <Tabs defaultValue="feed" className="w-full">
          <TabsList className="w-full justify-start bg-secondary/30 border border-border rounded-lg p-1 mb-6">
            <TabsTrigger value="feed" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Rss className="h-3 w-3" /> Feed
              {unreadCount > 0 && (
                <Badge className="ml-1 bg-primary/15 text-primary border-0 text-[9px] px-1.5 py-0 font-bold">{unreadCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="bookmarked" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Bookmark className="h-3 w-3" /> Bookmarked
              {bookmarkedIds.size > 0 && (
                <Badge className="ml-1 bg-warning/15 text-warning border-0 text-[9px] px-1.5 py-0 font-bold">{bookmarkedIds.size}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="company" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Building2 className="h-3 w-3" /> Company Scans
              {companyOnlyNews.length > 0 && (
                <Badge className="ml-1 bg-success/15 text-success border-0 text-[9px] px-1.5 py-0 font-bold">{companyOnlyNews.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── FEED TAB ── */}
          <TabsContent value="feed" className="mt-0">
            {/* Filters */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {cat}
                </button>
              ))}

              <div className="ml-auto relative">
                <button
                  onClick={() => setShowIndustryFilter(!showIndustryFilter)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
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
                            activeIndustry === 'all' ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-secondary'
                          }`}
                        >
                          All Industries
                        </button>
                        {allIndustries.map(ind => (
                          <button
                            key={ind}
                            onClick={() => { setActiveIndustry(ind); setShowIndustryFilter(false); }}
                            className={`w-full text-left rounded-md px-3 py-1.5 text-xs transition-colors ${
                              activeIndustry === ind ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-secondary'
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
              {activeIndustry !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-[10px] text-primary"
                  onClick={() => fetchIndustryNews(activeIndustry)}
                  disabled={industryNewsLoading}
                >
                  <RefreshCw className={`h-3 w-3 ${industryNewsLoading ? 'animate-spin' : ''}`} />
                  Refresh {activeIndustry}
                </Button>
              )}
            </div>

            {renderTimeline(filteredNews)}
          </TabsContent>

          {/* ── BOOKMARKED TAB ── */}
          <TabsContent value="bookmarked" className="mt-0">
            {renderTimeline(bookmarkedNews)}
          </TabsContent>

          {/* ── COMPANY SCANS TAB ── */}
          <TabsContent value="company" className="mt-0">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">News discovered by scanning your prospect companies</p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={fetchCompanyNews}
                disabled={companyNewsLoading}
              >
                <Search className={`h-3 w-3 ${companyNewsLoading ? 'animate-pulse' : ''}`} />
                Re-scan
              </Button>
            </div>
            {renderTimeline(companyOnlyNews)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default News;

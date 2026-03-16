import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Building2, Calendar, ChevronDown, Mail, Users, Briefcase, TrendingUp, AlertTriangle, Info, Zap, Loader2, Copy, Check, X, Plus, Send, Newspaper, MessageCircle, Eye, CheckCircle, ExternalLink, UserPlus, ListPlus, BarChart3, Target } from 'lucide-react';
import EmailDisplay from '@/components/EmailDisplay';
import { getUrgencyColor, scoopPosts, type Tenant, type Building, type OutreachReason, type ScoopPost } from '@/data/mockData';
import { useBuildings } from '@/hooks/useBuildings';
import { getPipeline } from '@/data/pipelineData';
import { buildingSubmarkets, getSubmarketNews, assignTenant, type Broker } from '@/data/activityData';
import { getUserGreeting } from '@/lib/getUserGreeting';
import { useBrokers } from '@/hooks/useBrokers';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useProspectLists } from '@/hooks/useProspectLists';

type ProspectEntry = {
  tenant: Tenant;
  building: Building;
  pipelineStage?: string;
};

const urgencyOrder = { high: 0, medium: 1, low: 2 };

const reasonTypeIcons: Record<string, typeof AlertTriangle> = {
  lease_expiration: Calendar,
  vacancy: Building2,
  market_news: TrendingUp,
  building_sale: Briefcase,
  expansion: TrendingUp,
  contraction: AlertTriangle,
};

const reasonTypeLabels: Record<string, string> = {
  lease_expiration: 'Lease Expiration',
  vacancy: 'Vacancy Signal',
  market_news: 'Market News',
  building_sale: 'Building Sale',
  expansion: 'Expansion Signal',
  contraction: 'Contraction Signal',
};

const OUTREACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-outreach`;

const Prospects = () => {
  const { buildings, loading: buildingsLoading } = useBuildings();
  const brokers = useBrokers();
  const { lists: prospectLists, createList, addProspects: addProspectsToList } = useProspectLists();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [filterIndustry, setFilterIndustry] = useState<string>('all');
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [generatedEmails, setGeneratedEmails] = useState<Record<string, string>>({});
  const [activeEmailKey, setActiveEmailKey] = useState<string | null>(null);
  const [customReasonOpen, setCustomReasonOpen] = useState<string | null>(null);
  const [customReasonText, setCustomReasonText] = useState('');
  const [customEmailKeys, setCustomEmailKeys] = useState<Record<string, string[]>>({});

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBrokerPicker, setShowBrokerPicker] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);
  const [newListName, setNewListName] = useState('');

  const pipeline = getPipeline();

  const prospects = useMemo<ProspectEntry[]>(() => {
    const all: ProspectEntry[] = [];
    buildings.forEach(building => {
      building.tenants.forEach(tenant => {
        // Skip clients — they're already ours
        if (tenant.isClient) return;
        const pipelineEntry = pipeline.find(p => p.tenantId === tenant.id);
        if (!pipelineEntry || !['won', 'lost'].includes(pipelineEntry.stage)) {
          all.push({ tenant, building, pipelineStage: pipelineEntry?.stage });
        }
      });
    });
    return all.sort((a, b) => {
      const aMax = Math.min(...a.tenant.outreachReasons.map(r => urgencyOrder[r.urgency]));
      const bMax = Math.min(...b.tenant.outreachReasons.map(r => urgencyOrder[r.urgency]));
      return aMax - bMax;
    });
  }, [pipeline, buildings]);

  const industries = useMemo(() => {
    const set = new Set(prospects.map(p => p.tenant.industry));
    return ['all', ...Array.from(set).sort()];
  }, [prospects]);

  const filtered = useMemo(() => {
    return prospects.filter(p => {
      if (filterIndustry !== 'all' && p.tenant.industry !== filterIndustry) return false;
      if (filterUrgency !== 'all') {
        const hasUrgency = p.tenant.outreachReasons.some(r => r.urgency === filterUrgency);
        if (!hasUrgency) return false;
      }
      return true;
    });
  }, [prospects, filterUrgency, filterIndustry]);

  // Bulk selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.tenant.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setShowBrokerPicker(false);
    setShowListPicker(false);
  };

  const bulkAssignBroker = (broker: Broker) => {
    const selected = filtered.filter(p => selectedIds.has(p.tenant.id));
    selected.forEach(p => {
      assignTenant(p.tenant.id, p.building.id, broker.id, broker.name);
    });
    toast.success(`Assigned ${selected.length} prospects to ${broker.name}`);
    setShowBrokerPicker(false);
    clearSelection();
  };

  const bulkAddToList = async (listId: string) => {
    const selected = filtered.filter(p => selectedIds.has(p.tenant.id));
    const prospects = selected.map(p => ({
      tenantId: p.tenant.id,
      buildingId: p.building.id,
      tenantName: p.tenant.name,
    }));
    const added = await addProspectsToList(listId, prospects);
    toast.success(`Added ${added} prospects to list`);
    setShowListPicker(false);
    clearSelection();
  };

  const bulkCreateListAndAdd = async () => {
    if (!newListName.trim()) return;
    const list = await createList(newListName.trim());
    if (list) await bulkAddToList(list.id);
    setNewListName('');
  };

  const bulkSendEmail = () => {
    const selected = filtered.filter(p => selectedIds.has(p.tenant.id));
    const emails = selected
      .map(p => p.tenant.contactEmail)
      .filter(Boolean)
      .join(',');
    if (!emails) {
      toast.error('No email addresses found for selected prospects');
      return;
    }
    window.open(`mailto:${emails}`, '_blank');
    toast.success(`Opening email client for ${selected.length} prospects`);
    clearSelection();
  };

  const generateEmail = useCallback(async (tenant: Tenant, building: Building, reason: OutreachReason, key: string) => {
    if (generatedEmails[key]) {
      setActiveEmailKey(activeEmailKey === key ? null : key);
      return;
    }

    setGeneratingKey(key);
    setActiveEmailKey(key);
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
          tenantName: tenant.name,
          buildingName: building.name,
          contactName: tenant.contactName,
          contactTitle: tenant.contactTitle,
          industry: tenant.industry,
          sqft: tenant.sqft,
          leaseExpiration: tenant.leaseExpiration,
          outreachReason: `${reason.title}: ${reason.description}`,
          vacancyRate: building.vacancyRate,
          headcount: tenant.headcount,
          clientsInBuilding: building.tenants
            .filter(t => t.isClient && t.id !== tenant.id)
            .map(t => t.name),
          greeting,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Generation failed' }));
        toast.error(err.error || 'Failed to generate email');
        setGeneratingKey(null);
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
    } catch (e) {
      toast.error('Failed to generate email');
      setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
    setGeneratingKey(null);
  }, [generatedEmails, activeEmailKey]);

  const copyEmail = (key: string) => {
    navigator.clipboard.writeText(generatedEmails[key] || '');
    toast.success('Email copied to clipboard');
  };

  const updateEmail = useCallback((key: string, content: string) => {
    setGeneratedEmails(prev => ({ ...prev, [key]: content }));
  }, []);

  const generateCustomEmail = useCallback((tenant: Tenant, building: Building) => {
    if (!customReasonText.trim()) {
      toast.error('Please enter a reason to reach out');
      return;
    }
    const customReason: OutreachReason = {
      type: 'market_news',
      urgency: 'medium',
      title: 'Custom Outreach',
      description: customReasonText.trim(),
    };
    const key = `${tenant.id}-custom-${Date.now()}`;
    setCustomEmailKeys(prev => ({
      ...prev,
      [tenant.id]: [...(prev[tenant.id] || []), key],
    }));
    generateEmail(tenant, building, customReason, key);
    setCustomReasonText('');
    setCustomReasonOpen(null);
  }, [customReasonText, generateEmail]);

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link to="/" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Active Prospects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} prospects — click any outreach reason to generate a personalized email
          </p>
        </motion.div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {['all', 'high', 'medium', 'low'].map(u => (
            <button
              key={u}
              onClick={() => setFilterUrgency(u)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filterUrgency === u
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {u === 'all' ? 'All Urgency' : u}
            </button>
          ))}
          <select
            value={filterIndustry}
            onChange={e => setFilterIndustry(e.target.value)}
            className="rounded-full border border-border bg-secondary px-3 py-1 text-xs text-foreground"
          >
            {industries.map(i => (
              <option key={i} value={i}>{i === 'all' ? 'All Industries' : i}</option>
            ))}
          </select>
          <button
            onClick={selectAll}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ml-auto ${
              selectedIds.size === filtered.length && filtered.length > 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            {selectedIds.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Prospect List */}
        <div className="space-y-3">
          {filtered.map((entry, i) => {
            const { tenant, building } = entry;
            const isExpanded = expandedId === tenant.id;
            const isSelected = selectedIds.has(tenant.id);
            const highCount = tenant.outreachReasons.filter(r => r.urgency === 'high').length;
            const medCount = tenant.outreachReasons.filter(r => r.urgency === 'medium').length;
            const clientsInBuilding = building.tenants.filter(t => t.isClient);

            return (
              <motion.div
                key={tenant.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className={`border-border bg-card overflow-hidden transition-colors ${isSelected ? 'ring-1 ring-primary border-primary/40' : ''}`}>
                  <div className="flex items-center gap-0">
                    {/* Checkbox */}
                    <div
                      className="flex items-center justify-center pl-4 pr-1 py-4 shrink-0 cursor-pointer"
                      onClick={e => { e.stopPropagation(); toggleSelect(tenant.id); }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(tenant.id)}
                        className="h-4 w-4"
                      />
                    </div>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : tenant.id)}
                      className="flex flex-1 items-center gap-4 p-4 pl-2 text-left transition-colors hover:bg-secondary/30"
                    >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-foreground truncate">{tenant.name}</p>
                        {highCount > 0 && (
                          <Badge variant="outline" className="bg-destructive/20 text-destructive text-[10px] shrink-0">
                            {highCount} urgent
                          </Badge>
                        )}
                        {medCount > 0 && (
                          <Badge variant="outline" className="bg-primary/20 text-primary text-[10px] shrink-0">
                            {medCount} medium
                          </Badge>
                        )}
                        {clientsInBuilding.length > 0 && (
                          <Badge variant="outline" className="bg-success/20 text-success text-[10px] shrink-0">
                            ✓ Client in building
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {building.name}</span>
                        <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {tenant.industry}</span>
                        <span>{tenant.sqft.toLocaleString()} SF</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Exp: {tenant.leaseExpiration}</span>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
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
                        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
                          {/* ─── Section: Overview ─── */}
                          <div>
                            <div className="flex items-center gap-1.5 mb-2.5">
                              <Users className="h-3.5 w-3.5 text-primary" />
                              <h3 className="text-xs font-semibold text-foreground tracking-wide uppercase">Overview</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              <div className="rounded-md bg-secondary/50 p-2.5">
                                <p className="text-[10px] text-muted-foreground mb-0.5">Contact</p>
                                <p className="text-xs font-medium text-foreground">{tenant.contactName}</p>
                                <p className="text-[10px] text-muted-foreground">{tenant.contactTitle}</p>
                              </div>
                              <div className="rounded-md bg-secondary/50 p-2.5">
                                <p className="text-[10px] text-muted-foreground mb-0.5">Space</p>
                                <p className="text-xs font-medium text-foreground">{tenant.sqft.toLocaleString()} SF</p>
                                <p className="text-[10px] text-muted-foreground">Floor {tenant.floor} · {tenant.headcount} people</p>
                              </div>
                              <div className="rounded-md bg-secondary/50 p-2.5">
                                <p className="text-[10px] text-muted-foreground mb-0.5">Lease Expiration</p>
                                <p className="text-xs font-medium text-foreground">{tenant.leaseExpiration}</p>
                                <p className="text-[10px] text-muted-foreground">{Math.round(tenant.sqft / tenant.headcount)} SF/person</p>
                              </div>
                              <div className="rounded-md bg-secondary/50 p-2.5">
                                <p className="text-[10px] text-muted-foreground mb-0.5">Building</p>
                                <p className={`text-xs font-medium ${building.vacancyRate > 20 ? 'text-destructive' : 'text-foreground'}`}>
                                  {building.vacancyRate}% vacancy
                                </p>
                                <p className="text-[10px] text-muted-foreground">Class {building.class} · {building.name}</p>
                              </div>
                            </div>
                          </div>

                          {/* ─── Section: Outreach Triggers ─── */}
                          <div>
                            <div className="flex items-center gap-1.5 mb-2.5">
                              <Target className="h-3.5 w-3.5 text-primary" />
                              <h3 className="text-xs font-semibold text-foreground tracking-wide uppercase">Outreach Triggers</h3>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary">{tenant.outreachReasons.length}</Badge>
                            </div>
                            <div className="space-y-2">
                              {/* Custom Reason — placed first for visibility */}
                              {customReasonOpen === tenant.id ? (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                                  <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                                    <Plus className="h-3.5 w-3.5 text-primary" /> Custom Outreach Reason
                                  </p>
                                  <textarea
                                    value={customReasonText}
                                    onChange={e => setCustomReasonText(e.target.value)}
                                    placeholder="Describe your custom outreach reason..."
                                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="flex items-center gap-2">
                                    <Button size="sm" className="text-xs h-7" disabled={!customReasonText.trim() || !!generatingKey} onClick={() => generateCustomEmail(tenant, building)}>
                                      <Send className="mr-1 h-3 w-3" /> Generate Email
                                    </Button>
                                    <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setCustomReasonOpen(null); setCustomReasonText(''); }}>
                                      Cancel
                                    </Button>
                                  </div>
                                </motion.div>
                              ) : (
                                <button
                                  onClick={() => setCustomReasonOpen(tenant.id)}
                                  className="w-full rounded-md border-2 border-dashed border-primary/30 bg-primary/5 p-2.5 text-xs font-medium text-primary hover:border-primary/50 hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5"
                                >
                                  <Plus className="h-4 w-4" /> Insert Custom Outreach Reason
                                </button>
                              )}

                              {tenant.outreachReasons
                                .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
                                .map((reason, ri) => {
                                  const Icon = reasonTypeIcons[reason.type] || Info;
                                  const key = `${tenant.id}-${ri}`;
                                  const isGenerating = generatingKey === key;
                                  const hasEmail = !!generatedEmails[key];
                                  const isShowingEmail = activeEmailKey === key;

                                  return (
                                    <div key={ri}>
                                      <button
                                        onClick={() => generateEmail(tenant, building, reason, key)}
                                        disabled={!!generatingKey && generatingKey !== key}
                                        className={`w-full text-left rounded-md border p-3 transition-all ${
                                          reason.urgency === 'high'
                                            ? 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
                                            : reason.urgency === 'medium'
                                            ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
                                            : 'border-border bg-secondary/30 hover:bg-secondary/50'
                                        } ${hasEmail ? 'ring-1 ring-primary/40' : ''} ${!!generatingKey && generatingKey !== key ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                      >
                                        <div className="flex items-start gap-2">
                                          {isGenerating ? (
                                            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary animate-spin" />
                                          ) : (
                                            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                              reason.urgency === 'high' ? 'text-destructive' : reason.urgency === 'medium' ? 'text-primary' : 'text-muted-foreground'
                                            }`} />
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <p className="text-xs font-semibold text-foreground">{reason.title}</p>
                                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${getUrgencyColor(reason.urgency)}`}>
                                                {reason.urgency}
                                              </Badge>
                                              <span className="text-[9px] text-muted-foreground">{reasonTypeLabels[reason.type]}</span>
                                              {!hasEmail && <Mail className="ml-auto h-3 w-3 shrink-0 text-primary/50" />}
                                            </div>
                                            <p className="text-[10px] leading-relaxed text-muted-foreground">{reason.description}</p>
                                          </div>
                                        </div>
                                      </button>

                                      {hasEmail && isShowingEmail && (
                                        <div className="mt-2">
                                          <EmailDisplay
                                            emailKey={key}
                                            emailContent={generatedEmails[key] || ''}
                                            isGenerating={isGenerating}
                                            contactName={tenant.contactName}
                                            contactEmail={tenant.contactEmail}
                                            subject={`${tenant.name} — ${reason.title}`}
                                            tenantId={tenant.id}
                                            tenantName={tenant.name}
                                            buildingId={building.id}
                                            buildingName={building.name}
                                            outreachReason={reason.title}
                                            onClose={() => setActiveEmailKey(null)}
                                            onDismiss={() => { setActiveEmailKey(null); setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; }); }}
                                            onUpdateEmail={updateEmail}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>

                            {/* Custom Generated Emails */}
                            {(customEmailKeys[tenant.id] || []).map(key => {
                              const isGenerating = generatingKey === key;
                              const emailContent = generatedEmails[key];
                              if (emailContent === undefined && !isGenerating) return null;
                              return (
                                <div key={key} className="mt-2">
                                  <EmailDisplay
                                    emailKey={key}
                                    emailContent={emailContent || ''}
                                    isGenerating={isGenerating}
                                    label="Custom Email"
                                    contactName={tenant.contactName}
                                    contactEmail={tenant.contactEmail}
                                    subject={`${tenant.name} — Custom Outreach`}
                                    tenantId={tenant.id}
                                    tenantName={tenant.name}
                                    buildingId={building.id}
                                    buildingName={building.name}
                                    onClose={() => {
                                      setCustomEmailKeys(prev => ({ ...prev, [tenant.id]: (prev[tenant.id] || []).filter(k => k !== key) }));
                                      setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
                                    }}
                                    onDismiss={() => {
                                      setCustomEmailKeys(prev => ({ ...prev, [tenant.id]: (prev[tenant.id] || []).filter(k => k !== key) }));
                                      setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
                                    }}
                                    onUpdateEmail={updateEmail}
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {/* ─── Section: Market Intel ─── */}
                          {(() => {
                            const submarket = buildingSubmarkets[building.id];
                            const news = submarket ? getSubmarketNews(submarket) : [];
                            const matchedScoops = scoopPosts.filter(scoop =>
                              scoop.tags.some(tag => {
                                const t = tag.toLowerCase();
                                return (
                                  tenant.name.toLowerCase().includes(t) ||
                                  t.includes(tenant.name.toLowerCase().split(' ')[0]) ||
                                  building.name.toLowerCase().includes(t) ||
                                  t.includes(building.name.toLowerCase()) ||
                                  tenant.industry.toLowerCase().includes(t) ||
                                  t.includes(tenant.industry.toLowerCase())
                                );
                              })
                            );
                            if (news.length === 0 && matchedScoops.length === 0) return null;

                            return (
                              <div>
                                <div className="flex items-center gap-1.5 mb-2.5">
                                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                                  <h3 className="text-xs font-semibold text-foreground tracking-wide uppercase">Market Intel</h3>
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary">{news.slice(0, 4).length + matchedScoops.length}</Badge>
                                </div>

                                {/* Submarket News */}
                                {news.length > 0 && (
                                  <Collapsible defaultOpen={news.length <= 2}>
                                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-secondary/30 px-3 py-2 text-left transition-colors hover:bg-secondary/50 group mb-1.5">
                                      <p className="text-xs font-medium text-foreground flex items-center gap-1">
                                        <Newspaper className="h-3 w-3 text-muted-foreground" /> {submarket} News
                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-1 bg-secondary text-muted-foreground">{news.slice(0, 4).length}</Badge>
                                      </p>
                                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-1.5">
                                      {news.slice(0, 4).map(item => {
                                        const catColors: Record<string, string> = {
                                          development: 'bg-primary/10 text-primary',
                                          infrastructure: 'bg-info/10 text-info',
                                          policy: 'bg-warning/10 text-warning',
                                          tenant_movement: 'bg-destructive/10 text-destructive',
                                          investment: 'bg-success/10 text-success',
                                          amenity: 'bg-accent/10 text-accent-foreground',
                                        };
                                        const newsKey = `${tenant.id}-news-${item.id}`;
                                        const isGeneratingNews = generatingKey === newsKey;
                                        const hasNewsEmail = !!generatedEmails[newsKey];
                                        return (
                                          <div key={item.id} className="space-y-2">
                                            <button
                                              onClick={() => {
                                                const newsReason: OutreachReason = {
                                                  type: 'market_news',
                                                  urgency: 'medium',
                                                  title: item.title,
                                                  description: `${item.summary} — Touchpoint angle: ${item.touchpointAngle}`,
                                                };
                                                generateEmail(tenant, building, newsReason, newsKey);
                                              }}
                                              disabled={isGeneratingNews}
                                              className="w-full rounded-md border border-border bg-secondary/20 p-2.5 text-left transition-colors hover:bg-secondary/40 hover:border-primary/30 cursor-pointer"
                                            >
                                              <div className="flex items-start gap-2">
                                                <Newspaper className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-2 mb-0.5">
                                                    <p className="text-[11px] font-semibold text-foreground truncate">{item.title}</p>
                                                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${catColors[item.category] || ''}`}>
                                                      {item.category.replace('_', ' ')}
                                                    </Badge>
                                                    {!hasNewsEmail && <Mail className="h-3 w-3 shrink-0 text-primary/50" />}
                                                    {isGeneratingNews && <Loader2 className="h-3 w-3 shrink-0 text-primary animate-spin" />}
                                                  </div>
                                                  <p className="text-[10px] text-muted-foreground leading-relaxed">{item.summary}</p>
                                                  <div className="mt-1.5 flex items-start gap-1.5">
                                                    <MessageCircle className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                                                    <p className="text-[10px] text-primary/80 italic leading-relaxed">{item.touchpointAngle}</p>
                                                  </div>
                                                  <div className="mt-1 flex items-center gap-2">
                                                    <p className="text-[9px] text-muted-foreground/50">{item.source} · {item.date}</p>
                                                    {item.url && (
                                                      <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-0.5 text-[9px] text-primary hover:underline">
                                                        <ExternalLink className="h-2.5 w-2.5" /> Article
                                                      </a>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            </button>
                                            {hasNewsEmail && activeEmailKey === newsKey && (
                                              <EmailDisplay
                                                emailKey={newsKey}
                                                emailContent={generatedEmails[newsKey] || ''}
                                                isGenerating={isGeneratingNews}
                                                contactName={tenant.contactName}
                                                contactEmail={tenant.contactEmail}
                                                subject={`${tenant.name} — Market News`}
                                                tenantId={tenant.id}
                                                tenantName={tenant.name}
                                                buildingId={building.id}
                                                buildingName={building.name}
                                                onClose={() => setActiveEmailKey(null)}
                                                onDismiss={() => { setActiveEmailKey(null); setGeneratedEmails(prev => { const n = { ...prev }; delete n[newsKey]; return n; }); }}
                                                onUpdateEmail={updateEmail}
                                              />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}

                                {/* Scoops */}
                                {matchedScoops.length > 0 && (
                                  <Collapsible>
                                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-secondary/30 px-3 py-2 text-left transition-colors hover:bg-secondary/50 group mt-1.5">
                                      <p className="text-xs font-medium text-foreground flex items-center gap-1">
                                        <Eye className="h-3 w-3 text-muted-foreground" /> Broker Intel
                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-1 bg-secondary text-muted-foreground">{matchedScoops.length}</Badge>
                                      </p>
                                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-1.5 space-y-1.5">
                                      {matchedScoops.map(scoop => {
                                        const scoopKey = `${tenant.id}-scoop-${scoop.id}`;
                                        const isGeneratingScoop = generatingKey === scoopKey;
                                        const hasScoopEmail = !!generatedEmails[scoopKey];
                                        return (
                                          <div key={scoop.id} className="space-y-2">
                                            <button
                                              onClick={() => {
                                                const scoopReason: OutreachReason = {
                                                  type: 'market_news',
                                                  urgency: 'medium',
                                                  title: `Broker Intel: ${scoop.tags.join(', ')}`,
                                                  description: scoop.content,
                                                };
                                                generateEmail(tenant, building, scoopReason, scoopKey);
                                              }}
                                              disabled={isGeneratingScoop}
                                              className="w-full rounded-md border border-border bg-secondary/20 p-2.5 text-left transition-colors hover:bg-secondary/40 hover:border-primary/30 cursor-pointer"
                                            >
                                              <div className="flex items-start gap-2">
                                                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-foreground">
                                                  {scoop.authorAvatar}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-[11px] font-semibold text-foreground">{scoop.author}</span>
                                                    {scoop.verified && <CheckCircle className="h-3 w-3 text-primary" />}
                                                    {!hasScoopEmail && <Mail className="h-3 w-3 shrink-0 text-primary/50 ml-auto" />}
                                                    {isGeneratingScoop && <Loader2 className="h-3 w-3 shrink-0 text-primary animate-spin ml-auto" />}
                                                  </div>
                                                  <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{scoop.content}</p>
                                                  <div className="mt-1.5 flex flex-wrap gap-1">
                                                    {scoop.tags.map(tag => (
                                                      <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0 bg-secondary/50 text-muted-foreground">{tag}</Badge>
                                                    ))}
                                                  </div>
                                                </div>
                                              </div>
                                            </button>
                                            {hasScoopEmail && activeEmailKey === scoopKey && (
                                              <EmailDisplay
                                                emailKey={scoopKey}
                                                emailContent={generatedEmails[scoopKey] || ''}
                                                isGenerating={isGeneratingScoop}
                                                contactName={tenant.contactName}
                                                contactEmail={tenant.contactEmail}
                                                subject={`${tenant.name} — Broker Intel`}
                                                tenantId={tenant.id}
                                                tenantName={tenant.name}
                                                buildingId={building.id}
                                                buildingName={building.name}
                                                onClose={() => setActiveEmailKey(null)}
                                                onDismiss={() => { setActiveEmailKey(null); setGeneratedEmails(prev => { const n = { ...prev }; delete n[scoopKey]; return n; }); }}
                                                onUpdateEmail={updateEmail}
                                              />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}
                              </div>
                            );
                          })()}

                          {/* ─── Actions ─── */}
                          <div className="flex items-center gap-2 pt-1 border-t border-border">
                            <Link to={`/building/${building.id}/tenant/${tenant.id}`}>
                              <Button size="sm" className="text-xs h-8">View Full Profile →</Button>
                            </Link>
                            <a href={`mailto:${tenant.contactEmail}`}>
                              <Button size="sm" variant="outline" className="text-xs h-8">
                                <Mail className="mr-1 h-3 w-3" /> Email {tenant.contactName.split(' ')[0]}
                              </Button>
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Floating Bulk Action Bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
            >
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-2xl">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground text-xs px-2.5">
                    {selectedIds.size}
                  </Badge>
                  <span className="text-xs font-medium text-foreground">selected</span>
                </div>

                <div className="h-5 w-px bg-border" />

                {/* Assign Broker */}
                <div className="relative">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={() => { setShowBrokerPicker(!showBrokerPicker); setShowListPicker(false); }}
                  >
                    <UserPlus className="mr-1 h-3 w-3" /> Assign Broker
                  </Button>
                  {showBrokerPicker && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 rounded-md border border-border bg-card p-1 shadow-lg">
                      {brokers.map(broker => (
                        <button
                          key={broker.id}
                          onClick={() => bulkAssignBroker(broker)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-secondary"
                        >
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${broker.color}`}>
                            {broker.initials}
                          </span>
                          {broker.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add to List */}
                <div className="relative">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={() => { setShowListPicker(!showListPicker); setShowBrokerPicker(false); }}
                  >
                    <ListPlus className="mr-1 h-3 w-3" /> Add to List
                  </Button>
                  {showListPicker && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 rounded-md border border-border bg-card p-2 shadow-lg space-y-1">
                      {prospectLists.map(list => (
                        <button
                          key={list.id}
                          onClick={() => bulkAddToList(list.id)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-secondary"
                        >
                          <span className="text-foreground">{list.name}</span>
                          <Badge variant="outline" className="text-[9px]">{list.entries.length}</Badge>
                        </button>
                      ))}
                      <div className="border-t border-border pt-1.5 mt-1.5">
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={newListName}
                            onChange={e => setNewListName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && bulkCreateListAndAdd()}
                            placeholder="New list name..."
                            className="flex-1 rounded-md border border-border bg-secondary/50 px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                          />
                          <Button size="sm" className="text-[10px] h-6 px-2" onClick={bulkCreateListAndAdd} disabled={!newListName.trim()}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Batch Email */}
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={bulkSendEmail}>
                  <Mail className="mr-1 h-3 w-3" /> Email All
                </Button>

                {/* Clear */}
                <button onClick={clearSelection} className="rounded p-1 hover:bg-secondary">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Prospects;

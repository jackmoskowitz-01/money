import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Mail, User, Building2, Clock, Copy, Check, AlertTriangle, Loader2, X, Plus, Send, Newspaper, MessageCircle, Eye, CheckCircle, Zap, Info, Calendar, Briefcase, TrendingUp, ChevronDown, ExternalLink } from 'lucide-react';
import EmailDisplay from '@/components/EmailDisplay';
import { buildings, newsItems, getUrgencyColor, scoopPosts, type OutreachReason } from '@/data/mockData';
import { updatePipelineStage, getOrCreatePipelineItem, stageLabels, stageColors, type PipelineStage } from '@/data/pipelineData';
import { addActivity, buildingSubmarkets, getSubmarketNews } from '@/data/activityData';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import ActivityLog from '@/components/ActivityLog';
import TenantEnrichmentCard from '@/components/TenantEnrichmentCard';
import OwnershipHistoryCard from '@/components/OwnershipHistoryCard';
import BrokerAssignment from '@/components/BrokerAssignment';
import EmailComposer from '@/components/EmailComposer';
import CompanyContacts from '@/components/CompanyContacts';
import ResearchBrief from '@/components/ResearchBrief';
import SequenceBuilder from '@/components/SequenceBuilder';
import MeetingPrepBrief from '@/components/MeetingPrepBrief';
import { getContacts } from '@/data/companyContacts';
import { type EmailRecipient } from '@/components/RecipientPicker';

const stages: PipelineStage[] = ['meeting_set', 'meeting_held', 'moving_forward', 'won', 'closed', 'lost'];

const urgencyOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

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

const TenantDetail = () => {
  const { buildingId, tenantId } = useParams();
  const [currentStage, setCurrentStage] = useState<PipelineStage>('meeting_set');
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [generatedEmails, setGeneratedEmails] = useState<Record<string, string>>({});
  const [activeEmailKey, setActiveEmailKey] = useState<string | null>(null);
  
  const [customReasonOpen, setCustomReasonOpen] = useState(false);
  const [customReasonText, setCustomReasonText] = useState('');
  const [customEmailKeys, setCustomEmailKeys] = useState<string[]>([]);

  const building = buildings.find(b => b.id === buildingId);
  const tenant = building?.tenants.find(t => t.id === tenantId);
  const [contactsVersion, setContactsVersion] = useState(0);

  const recipients: EmailRecipient[] = useMemo(() => {
    const list: EmailRecipient[] = [];
    if (tenant) {
      list.push({
        id: 'primary',
        name: tenant.contactName,
        email: tenant.contactEmail,
        title: tenant.contactTitle,
        isPrimary: true,
      });
    }
    if (tenantId) {
      const additional = getContacts(tenantId);
      additional.forEach(c => {
        list.push({ id: c.id, name: c.name, email: c.email, title: c.title });
      });
    }
    return list;
  }, [tenant, tenantId, contactsVersion]);

  useEffect(() => {
    if (tenantId && buildingId) {
      const item = getOrCreatePipelineItem(tenantId, buildingId);
      setCurrentStage(item.stage);
    }
  }, [tenantId, buildingId]);

  const generateEmail = useCallback(async (reason: OutreachReason, key: string) => {
    if (!tenant || !building) return;
    if (generatedEmails[key]) {
      setActiveEmailKey(activeEmailKey === key ? null : key);
      return;
    }
    setGeneratingKey(key);
    setActiveEmailKey(key);
    setGeneratedEmails(prev => ({ ...prev, [key]: '' }));

    try {
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
        }),
      });

      if (!resp.ok) {
        toast.error('Failed to generate email');
        setGeneratingKey(null);
        setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
        return;
      }

      addActivity({
        tenantId: tenantId!,
        buildingId: buildingId!,
        type: 'ai_email',
        title: `Generated AI email: ${reason.title}`,
        description: `AI outreach generated for ${reason.title}`,
        outreachReasonUsed: reason.title,
      });

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
      toast.error('Failed to generate email');
      setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
    }
    setGeneratingKey(null);
  }, [tenant, building, generatedEmails, activeEmailKey, tenantId, buildingId]);

  const copyEmail = (key: string) => {
    navigator.clipboard.writeText(generatedEmails[key] || '');
    toast.success('Email copied to clipboard');
  };

  const updateEmail = useCallback((key: string, content: string) => {
    setGeneratedEmails(prev => ({ ...prev, [key]: content }));
  }, []);

  const generateCustomEmail = useCallback(() => {
    if (!tenant || !building || !customReasonText.trim()) {
      toast.error('Please enter a reason');
      return;
    }
    const customReason: OutreachReason = {
      type: 'market_news',
      urgency: 'medium',
      title: 'Custom Outreach',
      description: customReasonText.trim(),
    };
    const key = `${tenant.id}-custom-${Date.now()}`;
    setCustomEmailKeys(prev => [...prev, key]);
    generateEmail(customReason, key);
    setCustomReasonText('');
    setCustomReasonOpen(false);
  }, [customReasonText, generateEmail, tenant, building]);

  if (!building || !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-14">
        <p className="text-muted-foreground">Tenant not found</p>
      </div>
    );
  }

  const handleStageChange = (stage: PipelineStage) => {
    updatePipelineStage(tenantId!, buildingId!, stage);
    setCurrentStage(stage);
    addActivity({
      tenantId: tenantId!,
      buildingId: buildingId!,
      type: 'stage_change',
      title: `Stage changed to ${stageLabels[stage]}`,
      description: `Pipeline stage updated from ${stageLabels[currentStage]} to ${stageLabels[stage]}`,
    });
  };

  const submarket = buildingSubmarkets[building.id];
  const submarketNews = submarket ? getSubmarketNews(submarket) : [];
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

  const renderEmailDisplay = (key: string, isGenerating: boolean, label = 'Generated Email') => {
    const emailContent = generatedEmails[key];
    if (emailContent === undefined || activeEmailKey !== key) return null;
    return (
      <EmailDisplay
        emailKey={key}
        emailContent={emailContent}
        isGenerating={isGenerating}
        label={label}
        contactName={tenant?.contactName}
        contactEmail={tenant?.contactEmail}
        subject={`${tenant?.name} — Outreach`}
        recipients={recipients}
        onClose={() => setActiveEmailKey(null)}
        onUpdateEmail={updateEmail}
      />
    );
  };

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link to="/map" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Map
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{tenant.name}</h1>
              <p className="text-muted-foreground">{building.name} · {tenant.industry}</p>
            </div>
            <div className="flex items-center gap-3">
              <BrokerAssignment tenantId={tenantId!} buildingId={buildingId!} />
              <Badge variant="outline" className="text-xs">
                {tenant.outreachReasons.filter(r => r.urgency === 'high').length} urgent signals
              </Badge>
            </div>
          </div>

          {/* Pipeline Stage */}
          <Card className="mb-6 border-border bg-card p-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Pipeline Stage:</span>
              <select
                value={currentStage}
                onChange={e => handleStageChange(e.target.value as PipelineStage)}
                className="rounded-md border border-border bg-secondary/50 px-2 py-1 text-xs font-medium text-foreground"
              >
                {stages.map(s => (
                  <option key={s} value={s}>{stageLabels[s]}</option>
                ))}
              </select>
              <Badge variant="outline" className={`text-[10px] ${stageColors[currentStage]}`}>
                {stageLabels[currentStage]}
              </Badge>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-4">
            <div className="rounded-md bg-secondary/50 p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Headcount</p>
              <p className="text-xs font-medium text-foreground">{tenant.headcount}</p>
              <p className="text-[10px] text-muted-foreground">{Math.round(tenant.sqft / tenant.headcount)} SF/person</p>
            </div>
            <div className="rounded-md bg-secondary/50 p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Floor(s)</p>
              <p className="text-xs font-medium text-foreground">{tenant.floor}</p>
              <p className="text-[10px] text-muted-foreground">{tenant.sqft.toLocaleString()} SF</p>
            </div>
            <div className="rounded-md bg-secondary/50 p-2.5">
              <p className="text-[10px] text-muted-foreground mb-0.5">Building Vacancy</p>
              <p className={`text-xs font-medium ${building.vacancyRate > 20 ? 'text-destructive' : 'text-foreground'}`}>
                {building.vacancyRate}%
              </p>
              <p className="text-[10px] text-muted-foreground">Class {building.class}</p>
            </div>
          </div>

          {/* Company Contacts */}
          <div className="mb-6">
            <CompanyContacts
              entityId={tenantId!}
              primaryContact={{
                name: tenant.contactName,
                title: tenant.contactTitle,
                email: tenant.contactEmail,
              }}
              onContactsChange={() => setContactsVersion(v => v + 1)}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">

              {/* Submarket News Touchpoints */}
              {submarketNews.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-secondary/30 px-3 py-2 text-left transition-colors hover:bg-secondary/50 group">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Newspaper className="h-3.5 w-3.5 text-primary" /> {submarket} Submarket News — Touchpoints
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-1 bg-primary/10 text-primary">{submarketNews.slice(0, 4).length}</Badge>
                    </p>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-1.5">
                    {submarketNews.slice(0, 4).map(item => {
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
                              generateEmail(newsReason, newsKey);
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
                                      <ExternalLink className="h-2.5 w-2.5" /> Read Article
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                          <AnimatePresence>{renderEmailDisplay(newsKey, isGeneratingNews)}</AnimatePresence>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Affiliated Scoops */}
              {matchedScoops.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-secondary/30 px-3 py-2 text-left transition-colors hover:bg-secondary/50 group">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5 text-primary" /> Scoops — Broker Intel
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-1 bg-primary/10 text-primary">{matchedScoops.length}</Badge>
                    </p>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-1.5">
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
                              generateEmail(scoopReason, scoopKey);
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
                                <p className="mt-1 text-[9px] text-muted-foreground/50">{scoop.likes} likes · {scoop.comments} comments</p>
                              </div>
                            </div>
                          </button>
                          <AnimatePresence>{renderEmailDisplay(scoopKey, isGeneratingScoop)}</AnimatePresence>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Outreach Reasons */}
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-secondary/30 px-3 py-2 text-left transition-colors hover:bg-secondary/50 group">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-primary" /> Outreach Reasons
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-1 bg-primary/10 text-primary">{tenant.outreachReasons.length}</Badge>
                  </p>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {tenant.outreachReasons
                    .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
                    .map((reason, ri) => {
                      const Icon = reasonTypeIcons[reason.type] || Info;
                      const key = `${tenant.id}-${ri}`;
                      const isGenerating = generatingKey === key;
                      const hasEmail = !!generatedEmails[key];

                      return (
                        <div key={ri}>
                          <button
                            onClick={() => generateEmail(reason, key)}
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
                                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${getUrgencyColor(reason.urgency)}`}>
                                    {reason.urgency}
                                  </Badge>
                                  <span className="text-[9px] text-muted-foreground">{reasonTypeLabels[reason.type]}</span>
                                  {hasEmail && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary ml-auto">
                                      <Mail className="h-2.5 w-2.5 mr-0.5" /> Email ready
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[11px] leading-relaxed text-muted-foreground">{reason.description}</p>
                              </div>
                            </div>
                          </button>
                          <AnimatePresence>{renderEmailDisplay(key, isGenerating)}</AnimatePresence>
                        </div>
                      );
                    })}
                </CollapsibleContent>
              </Collapsible>

              {/* Custom Reason Input */}
              <div>
                {customReasonOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2"
                  >
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Plus className="h-3.5 w-3.5 text-primary" /> Custom Outreach Reason
                    </p>
                    <textarea
                      value={customReasonText}
                      onChange={e => setCustomReasonText(e.target.value)}
                      placeholder="Type your reason to reach out to this tenant..."
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="text-xs h-7" disabled={!customReasonText.trim() || !!generatingKey} onClick={generateCustomEmail}>
                        <Send className="mr-1 h-3 w-3" /> Generate Email
                      </Button>
                      <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setCustomReasonOpen(false); setCustomReasonText(''); }}>
                        Cancel
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setCustomReasonOpen(true)}
                    className="w-full rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Insert Custom Reason
                  </button>
                )}
              </div>

              {/* Custom Generated Emails */}
              {customEmailKeys.map(key => {
                const isGenerating = generatingKey === key;
                const emailContent = generatedEmails[key];
                if (emailContent === undefined && !isGenerating) return null;
                return (
                  <div key={key}>
                    <EmailDisplay
                      emailKey={key}
                      emailContent={emailContent || ''}
                      isGenerating={isGenerating}
                      label="Custom Email"
                      contactName={tenant.contactName}
                      contactEmail={tenant.contactEmail}
                      subject={`${tenant.name} — Custom Outreach`}
                      recipients={recipients}
                      onClose={() => {
                        setCustomEmailKeys(prev => prev.filter(k => k !== key));
                        setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
                      }}
                      onDismiss={() => {
                        setCustomEmailKeys(prev => prev.filter(k => k !== key));
                        setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
                      }}
                      onUpdateEmail={updateEmail}
                    />
                  </div>
                );
              })}

              {/* Activity Log */}
              <div className="mt-4">
                <ActivityLog
                  tenantId={tenantId!}
                  buildingId={buildingId!}
                  outreachReasonTitles={tenant.outreachReasons.map(r => r.title)}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <EmailComposer
                  tenantId={tenantId!}
                  buildingId={buildingId!}
                  tenantName={tenant.name}
                  contactName={tenant.contactName}
                  contactEmail={tenant.contactEmail}
                  buildingName={building.name}
                  submarket={submarket}
                  sqft={tenant.sqft}
                  leaseExpiration={tenant.leaseExpiration}
                  floor={tenant.floor}
                  recipients={recipients}
                />
                <a href={`mailto:${tenant.contactEmail}`}>
                  <Button size="sm" variant="outline" className="text-xs h-8">
                    <Mail className="mr-1 h-3 w-3" /> Email {tenant.contactName.split(' ')[0]}
                  </Button>
                </a>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <ResearchBrief
                tenantName={tenant.name}
                industry={tenant.industry}
                sqft={tenant.sqft}
                buildingName={building.name}
                leaseExpiration={tenant.leaseExpiration}
                headcount={tenant.headcount}
                contactName={tenant.contactName}
                contactTitle={tenant.contactTitle}
              />
              <SequenceBuilder
                tenantName={tenant.name}
                contactName={tenant.contactName}
                industry={tenant.industry}
                sqft={tenant.sqft}
                buildingName={building.name}
                leaseExpiration={tenant.leaseExpiration}
                contactEmail={tenant.contactEmail}
              />
              <TenantEnrichmentCard
                tenantId={tenantId!}
                tenantName={tenant.name}
                headcount={tenant.headcount}
                sqft={tenant.sqft}
              />
              <OwnershipHistoryCard buildingId={buildingId!} />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default TenantDetail;

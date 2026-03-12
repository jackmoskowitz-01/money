import { useParams, Link } from 'react-router-dom';
import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Globe, MapPin, Plus, Send, Mail, Loader2, ChevronDown, Zap, ShieldAlert, UserCheck, UserPlus, X, Building2, Phone, Briefcase, Clock, MessageSquare, Sparkles, Newspaper, BookOpen, FileSearch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { getCustomProspect, type ProspectEnrichment } from '@/data/customProspects';
import EmailComposer from '@/components/EmailComposer';
import EmailDisplay from '@/components/EmailDisplay';
import CompanyNewsCard from '@/components/CompanyNewsCard';
import ProspectEnrichmentCard from '@/components/ProspectEnrichmentCard';
import CompanyContacts from '@/components/CompanyContacts';
import ActivityLog from '@/components/ActivityLog';
import ResearchBrief from '@/components/ResearchBrief';
import AddToListButton from '@/components/AddToListButton';
import MeetingPrepBrief from '@/components/MeetingPrepBrief';
import { getContacts } from '@/data/companyContacts';
import { type EmailRecipient } from '@/components/RecipientPicker';
import { stageLabels, stageColors, type PipelineStage } from '@/data/pipelineData';
import { addActivity } from '@/data/activityData';
import { usePipeline } from '@/hooks/usePipeline';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const stages: PipelineStage[] = ['meeting_set', 'meeting_held', 'moving_forward', 'won', 'closed', 'lost'];

const OUTREACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-outreach`;

type AutoOutreachReason = { id: string; title: string; description: string; urgency: 'high' | 'medium' | 'low' };

const buildReasonsFromEnrichment = (enrichment?: ProspectEnrichment): AutoOutreachReason[] => {
  if (!enrichment) return [];
  const reasons: AutoOutreachReason[] = [];
  enrichment.creSignals?.forEach((signal, i) => {
    reasons.push({ id: `cre-signal-${i}`, title: signal.length > 60 ? signal.slice(0, 57) + '...' : signal, description: signal, urgency: 'high' });
  });
  enrichment.recentNews?.forEach((news, i) => {
    reasons.push({ id: `news-${i}`, title: news.headline, description: news.summary, urgency: news.signal === 'growth' || news.signal === 'opportunity' ? 'high' : 'medium' });
  });
  if (enrichment.spaceDetails?.leaseExpiration) {
    reasons.push({ id: 'lease-exp', title: `Lease expiring: ${enrichment.spaceDetails.leaseExpiration}`, description: `Current lease is set to expire ${enrichment.spaceDetails.leaseExpiration}. This is a prime opportunity to discuss space options.`, urgency: 'high' });
  }
  return reasons;
};

const CustomProspectDetail = () => {
  const { prospectId } = useParams();
  const prospect = prospectId ? getCustomProspect(prospectId) : undefined;
  const { user, profile } = useAuth();
  const { pipeline, updateStage } = usePipeline();

  const pipelineItem = useMemo(() => pipeline.find(p => p.tenantId === prospectId), [pipeline, prospectId]);
  const currentStage: PipelineStage = pipelineItem?.stage || 'meeting_set';

  const [owner, setOwner] = useState<{ owner_id: string; owner_name: string } | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [ownerActing, setOwnerActing] = useState(false);
  const isMyAccount = owner?.owner_id === user?.id;
  const isClaimed = !!owner;

  useMemo(() => {
    const fetchOwner = async () => {
      if (!prospectId) return;
      const { data } = await supabase.from('prospect_owners').select('owner_id, owner_name').eq('prospect_id', prospectId).maybeSingle();
      setOwner(data || null);
      setOwnerLoading(false);
    };
    fetchOwner();
  }, [prospectId]);

  const claimAccount = async () => {
    if (!user || !profile) return;
    setOwnerActing(true);
    const { error } = await supabase.from('prospect_owners').insert({ prospect_id: prospectId!, owner_id: user.id, owner_name: profile.full_name || profile.email || 'Unknown' });
    if (error) { toast.error(error.code === '23505' ? 'Already claimed by someone else' : 'Failed to claim'); }
    else { setOwner({ owner_id: user.id, owner_name: profile.full_name || profile.email || 'Unknown' }); toast.success('You are now the account owner'); }
    setOwnerActing(false);
  };

  const releaseAccount = async () => {
    if (!user) return;
    setOwnerActing(true);
    const { error } = await supabase.from('prospect_owners').delete().eq('prospect_id', prospectId!).eq('owner_id', user.id);
    if (error) { toast.error('Failed to release account'); }
    else { setOwner(null); toast.success('Account ownership released'); }
    setOwnerActing(false);
  };

  const [contactsVersion, setContactsVersion] = useState(0);
  const [customReasonOpen, setCustomReasonOpen] = useState(false);
  const [customReasonText, setCustomReasonText] = useState('');
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [generatedEmails, setGeneratedEmails] = useState<Record<string, string>>({});
  const [activeEmailKey, setActiveEmailKey] = useState<string | null>(null);
  const [customEmailKeys, setCustomEmailKeys] = useState<string[]>([]);

  const [enrichmentReasons, setEnrichmentReasons] = useState<AutoOutreachReason[]>(() => buildReasonsFromEnrichment(prospect?.enrichment));
  const [newsReasons, setNewsReasons] = useState<AutoOutreachReason[]>([]);

  const outreachReasons = useMemo(() => {
    const all = [...enrichmentReasons, ...newsReasons];
    const seen = new Set<string>();
    return all.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
  }, [enrichmentReasons, newsReasons]);

  const handleEnriched = useCallback((enrichment: ProspectEnrichment) => { setEnrichmentReasons(buildReasonsFromEnrichment(enrichment)); }, []);

  const handleNewsLoaded = useCallback((newsItems: { id: string; title: string; summary: string; category: string; relevanceScore?: number }[]) => {
    setNewsReasons(newsItems.map(item => ({ id: `live-news-${item.id}`, title: item.title, description: item.summary, urgency: (item.relevanceScore && item.relevanceScore >= 70) ? 'high' as const : 'medium' as const })));
  }, []);

  const recipients: EmailRecipient[] = useMemo(() => {
    if (!prospectId) return [];
    return getContacts(prospectId).map(c => ({ id: c.id, name: c.name, email: c.email, title: c.title }));
  }, [prospectId, contactsVersion]);

  if (!prospect) {
    return <div className="flex min-h-screen items-center justify-center pt-14"><p className="text-muted-foreground">Prospect not found</p></div>;
  }

  const handleStageChange = async (stage: PipelineStage) => {
    const buildingId = pipelineItem?.buildingId || 'custom';
    if (!pipelineItem) {
      await supabase.from('pipeline_deals').insert({ tenant_id: prospectId!, building_id: 'custom', stage, notes: [], last_activity: new Date().toISOString(), is_manual: true, prospect_name: prospect.name, sent_touchpoints: [] });
    } else {
      await updateStage(prospectId!, buildingId, stage);
    }
    addActivity({ tenantId: prospectId!, buildingId: '', type: 'stage_change', title: `Stage changed to ${stageLabels[stage]}`, description: `Pipeline stage updated from ${stageLabels[currentStage]} to ${stageLabels[stage]}` });
  };

  const activeStages: PipelineStage[] = ['meeting_set', 'meeting_held', 'moving_forward'];
  const isActiveDeal = activeStages.includes(currentStage);
  const ownedBySomeoneElse = isClaimed && !isMyAccount;
  const outreachBlocked = ownedBySomeoneElse && isActiveDeal;

  const generateCustomEmail = () => {
    if (!customReasonText.trim()) { toast.error('Please enter a reason'); return; }
    const key = `${prospectId}-custom-${Date.now()}`;
    setCustomEmailKeys(prev => [...prev, key]);
    generateEmail(customReasonText.trim(), key);
    setCustomReasonText('');
    setCustomReasonOpen(false);
  };

  const generateEmail = async (reason: string, key: string) => {
    if (generatedEmails[key]) { setActiveEmailKey(activeEmailKey === key ? null : key); return; }
    setGeneratingKey(key);
    setActiveEmailKey(key);
    setGeneratedEmails(prev => ({ ...prev, [key]: '' }));
    try {
      const primaryContact = recipients[0];
      const resp = await fetch(OUTREACH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ tenantName: prospect.name, buildingName: prospect.address, contactName: primaryContact?.name || prospect.name, contactTitle: primaryContact?.title || '', industry: prospect.enrichment?.industry || '', sqft: 0, leaseExpiration: '', outreachReason: reason, vacancyRate: 0, headcount: 0, clientsInBuilding: [] }),
      });
      if (!resp.ok) { toast.error('Failed to generate email'); setGeneratingKey(null); setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; }); return; }
      addActivity({ tenantId: prospectId!, buildingId: '', type: 'ai_email', title: `Generated AI email`, description: `AI outreach generated: ${reason.slice(0, 80)}` });
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '', full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try { const parsed = JSON.parse(json); const content = parsed.choices?.[0]?.delta?.content; if (content) { full += content; setGeneratedEmails(prev => ({ ...prev, [key]: full })); } } catch { }
        }
      }
    } catch { toast.error('Failed to generate email'); setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; }); }
    setGeneratingKey(null);
  };

  const updateEmail = (key: string, content: string) => { setGeneratedEmails(prev => ({ ...prev, [key]: content })); };

  const primaryContact = recipients[0];

  return (
    <div className="min-h-screen pt-14 bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Back Link */}
        <Link to="/" className="mb-5 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* ── COMPANY HEADER CARD ── */}
          <Card className="mb-6 overflow-hidden border-border">
            {/* Outreach blocked banner */}
            {outreachBlocked && (
              <div className="flex items-center gap-2 bg-destructive/10 border-b border-destructive/20 px-5 py-2.5">
                <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-[11px] text-destructive font-medium">
                  {owner!.owner_name} has an active {stageLabels[currentStage].toLowerCase()} on this account — do not reach out.
                </p>
              </div>
            )}

            <div className="p-5">
              {/* Row 1: Name + Actions */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-xl font-bold tracking-tight text-foreground truncate">{prospect.name}</h1>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {prospect.address}</span>
                    {prospect.enrichment?.industry && (
                      <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {prospect.enrichment.industry}</span>
                    )}
                    {prospect.website && (
                      <a href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                        <Globe className="h-3 w-3" /> Website
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <AddToListButton tenantId={prospectId!} buildingId="" tenantName={prospect.name} />
                </div>
              </div>

              <Separator className="my-4" />

              {/* Row 2: Status Chips */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Pipeline Stage */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stage</span>
                  <select
                    value={currentStage}
                    onChange={e => handleStageChange(e.target.value as PipelineStage)}
                    disabled={ownedBySomeoneElse}
                    className="rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-xs font-medium text-foreground disabled:opacity-60 cursor-pointer"
                  >
                    {stages.map(s => <option key={s} value={s}>{stageLabels[s]}</option>)}
                  </select>
                </div>

                <div className="h-5 w-px bg-border" />

                {/* Account Owner */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Owner</span>
                  {ownerLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : !isClaimed ? (
                    <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1 border-dashed border-primary/40 text-primary hover:bg-primary/10 px-2" onClick={claimAccount} disabled={ownerActing}>
                      {ownerActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                      Claim Account
                    </Button>
                  ) : isMyAccount ? (
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20 py-0.5">
                        <UserCheck className="h-2.5 w-2.5" /> My Account
                      </Badge>
                      <button onClick={releaseAccount} disabled={ownerActing} className="rounded p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Release ownership">
                        {ownerActing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5" />}
                      </button>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-muted text-muted-foreground py-0.5">
                      <UserCheck className="h-2.5 w-2.5" /> {owner!.owner_name}
                    </Badge>
                  )}
                </div>

                <div className="h-5 w-px bg-border" />

                {/* Quick Actions */}
                <div className="flex items-center gap-2">
                  <EmailComposer
                    tenantId={prospectId!}
                    buildingId=""
                    tenantName={prospect.name}
                    contactName={primaryContact?.name || prospect.name}
                    contactEmail={primaryContact?.email}
                    buildingName={prospect.address}
                    recipients={recipients}
                  />
                  {primaryContact?.email && (
                    <a href={`mailto:${primaryContact.email}`}>
                      <Button size="sm" variant="ghost" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
                        <Mail className="h-3.5 w-3.5" /> Email
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* ── MAIN CONTENT: TABS + SIDEBAR ── */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column — Tabbed Content */}
            <div className="lg:col-span-2">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full justify-start bg-secondary/30 border border-border rounded-lg p-1 mb-4">
                  <TabsTrigger value="overview" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                    <Building2 className="h-3 w-3" /> Overview
                  </TabsTrigger>
                  <TabsTrigger value="outreach" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                    <Sparkles className="h-3 w-3" /> Outreach
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                    <Clock className="h-3 w-3" /> Activity
                  </TabsTrigger>
                  <TabsTrigger value="news" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                    <Newspaper className="h-3 w-3" /> News
                  </TabsTrigger>
                </TabsList>

                {/* ── OVERVIEW TAB ── */}
                <TabsContent value="overview" className="space-y-5 mt-0">
                  {/* Contacts */}
                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Phone className="h-3 w-3" /> Contacts
                    </h2>
                    <CompanyContacts entityId={prospectId!} onContactsChange={() => setContactsVersion(v => v + 1)} />
                  </section>

                  {/* Company Intel */}
                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <FileSearch className="h-3 w-3" /> Company Intel
                    </h2>
                    <ProspectEnrichmentCard
                      prospectId={prospectId!}
                      companyName={prospect.name}
                      website={prospect.website}
                      address={prospect.address}
                      cachedEnrichment={prospect.enrichment}
                      onEnriched={handleEnriched}
                    />
                  </section>
                </TabsContent>

                {/* ── OUTREACH TAB ── */}
                <TabsContent value="outreach" className="space-y-5 mt-0">
                  {/* Custom Outreach */}
                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3" /> Custom Outreach
                    </h2>
                    {customReasonOpen ? (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                        <textarea
                          value={customReasonText}
                          onChange={e => setCustomReasonText(e.target.value)}
                          placeholder="Type your reason to reach out to this prospect..."
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="text-xs h-7" disabled={!customReasonText.trim() || !!generatingKey} onClick={generateCustomEmail}>
                            <Send className="mr-1 h-3 w-3" /> Generate Email
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setCustomReasonOpen(false); setCustomReasonText(''); }}>Cancel</Button>
                        </div>
                      </motion.div>
                    ) : (
                      <button onClick={() => setCustomReasonOpen(true)} className="w-full rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-xs font-medium text-primary hover:border-primary/50 hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5">
                        <Plus className="h-4 w-4" /> Write Custom Outreach
                      </button>
                    )}
                  </section>

                  {/* Custom Generated Emails */}
                  {customEmailKeys.map(key => {
                    const isGenerating = generatingKey === key;
                    const emailContent = generatedEmails[key];
                    if (emailContent === undefined && !isGenerating) return null;
                    return (
                      <div key={key}>
                        <EmailDisplay emailKey={key} emailContent={emailContent || ''} isGenerating={isGenerating} label="Custom Email" contactName={primaryContact?.name || prospect.name} contactEmail={primaryContact?.email} subject={`${prospect.name} — Outreach`} recipients={recipients} tenantId={prospectId} tenantName={prospect.name} onClose={() => { setCustomEmailKeys(prev => prev.filter(k => k !== key)); setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; }); }} onDismiss={() => { setCustomEmailKeys(prev => prev.filter(k => k !== key)); setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; }); }} onUpdateEmail={updateEmail} />
                      </div>
                    );
                  })}

                  {/* AI Outreach Reasons */}
                  {outreachReasons.length > 0 && (
                    <section>
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Zap className="h-3 w-3 text-primary" /> AI-Detected Reasons
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary">{outreachReasons.length}</Badge>
                      </h2>
                      <div className="space-y-2">
                        {outreachReasons
                          .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.urgency] - { high: 0, medium: 1, low: 2 }[b.urgency]))
                          .map(reason => {
                            const key = `${prospectId}-reason-${reason.id}`;
                            const isGenerating = generatingKey === key;
                            const hasEmail = !!generatedEmails[key];
                            const urgencyColors = {
                              high: 'bg-destructive/10 text-destructive border-destructive/20',
                              medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                              low: 'bg-muted text-muted-foreground border-border',
                            };
                            return (
                              <div key={reason.id} className="space-y-2">
                                <button onClick={() => generateEmail(reason.description, key)} disabled={isGenerating} className="w-full rounded-lg border border-border bg-card p-3 text-left transition-all hover:border-primary/30 hover:shadow-sm cursor-pointer">
                                  <div className="flex items-start gap-2.5">
                                    <div className={`mt-0.5 rounded-full p-1 ${reason.urgency === 'high' ? 'bg-destructive/10' : 'bg-muted'}`}>
                                      <Zap className={`h-3 w-3 ${reason.urgency === 'high' ? 'text-destructive' : 'text-muted-foreground'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <p className="text-[11px] font-semibold text-foreground truncate">{reason.title}</p>
                                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 capitalize ${urgencyColors[reason.urgency]}`}>{reason.urgency}</Badge>
                                        {!hasEmail && <Mail className="h-3 w-3 shrink-0 text-primary/40 ml-auto" />}
                                        {isGenerating && <Loader2 className="h-3 w-3 shrink-0 text-primary animate-spin ml-auto" />}
                                      </div>
                                      <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{reason.description}</p>
                                    </div>
                                  </div>
                                </button>
                                <AnimatePresence>
                                  {activeEmailKey === key && generatedEmails[key] !== undefined && (
                                    <EmailDisplay emailKey={key} emailContent={generatedEmails[key] || ''} isGenerating={isGenerating} label="Generated Email" contactName={primaryContact?.name || prospect.name} contactEmail={primaryContact?.email} subject={`${prospect.name} — Outreach`} recipients={recipients} tenantId={prospectId} tenantName={prospect.name} onClose={() => setActiveEmailKey(null)} onUpdateEmail={updateEmail} />
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                      </div>
                    </section>
                  )}
                </TabsContent>

                {/* ── ACTIVITY TAB ── */}
                <TabsContent value="activity" className="mt-0">
                  <ActivityLog tenantId={prospectId!} buildingId="" outreachReasonTitles={[]} contactsVersion={contactsVersion} />
                </TabsContent>

                {/* ── NEWS TAB ── */}
                <TabsContent value="news" className="mt-0">
                  <CompanyNewsCard
                    companyId={prospectId!}
                    companyName={prospect.name}
                    onNewsLoaded={handleNewsLoaded}
                    onOutreachTrigger={(title, summary) => { setCustomReasonText(`${title} — ${summary}`); setCustomReasonOpen(true); }}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* ── RIGHT SIDEBAR ── */}
            <div className="space-y-4">
              {/* Meeting Prep */}
              <Card className="border-border overflow-hidden">
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary/30 group">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3 text-primary" /> Meeting Prep
                    </h3>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <MeetingPrepBrief
                        tenantName={prospect.name} industry={prospect.enrichment?.industry || ''} sqft={0} headcount={0} leaseExpiration="" floor="" contactName={primaryContact?.name || prospect.name} contactTitle={primaryContact?.title || ''} contactEmail={primaryContact?.email || ''} buildingName={prospect.address} buildingClass="" buildingFloors={0} buildingYearBuilt={0} vacancyRate={0} owner="" outreachReasons={[]} submarketNews={[]} scoopIntel={[]}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>

              {/* Research Brief */}
              <Card className="border-border overflow-hidden">
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary/30 group">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <FileSearch className="h-3 w-3 text-primary" /> Research Brief
                    </h3>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <ResearchBrief tenantName={prospect.name} industry={prospect.enrichment?.industry || ''} sqft={0} buildingName={prospect.address} leaseExpiration="" headcount={0} contactName={primaryContact?.name || prospect.name} contactTitle={primaryContact?.title || ''} />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CustomProspectDetail;

import { useParams, Link } from 'react-router-dom';
import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Globe, MapPin, Plus, Send, Mail, Loader2, ChevronDown, Zap, ShieldAlert, UserCheck, UserPlus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import AccountOwnerBadge from '@/components/AccountOwnerBadge';
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

  // CRE signals → high urgency outreach reasons
  enrichment.creSignals?.forEach((signal, i) => {
    reasons.push({
      id: `cre-signal-${i}`,
      title: signal.length > 60 ? signal.slice(0, 57) + '...' : signal,
      description: signal,
      urgency: 'high',
    });
  });

  // Recent news → medium urgency outreach reasons
  enrichment.recentNews?.forEach((news, i) => {
    reasons.push({
      id: `news-${i}`,
      title: news.headline,
      description: news.summary,
      urgency: news.signal === 'growth' || news.signal === 'opportunity' ? 'high' : 'medium',
    });
  });

  // Space details → outreach angles
  if (enrichment.spaceDetails?.leaseExpiration) {
    reasons.push({
      id: 'lease-exp',
      title: `Lease expiring: ${enrichment.spaceDetails.leaseExpiration}`,
      description: `Current lease is set to expire ${enrichment.spaceDetails.leaseExpiration}. This is a prime opportunity to discuss space options.`,
      urgency: 'high',
    });
  }

  return reasons;
};

const CustomProspectDetail = () => {
  const { prospectId } = useParams();
  const prospect = prospectId ? getCustomProspect(prospectId) : undefined;
  const { user, profile } = useAuth();
  const { pipeline, updateStage } = usePipeline();

  // Get DB-backed pipeline stage for this prospect
  const pipelineItem = useMemo(() => {
    return pipeline.find(p => p.tenantId === prospectId);
  }, [pipeline, prospectId]);
  const currentStage: PipelineStage = pipelineItem?.stage || 'meeting_set';

  // Account owner state
  const [owner, setOwner] = useState<{ owner_id: string; owner_name: string } | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [ownerActing, setOwnerActing] = useState(false);
  const isMyAccount = owner?.owner_id === user?.id;
  const isClaimed = !!owner;

  // Fetch owner
  useState(() => {
    const fetchOwner = async () => {
      if (!prospectId) return;
      const { data } = await supabase
        .from('prospect_owners')
        .select('owner_id, owner_name')
        .eq('prospect_id', prospectId)
        .maybeSingle();
      setOwner(data || null);
      setOwnerLoading(false);
    };
    fetchOwner();
  });

  const claimAccount = async () => {
    if (!user || !profile) return;
    setOwnerActing(true);
    const { error } = await supabase
      .from('prospect_owners')
      .insert({
        prospect_id: prospectId!,
        owner_id: user.id,
        owner_name: profile.full_name || profile.email || 'Unknown',
      });
    if (error) {
      toast.error(error.code === '23505' ? 'Already claimed by someone else' : 'Failed to claim');
    } else {
      setOwner({ owner_id: user.id, owner_name: profile.full_name || profile.email || 'Unknown' });
      toast.success('You are now the account owner');
    }
    setOwnerActing(false);
  };

  const releaseAccount = async () => {
    if (!user) return;
    setOwnerActing(true);
    const { error } = await supabase
      .from('prospect_owners')
      .delete()
      .eq('prospect_id', prospectId!)
      .eq('owner_id', user.id);
    if (error) {
      toast.error('Failed to release account');
    } else {
      setOwner(null);
      toast.success('Account ownership released');
    }
    setOwnerActing(false);
  };

  const [contactsVersion, setContactsVersion] = useState(0);
  const [customReasonOpen, setCustomReasonOpen] = useState(false);
  const [customReasonText, setCustomReasonText] = useState('');
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [generatedEmails, setGeneratedEmails] = useState<Record<string, string>>({});
  const [activeEmailKey, setActiveEmailKey] = useState<string | null>(null);
  const [customEmailKeys, setCustomEmailKeys] = useState<string[]>([]);

  // Auto-generated outreach reasons from enrichment + live news
  const [enrichmentReasons, setEnrichmentReasons] = useState<AutoOutreachReason[]>(() => {
    return buildReasonsFromEnrichment(prospect?.enrichment);
  });
  const [newsReasons, setNewsReasons] = useState<AutoOutreachReason[]>([]);

  const outreachReasons = useMemo(() => {
    const all = [...enrichmentReasons, ...newsReasons];
    const seen = new Set<string>();
    return all.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [enrichmentReasons, newsReasons]);

  const handleEnriched = useCallback((enrichment: ProspectEnrichment) => {
    setEnrichmentReasons(buildReasonsFromEnrichment(enrichment));
  }, []);

  const handleNewsLoaded = useCallback((newsItems: { id: string; title: string; summary: string; category: string; relevanceScore?: number }[]) => {
    const reasons: AutoOutreachReason[] = newsItems.map(item => ({
      id: `live-news-${item.id}`,
      title: item.title,
      description: item.summary,
      urgency: (item.relevanceScore && item.relevanceScore >= 70) ? 'high' as const : 'medium' as const,
    }));
    setNewsReasons(reasons);
  }, []);

  const recipients: EmailRecipient[] = useMemo(() => {
    const list: EmailRecipient[] = [];
    if (prospectId) {
      const contacts = getContacts(prospectId);
      contacts.forEach(c => {
        list.push({ id: c.id, name: c.name, email: c.email, title: c.title });
      });
    }
    return list;
  }, [prospectId, contactsVersion]);

  if (!prospect) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-14">
        <p className="text-muted-foreground">Prospect not found</p>
      </div>
    );
  }

  const handleStageChange = async (stage: PipelineStage) => {
    const buildingId = pipelineItem?.buildingId || 'custom';
    await updateStage(prospectId!, buildingId, stage);
    addActivity({
      tenantId: prospectId!,
      buildingId: '',
      type: 'stage_change',
      title: `Stage changed to ${stageLabels[stage]}`,
      description: `Pipeline stage updated from ${stageLabels[currentStage]} to ${stageLabels[stage]}`,
    });
  };

  // Determine if outreach should be blocked (someone else owns + active deal)
  const activeStages: PipelineStage[] = ['meeting_set', 'meeting_held', 'moving_forward'];
  const isActiveDeal = activeStages.includes(currentStage);
  const ownedBySomeoneElse = isClaimed && !isMyAccount;
  const outreachBlocked = ownedBySomeoneElse && isActiveDeal;

  const generateCustomEmail = () => {
    if (!customReasonText.trim()) {
      toast.error('Please enter a reason');
      return;
    }
    const key = `${prospectId}-custom-${Date.now()}`;
    setCustomEmailKeys(prev => [...prev, key]);
    generateEmail(customReasonText.trim(), key);
    setCustomReasonText('');
    setCustomReasonOpen(false);
  };

  const generateEmail = async (reason: string, key: string) => {
    if (generatedEmails[key]) {
      setActiveEmailKey(activeEmailKey === key ? null : key);
      return;
    }
    setGeneratingKey(key);
    setActiveEmailKey(key);
    setGeneratedEmails(prev => ({ ...prev, [key]: '' }));

    try {
      const primaryContact = recipients[0];
      const resp = await fetch(OUTREACH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          tenantName: prospect.name,
          buildingName: prospect.address,
          contactName: primaryContact?.name || prospect.name,
          contactTitle: primaryContact?.title || '',
          industry: prospect.enrichment?.industry || '',
          sqft: 0,
          leaseExpiration: '',
          outreachReason: reason,
          vacancyRate: 0,
          headcount: 0,
          clientsInBuilding: [],
        }),
      });

      if (!resp.ok) {
        toast.error('Failed to generate email');
        setGeneratingKey(null);
        setGeneratedEmails(prev => { const n = { ...prev }; delete n[key]; return n; });
        return;
      }

      addActivity({
        tenantId: prospectId!,
        buildingId: '',
        type: 'ai_email',
        title: `Generated AI email`,
        description: `AI outreach generated: ${reason.slice(0, 80)}`,
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
  };

  const updateEmail = (key: string, content: string) => {
    setGeneratedEmails(prev => ({ ...prev, [key]: content }));
  };

  const primaryContact = recipients[0];

  return (
    <div className="min-h-screen pt-14 bg-background">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{prospect.name}</h1>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1.5">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {prospect.address}
                </span>
                {prospect.enrichment?.industry && (
                  <span className="text-xs">{prospect.enrichment.industry}</span>
                )}
                {prospect.website && (
                  <a
                    href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" /> Website
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AddToListButton tenantId={prospectId!} buildingId="" tenantName={prospect.name} />
              <AccountOwnerBadge prospectId={prospectId!} />
            </div>
          </div>

          {/* Pipeline Stage */}
          <Card className="mb-8 border-border bg-card p-4">
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

          {/* Company Contacts */}
          <div className="mb-8">
            <CompanyContacts
              entityId={prospectId!}
              onContactsChange={() => setContactsVersion(v => v + 1)}
            />
          </div>

          <div className="grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">

              {/* Quick Actions: Email Templates + Direct Email */}
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Actions</h2>
                <Card className="border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-3 flex-wrap">
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
                        <Button size="sm" variant="outline" className="text-xs h-9">
                          <Mail className="mr-1.5 h-4 w-4" /> Email {primaryContact.name.split(' ')[0]}
                        </Button>
                      </a>
                    )}
                  </div>
                </Card>
              </div>

              {/* Activity Log — prominent placement */}
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Activity History</h2>
                <ActivityLog
                  tenantId={prospectId!}
                  buildingId=""
                  outreachReasonTitles={[]}
                  contactsVersion={contactsVersion}
                />
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* 1. Custom Outreach Reason */}
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
                      placeholder="Type your reason to reach out to this prospect..."
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
                    className="w-full rounded-md border-2 border-dashed border-primary/30 bg-primary/5 p-3 text-xs font-medium text-primary hover:border-primary/50 hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Insert Custom Outreach Reason
                  </button>
                )}
              </div>

              {/* Auto-generated Outreach Reasons from Enrichment */}
              {outreachReasons.length > 0 && (
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-secondary/30 px-3 py-2 text-left transition-colors hover:bg-secondary/50 group">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 text-primary" /> Outreach Reasons
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-1 bg-primary/10 text-primary">{outreachReasons.length}</Badge>
                    </p>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-1.5">
                    {outreachReasons
                      .sort((a, b) => {
                        const order = { high: 0, medium: 1, low: 2 };
                        return order[a.urgency] - order[b.urgency];
                      })
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
                            <button
                              onClick={() => generateEmail(reason.description, key)}
                              disabled={isGenerating}
                              className="w-full rounded-md border border-border bg-secondary/20 p-2.5 text-left transition-colors hover:bg-secondary/40 hover:border-primary/30 cursor-pointer"
                            >
                              <div className="flex items-start gap-2">
                                <Zap className={`mt-0.5 h-3 w-3 shrink-0 ${reason.urgency === 'high' ? 'text-destructive' : 'text-muted-foreground'}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-[11px] font-semibold text-foreground truncate">{reason.title}</p>
                                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 capitalize ${urgencyColors[reason.urgency]}`}>
                                      {reason.urgency}
                                    </Badge>
                                    {!hasEmail && <Mail className="h-3 w-3 shrink-0 text-primary/50 ml-auto" />}
                                    {isGenerating && <Loader2 className="h-3 w-3 shrink-0 text-primary animate-spin ml-auto" />}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{reason.description}</p>
                                </div>
                              </div>
                            </button>
                            <AnimatePresence>
                              {activeEmailKey === key && generatedEmails[key] !== undefined && (
                                <EmailDisplay
                                  emailKey={key}
                                  emailContent={generatedEmails[key] || ''}
                                  isGenerating={isGenerating}
                                  label="Generated Email"
                                  contactName={primaryContact?.name || prospect.name}
                                  contactEmail={primaryContact?.email}
                                  subject={`${prospect.name} — Outreach`}
                                  recipients={recipients}
                                  tenantId={prospectId}
                                  tenantName={prospect.name}
                                  onClose={() => setActiveEmailKey(null)}
                                  onUpdateEmail={updateEmail}
                                />
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                  </CollapsibleContent>
                </Collapsible>
              )}

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
                      contactName={primaryContact?.name || prospect.name}
                      contactEmail={primaryContact?.email}
                      subject={`${prospect.name} — Outreach`}
                      recipients={recipients}
                      tenantId={prospectId}
                      tenantName={prospect.name}
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

              {/* Real-Time Company News */}
              <CompanyNewsCard
                companyId={prospectId!}
                companyName={prospect.name}
                onNewsLoaded={handleNewsLoaded}
                onOutreachTrigger={(title, summary) => {
                  setCustomReasonText(`${title} — ${summary}`);
                  setCustomReasonOpen(true);
                }}
              />

            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <MeetingPrepBrief
                tenantName={prospect.name}
                industry={prospect.enrichment?.industry || ''}
                sqft={0}
                headcount={0}
                leaseExpiration=""
                floor=""
                contactName={primaryContact?.name || prospect.name}
                contactTitle={primaryContact?.title || ''}
                contactEmail={primaryContact?.email || ''}
                buildingName={prospect.address}
                buildingClass=""
                buildingFloors={0}
                buildingYearBuilt={0}
                vacancyRate={0}
                owner=""
                outreachReasons={[]}
                submarketNews={[]}
                scoopIntel={[]}
              />
              <ResearchBrief
                tenantName={prospect.name}
                industry={prospect.enrichment?.industry || ''}
                sqft={0}
                buildingName={prospect.address}
                leaseExpiration=""
                headcount={0}
                contactName={primaryContact?.name || prospect.name}
                contactTitle={primaryContact?.title || ''}
              />
              <ProspectEnrichmentCard
                prospectId={prospectId!}
                companyName={prospect.name}
                website={prospect.website}
                address={prospect.address}
                cachedEnrichment={prospect.enrichment}
                onEnriched={handleEnriched}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default CustomProspectDetail;

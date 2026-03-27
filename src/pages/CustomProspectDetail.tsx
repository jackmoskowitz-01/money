import { useParams, Link } from 'react-router-dom';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Globe, MapPin, Plus, Send, Mail, Loader2, ChevronDown, Zap, ShieldAlert, UserCheck, UserPlus, X, Building2, Phone, Briefcase, Clock, MessageSquare, Sparkles, Newspaper, BookOpen, FileSearch, Upload, FileText, Trash2, Download, File } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
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
import { useContacts } from '@/hooks/useContacts';
import { type EmailRecipient } from '@/components/RecipientPicker';
import { stageLabels, stageColors, type PipelineStage } from '@/data/pipelineData';
import { addActivity } from '@/data/activityData';
import { usePipeline } from '@/hooks/usePipeline';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getAuthToken } from '@/lib/getAuthToken';

const stages: PipelineStage[] = ['meeting_set', 'meeting_held', 'moving_forward', 'won', 'closed', 'lost'];

const OUTREACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-outreach`;

type AutoOutreachReason = { id: string; title: string; description: string; urgency: 'high' | 'medium' | 'low' };

type ProspectFile = {
  id: string;
  prospect_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
};

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

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const CustomProspectDetail = () => {
  const { prospectId } = useParams();
  const localProspect = prospectId ? getCustomProspect(prospectId) : undefined;
  const [dbProspect, setDbProspect] = useState<ReturnType<typeof getCustomProspect> | undefined>(undefined);
  const { user, profile } = useAuth();

  // If not found in local/custom_prospects, check the prospects table
  useEffect(() => {
    if (localProspect || !prospectId) return;
    supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDbProspect({
            id: data.id,
            name: data.company_name,
            website: data.website_url || '',
            address: data.address || '',
            createdAt: data.created_at,
            source: 'prospects',
          });
        }
      });
  }, [prospectId, localProspect]);

  const prospect = localProspect || dbProspect;
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

  const { contacts: prospectContacts } = useContacts(prospectId);
  const [customReasonOpen, setCustomReasonOpen] = useState(false);
  const [customReasonText, setCustomReasonText] = useState('');
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [generatedEmails, setGeneratedEmails] = useState<Record<string, string>>({});
  const [activeEmailKey, setActiveEmailKey] = useState<string | null>(null);
  const [customEmailKeys, setCustomEmailKeys] = useState<string[]>([]);

  // Files state
  const [files, setFiles] = useState<ProspectFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!prospectId) return;
    const fetchFiles = async () => {
      const { data } = await supabase
        .from('prospect_files')
        .select('*')
        .eq('prospect_id', prospectId)
        .order('created_at', { ascending: false });
      setFiles((data as ProspectFile[]) || []);
      setFilesLoading(false);
    };
    fetchFiles();
  }, [prospectId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || !user || !profile || !prospectId) return;
    setUploading(true);

    for (const file of Array.from(selectedFiles)) {
      const filePath = `${prospectId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('prospect-files')
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const { error: metaError } = await supabase.from('prospect_files').insert({
        prospect_id: prospectId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type || 'application/octet-stream',
        uploaded_by: user.id,
        uploaded_by_name: profile.full_name || profile.email || 'Unknown',
      });

      if (metaError) {
        toast.error(`Failed to save metadata for ${file.name}`);
      } else {
        toast.success(`Uploaded ${file.name}`);
      }
    }

    // Refresh files list
    const { data } = await supabase
      .from('prospect_files')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: false });
    setFiles((data as ProspectFile[]) || []);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteFile = async (file: ProspectFile) => {
    await supabase.storage.from('prospect-files').remove([file.file_path]);
    const { error } = await supabase.from('prospect_files').delete().eq('id', file.id);
    if (error) { toast.error('Failed to delete file'); return; }
    setFiles(prev => prev.filter(f => f.id !== file.id));
    toast.success('File deleted');
  };

  const handleDownloadFile = async (file: ProspectFile) => {
    const { data } = await supabase.storage.from('prospect-files').download(file.file_path);
    if (!data) { toast.error('Failed to download'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

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
    return prospectContacts.map(c => ({ id: c.id, name: c.name, email: c.email, title: c.title }));
  }, [prospectId, prospectContacts]);

  if (!prospect) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Prospect not found</p></div>;
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAuthToken()}` },
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

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return '📊';
    if (type.includes('image')) return '🖼️';
    return '📎';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Breadcrumb className="mb-5">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/prospects">Prospects</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{prospect.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* ── COMPANY HEADER CARD ── */}
          <Card className="mb-6 overflow-hidden border-border">
            {outreachBlocked && (
              <div className="flex items-center gap-2 bg-destructive/10 border-b border-destructive/20 px-5 py-2.5">
                <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-[11px] text-destructive font-medium">
                  {owner!.owner_name} has an active {stageLabels[currentStage].toLowerCase()} on this account — do not reach out.
                </p>
              </div>
            )}

            <div className="p-5">
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

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stage</span>
                  <select value={currentStage} onChange={e => handleStageChange(e.target.value as PipelineStage)} disabled={ownedBySomeoneElse} className="rounded-md border border-border bg-secondary/50 px-2.5 py-1 text-xs font-medium text-foreground disabled:opacity-60 cursor-pointer">
                    {stages.map(s => <option key={s} value={s}>{stageLabels[s]}</option>)}
                  </select>
                </div>

                <div className="h-5 w-px bg-border" />

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Owner</span>
                  {ownerLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : !isClaimed ? (
                    <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1 border-dashed border-primary/40 text-primary hover:bg-primary/10 px-2" onClick={claimAccount} disabled={ownerActing}>
                      {ownerActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />} Claim Account
                    </Button>
                  ) : isMyAccount ? (
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20 py-0.5"><UserCheck className="h-2.5 w-2.5" /> My Account</Badge>
                      <button onClick={releaseAccount} disabled={ownerActing} className="rounded p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Release ownership">
                        {ownerActing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5" />}
                      </button>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-muted text-muted-foreground py-0.5"><UserCheck className="h-2.5 w-2.5" /> {owner!.owner_name}</Badge>
                  )}
                </div>

                <div className="h-5 w-px bg-border" />

                <div className="flex items-center gap-2">
                  <EmailComposer tenantId={prospectId!} buildingId="" tenantName={prospect.name} contactName={primaryContact?.name || prospect.name} contactEmail={primaryContact?.email} buildingName={prospect.address} recipients={recipients} />
                  {primaryContact?.email && (
                    <a href={`mailto:${primaryContact.email}`}>
                      <Button size="sm" variant="ghost" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"><Mail className="h-3.5 w-3.5" /> Email</Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* ── MAIN CONTENT ── */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start bg-secondary/30 border border-border rounded-lg p-1 mb-6">
              <TabsTrigger value="overview" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Building2 className="h-3 w-3" /> Overview
              </TabsTrigger>
              <TabsTrigger value="outreach" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Sparkles className="h-3 w-3" /> Outreach
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <Clock className="h-3 w-3" /> Activity
              </TabsTrigger>
              <TabsTrigger value="files" className="text-xs gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-sm">
                <FileText className="h-3 w-3" /> Files
              </TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW TAB ── */}
            <TabsContent value="overview" className="mt-0">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                  {/* Contacts */}
                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Phone className="h-3 w-3" /> Contacts
                    </h2>
                    <CompanyContacts entityId={prospectId!} onContactsChange={() => {}} />
                  </section>

                  {/* Company Intel */}
                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <FileSearch className="h-3 w-3" /> Company Intel
                    </h2>
                    <ProspectEnrichmentCard prospectId={prospectId!} companyName={prospect.name} website={prospect.website} address={prospect.address} cachedEnrichment={prospect.enrichment} onEnriched={handleEnriched} />
                  </section>
                </div>

                {/* Sidebar — Meeting Prep + Research Brief */}
                <div className="space-y-4">
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
                          <MeetingPrepBrief tenantName={prospect.name} industry={prospect.enrichment?.industry || ''} sqft={0} headcount={0} leaseExpiration="" floor="" contactName={primaryContact?.name || prospect.name} contactTitle={primaryContact?.title || ''} contactEmail={primaryContact?.email || ''} buildingName={prospect.address} buildingClass="" buildingFloors={0} buildingYearBuilt={0} vacancyRate={0} owner="" outreachReasons={[]} submarketNews={[]} scoopIntel={[]} />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>

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
            </TabsContent>

            {/* ── OUTREACH TAB ── */}
            <TabsContent value="outreach" className="mt-0">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-5">
                  {/* Custom Outreach */}
                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3" /> Custom Outreach
                    </h2>
                    {customReasonOpen ? (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                        <textarea value={customReasonText} onChange={e => setCustomReasonText(e.target.value)} placeholder="Type your reason to reach out to this prospect..." className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" rows={3} autoFocus />
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="text-xs h-7" disabled={!customReasonText.trim() || !!generatingKey} onClick={generateCustomEmail}><Send className="mr-1 h-3 w-3" /> Generate Email</Button>
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
                            const urgencyColors = { high: 'bg-destructive/10 text-destructive border-destructive/20', medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20', low: 'bg-muted text-muted-foreground border-border' };
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
                </div>

                {/* Real-Time News in outreach sidebar */}
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Newspaper className="h-3 w-3" /> Real-Time News
                  </h2>
                  <CompanyNewsCard
                    companyId={prospectId!}
                    companyName={prospect.name}
                    onNewsLoaded={handleNewsLoaded}
                    onOutreachTrigger={(title, summary) => { setCustomReasonText(`${title} — ${summary}`); setCustomReasonOpen(true); }}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── ACTIVITY TAB ── */}
            <TabsContent value="activity" className="mt-0">
              <ActivityLog tenantId={prospectId!} buildingId="" outreachReasonTitles={[]} />
            </TabsContent>

            {/* ── FILES TAB ── */}
            <TabsContent value="files" className="mt-0">
              <div className="max-w-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> Documents
                  </h2>
                  <div>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif" />
                    <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Upload File
                    </Button>
                  </div>
                </div>

                {filesLoading ? (
                  <Card className="border-border p-8 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </Card>
                ) : files.length === 0 ? (
                  <Card className="border-border border-dashed p-10 text-center">
                    <File className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">No files uploaded yet</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">Upload leases, proposals, contracts, or any other documents</p>
                    <Button size="sm" variant="outline" className="mt-4 text-xs h-8 gap-1.5" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-3.5 w-3.5" /> Upload Your First File
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {files.map(file => (
                      <Card key={file.id} className="border-border p-3 flex items-center gap-3 group hover:border-primary/20 transition-colors">
                        <span className="text-lg">{getFileIcon(file.file_type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{file.file_name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span>{formatFileSize(file.file_size)}</span>
                            <span>·</span>
                            <span>{file.uploaded_by_name}</span>
                            <span>·</span>
                            <span>{new Date(file.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleDownloadFile(file)} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title="Download">
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          {file.uploaded_by === user?.id && (
                            <button onClick={() => handleDeleteFile(file)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default CustomProspectDetail;

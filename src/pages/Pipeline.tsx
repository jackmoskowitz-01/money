import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, AlertTriangle, Check } from 'lucide-react';
import { buildings } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import {
  stageLabels, stageColors, generateTouchpoints,
  type PipelineStage, type PipelineItem, type Touchpoint,
} from '@/data/pipelineData';
import { usePipeline } from '@/hooks/usePipeline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { PipelineStats } from '@/components/pipeline/PipelineStats';
import { StageColumn } from '@/components/pipeline/StageColumn';
import { MobileDealCard } from '@/components/pipeline/DealCard';
import { TouchpointsPanel } from '@/components/pipeline/TouchpointsPanel';
import { OutcomeDialog } from '@/components/pipeline/OutcomeDialog';

const stages: PipelineStage[] = ['hot_prospect', 'meeting_set', 'meeting_held', 'moving_forward', 'won', 'closed', 'lost'];
const OUTREACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-outreach`;

const Pipeline = () => {
  const { pipeline, loading, updateStage, addNote, addProspect, markTouchpointSent, deleteDeal, reorderInStage } = usePipeline();
  const [noteInput, setNoteInput] = useState('');
  const [noteTarget, setNoteTarget] = useState<{ tenantId: string; buildingId: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newProspect, setNewProspect] = useState({ name: '', company: '', email: '', phone: '', sqft: '' });

  const [outcomeDialog, setOutcomeDialog] = useState<{ tenantId: string; buildingId: string; stage: PipelineStage } | null>(null);
  const [outcomeReason, setOutcomeReason] = useState('');

  const [dragItem, setDragItem] = useState<PipelineItem | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [emailTouchpoint, setEmailTouchpoint] = useState<Touchpoint | null>(null);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [copied, setCopied] = useState(false);

  // Overdue touchpoints
  const now = new Date().toISOString();
  const overdue = pipeline.flatMap(item =>
    (item.sentTouchpoints || [])
      .filter(tp => tp.followUpDate && tp.followUpDate < now)
      .map(touchpoint => ({ item, touchpoint }))
  );

  const getTenantInfo = (tenantId: string, buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    const tenant = building?.tenants.find(t => t.id === tenantId);
    return { tenant, building };
  };

  const getDisplayName = (item: PipelineItem) => {
    if (item.isManual) return item.prospectName || 'Unknown';
    const { tenant } = getTenantInfo(item.tenantId, item.buildingId);
    return tenant?.name || 'Unknown';
  };

  const getDisplayCompany = (item: PipelineItem) => {
    if (item.isManual) return item.prospectCompany || '';
    const { building } = getTenantInfo(item.tenantId, item.buildingId);
    return building?.name || '';
  };

  const getDisplayDetail = (item: PipelineItem) => {
    if (item.isManual) {
      const parts: string[] = [];
      if (item.prospectSqft) parts.push(`${item.prospectSqft.toLocaleString()} SF`);
      if (item.prospectEmail) parts.push(item.prospectEmail);
      return parts.join(' · ') || 'No details';
    }
    const { tenant } = getTenantInfo(item.tenantId, item.buildingId);
    if (!tenant) return '';
    return `${tenant.sqft.toLocaleString()} SF · Expires ${tenant.leaseExpiration}`;
  };

  const handleStageChange = async (tenantId: string, buildingId: string, newStage: PipelineStage) => {
    if (newStage === 'won' || newStage === 'lost') {
      setOutcomeDialog({ tenantId, buildingId, stage: newStage });
      return;
    }
    await updateStage(tenantId, buildingId, newStage);
    if (selectedItem?.tenantId === tenantId && selectedItem?.buildingId === buildingId) {
      setSelectedItem({ ...selectedItem, stage: newStage });
    }
  };

  const handleOutcomeConfirm = async () => {
    if (!outcomeDialog) return;
    const { tenantId, buildingId, stage } = outcomeDialog;
    await updateStage(tenantId, buildingId, stage);
    await supabase
      .from('pipeline_deals')
      .update({
        outcome: stage === 'won' ? 'won' : 'lost',
        outcome_reason: outcomeReason.trim(),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('tenant_id', tenantId)
      .eq('building_id', buildingId);
    if (selectedItem?.tenantId === tenantId && selectedItem?.buildingId === buildingId) {
      setSelectedItem({ ...selectedItem, stage });
    }
    setOutcomeDialog(null);
    setOutcomeReason('');
  };

  const handleAddNote = async () => {
    if (!noteTarget || !noteInput.trim()) return;
    await addNote(noteTarget.tenantId, noteTarget.buildingId, noteInput.trim());
    setNoteInput('');
    setNoteTarget(null);
  };

  const handleAddProspect = async () => {
    if (!newProspect.name.trim()) return;
    const success = await addProspect(newProspect);
    if (success) {
      setNewProspect({ name: '', company: '', email: '', phone: '', sqft: '' });
      setAddOpen(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, item: PipelineItem) => {
    setDragItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  };

  const handleCardDragOver = (e: React.DragEvent, stage: PipelineStage, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    setDragOverStage(null);
    setDragOverIndex(null);
    if (!dragItem) return;

    if (dragItem.stage === stage && dragOverIndex !== null) {
      const stageItems = itemsByStage(stage);
      const fromIndex = stageItems.findIndex(
        i => i.tenantId === dragItem.tenantId && i.buildingId === dragItem.buildingId
      );
      if (fromIndex !== -1 && fromIndex !== dragOverIndex) {
        await reorderInStage(stage, fromIndex, dragOverIndex);
      }
    } else if (dragItem.stage !== stage) {
      await handleStageChange(dragItem.tenantId, dragItem.buildingId, stage);
    }
    setDragItem(null);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverStage(null);
    setDragOverIndex(null);
  };

  const generateTouchpointEmail = useCallback(async (tp: Touchpoint, item: PipelineItem) => {
    setEmailTouchpoint(tp);
    setGeneratingEmail(true);
    setGeneratedEmail('');
    setCopied(false);

    const name = getDisplayName(item);
    const company = getDisplayCompany(item);

    let tenantName = name;
    let buildingName = company;
    let contactName = item.isManual ? name : '';
    let contactTitle = '';
    let industry = '';
    let sqft = item.prospectSqft || 0;
    let leaseExpiration = '';
    let vacancyRate = 0;
    let headcount = 0;
    let clientsInBuilding: string[] = [];

    if (!item.isManual) {
      const { tenant, building } = getTenantInfo(item.tenantId, item.buildingId);
      if (tenant && building) {
        tenantName = tenant.name;
        buildingName = building.name;
        contactName = tenant.contactName;
        contactTitle = tenant.contactTitle;
        industry = tenant.industry;
        sqft = tenant.sqft;
        leaseExpiration = tenant.leaseExpiration;
        vacancyRate = building.vacancyRate;
        headcount = tenant.headcount;
        clientsInBuilding = building.tenants
          .filter(t => t.isClient && t.id !== tenant.id)
          .map(t => t.name);
      }
    }

    try {
      const resp = await fetch(OUTREACH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          tenantName, buildingName, contactName, contactTitle, industry, sqft,
          leaseExpiration, outreachReason: `Touchpoint: ${tp.title} — ${tp.description}`,
          vacancyRate, headcount, clientsInBuilding,
        }),
      });

      if (!resp.ok) { setGeneratingEmail(false); return; }

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
            if (content) { full += content; setGeneratedEmail(full); }
          } catch { /* partial */ }
        }
      }
    } catch { /* error */ }
    setGeneratingEmail(false);
  }, []);

  const handleMarkSent = async (tp: Touchpoint) => {
    if (!selectedItem) return;
    await markTouchpointSent(selectedItem.tenantId, selectedItem.buildingId, tp);
    setSelectedItem(prev => {
      if (!prev) return null;
      const sent: Touchpoint = { ...tp, sentAt: new Date().toISOString(), followUpDate: new Date(Date.now() + 7 * 86400000).toISOString() };
      return { ...prev, sentTouchpoints: [...(prev.sentTouchpoints || []), sent] };
    });
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(generatedEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteDeal = async (item: PipelineItem, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDeal(item.tenantId, item.buildingId);
    if (selectedItem?.tenantId === item.tenantId && selectedItem?.buildingId === item.buildingId) {
      setSelectedItem(null);
    }
  };

  const itemsByStage = (stage: PipelineStage) =>
    pipeline.filter(p => p.stage === stage).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const touchpoints = selectedItem ? generateTouchpoints(selectedItem) : [];
  const sentTouchpointIds = new Set((selectedItem?.sentTouchpoints || []).map(t => t.id));

  if (loading) {
    return (
      <div className="min-h-screen pt-12">
        <div className="mx-auto max-w-[1600px] px-4 py-8">
          <Skeleton className="h-10 w-48 mb-6" />
          <div className="flex gap-4">
            {stages.map(s => (
              <div key={s} className="min-w-[220px] flex-1 space-y-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-12">
      <div className="mx-auto max-w-[1600px] px-2 sm:px-4 py-4 sm:py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pipeline</h1>
              <p className="mt-1 text-sm text-muted-foreground">Track your outreach across all prospects — drag cards between stages</p>
            </div>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 w-full sm:w-auto">
                  <UserPlus className="h-4 w-4" /> Add Prospect
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Add New Prospect</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Contact Name *</label>
                    <Input placeholder="e.g. John Smith" value={newProspect.name} onChange={e => setNewProspect(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Company</label>
                    <Input placeholder="e.g. Acme Corp" value={newProspect.company} onChange={e => setNewProspect(p => ({ ...p, company: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Email</label>
                      <Input type="email" placeholder="john@acme.com" value={newProspect.email} onChange={e => setNewProspect(p => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Phone</label>
                      <Input placeholder="(202) 555-0100" value={newProspect.phone} onChange={e => setNewProspect(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Size Requirement (SF)</label>
                    <Input type="number" placeholder="50000" value={newProspect.sqft} onChange={e => setNewProspect(p => ({ ...p, sqft: e.target.value }))} />
                  </div>
                  <Button onClick={handleAddProspect} className="w-full" disabled={!newProspect.name.trim()}>
                    Add to Pipeline
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Overdue Follow-ups Banner */}
          {overdue.length > 0 && (
            <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm font-semibold text-foreground">
                  {overdue.length} Overdue Follow-up{overdue.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-1">
                {overdue.slice(0, 3).map(({ item, touchpoint }, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{getDisplayName(item)}</span>
                    {' — '}{touchpoint.title} (sent {new Date(touchpoint.sentAt!).toLocaleDateString()})
                  </p>
                ))}
                {overdue.length > 3 && <p className="text-xs text-muted-foreground">+ {overdue.length - 3} more</p>}
              </div>
            </div>
          )}

          <PipelineStats pipeline={pipeline} />

          {/* Mobile: stacked list view */}
          <div className="block md:hidden space-y-4">
            {stages.map(stage => {
              const items = itemsByStage(stage);
              if (items.length === 0) return null;
              return (
                <div key={stage}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={`${stageColors[stage]} text-xs`}>
                      {stageLabels[stage]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map(item => {
                      if (!item.isManual) {
                        const { tenant, building } = getTenantInfo(item.tenantId, item.buildingId);
                        if (!tenant || !building) return null;
                      }
                      return (
                        <MobileDealCard
                          key={`m-${item.tenantId}-${item.buildingId}`}
                          item={item}
                          stages={stages}
                          getDisplayName={getDisplayName}
                          getDisplayCompany={getDisplayCompany}
                          getDisplayDetail={getDisplayDetail}
                          onSelect={setSelectedItem}
                          onStageChange={handleStageChange}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: kanban board */}
          <div className="hidden md:flex gap-4">
            <div className={`flex gap-2 sm:gap-4 overflow-x-auto pb-4 transition-all ${selectedItem ? 'flex-1' : 'w-full'}`}>
              {stages.map(stage => (
                <StageColumn
                  key={stage}
                  stage={stage}
                  items={itemsByStage(stage)}
                  stages={stages}
                  selectedItem={selectedItem}
                  dragItem={dragItem}
                  dragOverStage={dragOverStage}
                  dragOverIndex={dragOverIndex}
                  noteInput={noteInput}
                  onNoteInputChange={setNoteInput}
                  onNoteSubmit={handleAddNote}
                  onNoteTargetSet={setNoteTarget}
                  onSelect={setSelectedItem}
                  onStageChange={handleStageChange}
                  onDelete={handleDeleteDeal}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onCardDragOver={handleCardDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  getDisplayName={getDisplayName}
                  getDisplayCompany={getDisplayCompany}
                  getDisplayDetail={getDisplayDetail}
                />
              ))}
            </div>

            {/* Touchpoints Panel */}
            <AnimatePresence>
              {selectedItem && (
                <TouchpointsPanel
                  selectedItem={selectedItem}
                  touchpoints={touchpoints}
                  sentTouchpointIds={sentTouchpointIds}
                  emailTouchpoint={emailTouchpoint}
                  generatingEmail={generatingEmail}
                  generatedEmail={generatedEmail}
                  copied={copied}
                  onClose={() => { setSelectedItem(null); setEmailTouchpoint(null); setGeneratedEmail(''); }}
                  onGenerateEmail={generateTouchpointEmail}
                  onMarkSent={handleMarkSent}
                  onCopyEmail={handleCopyEmail}
                  onClearEmail={() => { setEmailTouchpoint(null); setGeneratedEmail(''); }}
                />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      <OutcomeDialog
        outcomeDialog={outcomeDialog}
        outcomeReason={outcomeReason}
        onReasonChange={setOutcomeReason}
        onConfirm={handleOutcomeConfirm}
        onClose={() => { setOutcomeDialog(null); setOutcomeReason(''); }}
      />
    </div>
  );
};

export default Pipeline;

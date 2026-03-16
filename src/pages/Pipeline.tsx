import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GripVertical, Plus, StickyNote, ChevronRight, X, UserPlus,
  Mail, Phone, Building2, MessageSquare, Sparkles, Send,
  Check, Clock, Loader2, Copy, AlertTriangle, Trash2,
  BarChart3, Users, Ruler, TrendingUp,
} from 'lucide-react';
import { buildings } from '@/data/mockData';
import {
  stageLabels, stageColors, generateTouchpoints, touchpointLabels,
  type PipelineStage, type PipelineItem, type Touchpoint,
} from '@/data/pipelineData';
import { usePipeline } from '@/hooks/usePipeline';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const stages: PipelineStage[] = ['hot_prospect', 'meeting_set', 'meeting_held', 'moving_forward', 'won', 'closed', 'lost'];

const OUTREACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-outreach`;

const touchpointIcons: Record<Touchpoint['type'], typeof Mail> = {
  market_update: Sparkles,
  lease_comp: Building2,
  space_available: Building2,
  building_news: Building2,
  check_in: MessageSquare,
  intro_colleague: UserPlus,
  event_invite: Send,
};

const Pipeline = () => {
  const { pipeline, loading, updateStage, addNote, addProspect, markTouchpointSent, deleteDeal, reorderInStage } = usePipeline();
  const [noteInput, setNoteInput] = useState('');
  const [noteTarget, setNoteTarget] = useState<{ tenantId: string; buildingId: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newProspect, setNewProspect] = useState({
    name: '', company: '', email: '', phone: '', sqft: '',
  });

  // Drag-and-drop state
  const [dragItem, setDragItem] = useState<PipelineItem | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Email generation state
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
    await updateStage(tenantId, buildingId, newStage);
    if (selectedItem?.tenantId === tenantId && selectedItem?.buildingId === buildingId) {
      setSelectedItem({ ...selectedItem, stage: newStage });
    }
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

  // Drag-and-drop handlers
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
      // Reorder within same column
      const stageItems = itemsByStage(stage);
      const fromIndex = stageItems.findIndex(
        i => i.tenantId === dragItem.tenantId && i.buildingId === dragItem.buildingId
      );
      if (fromIndex !== -1 && fromIndex !== dragOverIndex) {
        await reorderInStage(stage, fromIndex, dragOverIndex);
      }
    } else if (dragItem.stage !== stage) {
      // Move to different column
      await handleStageChange(dragItem.tenantId, dragItem.buildingId, stage);
    }
    setDragItem(null);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverStage(null);
    setDragOverIndex(null);
  };

  // Email generation for touchpoint
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
    // Refresh selected item from pipeline state
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
      <div className="min-h-screen pt-14">
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
    <div className="min-h-screen pt-14">
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
                      const sentCount = (item.sentTouchpoints || []).length;
                      return (
                        <Card
                          key={`m-${item.tenantId}-${item.buildingId}`}
                          className="border-border bg-card p-3"
                          onClick={() => setSelectedItem(item)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold text-foreground">{getDisplayName(item)}</p>
                            <select
                              value={item.stage}
                              onChange={e => { e.stopPropagation(); handleStageChange(item.tenantId, item.buildingId, e.target.value as PipelineStage); }}
                              className="rounded-sm border border-border bg-secondary/50 px-1.5 py-0.5 text-[10px] text-foreground"
                              onClick={e => e.stopPropagation()}
                            >
                              {stages.map(s => <option key={s} value={s}>{stageLabels[s]}</option>)}
                            </select>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{getDisplayCompany(item)}</p>
                          <p className="text-[11px] text-muted-foreground">{getDisplayDetail(item)}</p>
                          {sentCount > 0 && (
                            <div className="mt-1.5 flex items-center gap-1">
                              <Check className="h-3 w-3 text-primary" />
                              <span className="text-[10px] text-primary">{sentCount} touchpoint{sentCount > 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </Card>
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
                <div
                  key={stage}
                  className={`min-w-[180px] sm:min-w-[220px] flex-1 rounded-lg p-1.5 sm:p-2 transition-colors ${dragOverStage === stage ? 'bg-primary/5 ring-2 ring-primary/20' : ''}`}
                  onDragOver={e => handleDragOver(e, stage)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, stage)}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${stageColors[stage]} text-xs`}>
                        {stageLabels[stage]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{itemsByStage(stage).length}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {itemsByStage(stage).map((item, idx) => {
                      if (!item.isManual) {
                        const { tenant, building } = getTenantInfo(item.tenantId, item.buildingId);
                        if (!tenant || !building) return null;
                      }

                      const isSelected = selectedItem?.tenantId === item.tenantId && selectedItem?.buildingId === item.buildingId;
                      const isDragging = dragItem?.tenantId === item.tenantId && dragItem?.buildingId === item.buildingId;
                      const sentCount = (item.sentTouchpoints || []).length;
                      const isDropTarget = dragOverStage === stage && dragOverIndex === idx && dragItem && !(dragItem.tenantId === item.tenantId && dragItem.buildingId === item.buildingId);

                      return (
                        <Card
                          key={`${item.tenantId}-${item.buildingId}`}
                          draggable
                          onDragStart={e => handleDragStart(e, item)}
                          onDragOver={e => handleCardDragOver(e, stage, idx)}
                          onDragEnd={handleDragEnd}
                          className={`cursor-grab active:cursor-grabbing border-border bg-card p-3 transition-all hover:border-primary/30 ${isSelected ? 'border-primary ring-1 ring-primary/20' : ''} ${isDragging ? 'opacity-50 scale-95' : ''} ${isDropTarget ? 'border-t-2 border-t-primary' : ''}`}
                          onClick={() => setSelectedItem(isSelected ? null : item)}
                        >
                          <div className="mb-2 flex items-start justify-between">
                            <p className="text-sm font-semibold text-foreground">{getDisplayName(item)}</p>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={e => handleDeleteDeal(item, e)}
                                className="rounded p-0.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Remove from pipeline"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground">{getDisplayCompany(item)}</p>
                          <p className="text-[11px] text-muted-foreground">{getDisplayDetail(item)}</p>

                          {sentCount > 0 && (
                            <div className="mt-1.5 flex items-center gap-1">
                              <Check className="h-3 w-3 text-primary" />
                              <span className="text-[10px] text-primary">{sentCount} touchpoint{sentCount > 1 ? 's' : ''} sent</span>
                            </div>
                          )}

                          {item.notes.length > 0 && (
                            <div className="mt-2 border-t border-border pt-2">
                              <p className="text-[10px] text-muted-foreground">
                                <StickyNote className="mr-1 inline h-3 w-3" />
                                {item.notes[item.notes.length - 1]}
                              </p>
                            </div>
                          )}

                          <div className="mt-2 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <select
                              value={item.stage}
                              onChange={e => handleStageChange(item.tenantId, item.buildingId, e.target.value as PipelineStage)}
                              className="flex-1 rounded-sm border border-border bg-secondary/50 px-1.5 py-0.5 text-[10px] text-foreground"
                            >
                              {stages.map(s => (
                                <option key={s} value={s}>{stageLabels[s]}</option>
                              ))}
                            </select>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => setNoteTarget({ tenantId: item.tenantId, buildingId: item.buildingId })}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-card border-border">
                                <DialogHeader>
                                  <DialogTitle className="text-foreground">Add Note — {getDisplayName(item)}</DialogTitle>
                                </DialogHeader>
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Add a note..."
                                    value={noteInput}
                                    onChange={e => setNoteInput(e.target.value)}
                                    className="border-border bg-secondary/50 text-foreground"
                                    onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                                  />
                                  <Button onClick={handleAddNote} className="bg-primary text-primary-foreground">Add</Button>
                                </div>
                                {item.notes.length > 0 && (
                                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                                    {item.notes.map((n, i) => (
                                      <p key={i} className="text-xs text-muted-foreground">• {n}</p>
                                    ))}
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>

                            {!item.isManual && (
                              <Link to={`/building/${item.buildingId}/tenant/${item.tenantId}`}>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <ChevronRight className="h-3 w-3" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Touchpoints Panel */}
            <AnimatePresence>
              {selectedItem && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 400, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25 }}
                  className="shrink-0 overflow-hidden hidden lg:block"
                >
                  <Card className="sticky top-20 border-border bg-card p-4">
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <h3 className="font-display text-lg font-bold text-foreground">{getDisplayName(selectedItem)}</h3>
                        <p className="text-xs text-muted-foreground">{getDisplayCompany(selectedItem)}</p>
                        <Badge variant="outline" className={`mt-1.5 ${stageColors[selectedItem.stage]} text-[10px]`}>
                          {stageLabels[selectedItem.stage]}
                        </Badge>
                      </div>
                      <button onClick={() => { setSelectedItem(null); setEmailTouchpoint(null); setGeneratedEmail(''); }} className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Contact info for manual prospects */}
                    {selectedItem.isManual && (selectedItem.prospectEmail || selectedItem.prospectPhone) && (
                      <div className="mb-4 space-y-1.5 rounded-md border border-border bg-secondary/30 p-3">
                        {selectedItem.prospectEmail && (
                          <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" /> {selectedItem.prospectEmail}
                          </p>
                        )}
                        {selectedItem.prospectPhone && (
                          <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" /> {selectedItem.prospectPhone}
                          </p>
                        )}
                        {selectedItem.prospectSqft && (
                          <p className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" /> {selectedItem.prospectSqft.toLocaleString()} SF requirement
                          </p>
                        )}
                      </div>
                    )}

                    {/* Email Draft Panel */}
                    <AnimatePresence>
                      {emailTouchpoint && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mb-4 overflow-hidden"
                        >
                          <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-semibold text-foreground">
                                {generatingEmail ? 'Generating email...' : 'Draft Email'}
                              </p>
                              <div className="flex items-center gap-1">
                                {!generatingEmail && generatedEmail && (
                                  <>
                                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={handleCopyEmail}>
                                      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                                      {copied ? 'Copied' : 'Copy'}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[10px] text-primary"
                                      onClick={() => {
                                        handleMarkSent(emailTouchpoint);
                                        setEmailTouchpoint(null);
                                        setGeneratedEmail('');
                                      }}
                                    >
                                      <Check className="h-3 w-3 mr-1" /> Mark Sent
                                    </Button>
                                  </>
                                )}
                                <button onClick={() => { setEmailTouchpoint(null); setGeneratedEmail(''); }} className="rounded p-0.5 hover:bg-secondary">
                                  <X className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </div>
                            </div>
                            {generatingEmail && !generatedEmail && (
                              <div className="flex items-center gap-2 py-4 justify-center">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span className="text-xs text-muted-foreground">Drafting your email...</span>
                              </div>
                            )}
                            {generatedEmail && (
                              <div className="max-h-60 overflow-y-auto rounded bg-background p-2.5">
                                <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{generatedEmail}</p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Suggested Touchpoints
                    </h4>
                    <p className="mb-3 text-[11px] text-muted-foreground">
                      Warm follow-up ideas based on pipeline stage. Click to generate an email draft.
                    </p>

                    <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                      {touchpoints.map(tp => {
                        const Icon = touchpointIcons[tp.type];
                        const isSent = sentTouchpointIds.has(tp.id);
                        const isActive = emailTouchpoint?.id === tp.id;
                        return (
                          <div
                            key={tp.id}
                            className={`group cursor-pointer rounded-md border p-3 transition-all ${
                              isSent
                                ? 'border-primary/20 bg-primary/5 opacity-70'
                                : isActive
                                ? 'border-primary bg-primary/10'
                                : 'border-border bg-secondary/20 hover:border-primary/30 hover:bg-secondary/50'
                            }`}
                            onClick={() => {
                              if (!isSent) generateTouchpointEmail(tp, selectedItem);
                            }}
                          >
                            <div className="mb-1.5 flex items-center gap-2">
                              <div className={`flex h-6 w-6 items-center justify-center rounded-md ${isSent ? 'bg-primary/20' : 'bg-primary/10'}`}>
                                {isSent ? <Check className="h-3.5 w-3.5 text-primary" /> : <Icon className="h-3.5 w-3.5 text-primary" />}
                              </div>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                                {touchpointLabels[tp.type]}
                              </Badge>
                              {isSent && (
                                <Badge variant="outline" className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">
                                  Sent
                                </Badge>
                              )}
                              {tp.suggested && !isSent && (
                                <Badge variant="outline" className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">
                                  Suggested
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium text-foreground">{tp.title}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{tp.description}</p>
                            {isSent && (
                              <p className="mt-1 text-[10px] text-primary/70">
                                <Clock className="inline h-3 w-3 mr-0.5" />
                                Sent {new Date((selectedItem.sentTouchpoints || []).find(s => s.id === tp.id)?.sentAt || '').toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Sent touchpoints history */}
                    {(selectedItem.sentTouchpoints || []).length > 0 && (
                      <div className="mt-4 border-t border-border pt-3">
                        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">TOUCHPOINT HISTORY</h4>
                        <div className="space-y-1">
                          {(selectedItem.sentTouchpoints || []).map((tp, i) => (
                            <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <Check className="h-3 w-3 text-primary shrink-0" />
                              <span className="flex-1">{tp.title}</span>
                              <span className="text-[10px] shrink-0">{new Date(tp.sentAt!).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes section */}
                    {selectedItem.notes.length > 0 && (
                      <div className="mt-4 border-t border-border pt-3">
                        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">NOTES</h4>
                        <div className="space-y-1">
                          {selectedItem.notes.map((n, i) => (
                            <p key={i} className="text-[11px] text-muted-foreground">• {n}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Pipeline;

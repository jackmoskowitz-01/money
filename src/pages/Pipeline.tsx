import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GripVertical, Plus, StickyNote, ChevronRight, X, UserPlus,
  Mail, Phone, Building2, MessageSquare, Sparkles, Send,
} from 'lucide-react';
import { buildings } from '@/data/mockData';
import {
  getPipeline, savePipeline, updatePipelineStage, addPipelineNote,
  stageLabels, stageColors, generateTouchpoints, touchpointLabels,
  type PipelineStage, type PipelineItem, type Touchpoint,
} from '@/data/pipelineData';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const stages: PipelineStage[] = ['meeting_set', 'meeting_held', 'moving_forward', 'won', 'closed', 'lost'];

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
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [noteTarget, setNoteTarget] = useState<{ tenantId: string; buildingId: string } | null>(null);
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newProspect, setNewProspect] = useState({
    name: '', company: '', email: '', phone: '', sqft: '',
  });

  useEffect(() => {
    let items = getPipeline();
    const allTenants = buildings.flatMap(b => b.tenants.map(t => ({ tenantId: t.id, buildingId: b.id })));
    let changed = false;
    allTenants.forEach(({ tenantId, buildingId }) => {
      if (!items.find(p => p.tenantId === tenantId && p.buildingId === buildingId)) {
        items.push({ tenantId, buildingId, stage: 'meeting_set', notes: [], lastActivity: new Date().toISOString() });
        changed = true;
      }
    });
    if (changed) savePipeline(items);
    setPipeline(items);
  }, []);

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

  const handleStageChange = (tenantId: string, buildingId: string, newStage: PipelineStage) => {
    updatePipelineStage(tenantId, buildingId, newStage);
    setPipeline(getPipeline());
    if (selectedItem?.tenantId === tenantId && selectedItem?.buildingId === buildingId) {
      setSelectedItem({ ...selectedItem, stage: newStage });
    }
  };

  const handleAddNote = () => {
    if (!noteTarget || !noteInput.trim()) return;
    addPipelineNote(noteTarget.tenantId, noteTarget.buildingId, noteInput.trim());
    setPipeline(getPipeline());
    setNoteInput('');
    setNoteTarget(null);
  };

  const handleAddProspect = () => {
    if (!newProspect.name.trim()) return;
    const id = `manual-${Date.now()}`;
    const item: PipelineItem = {
      tenantId: id,
      buildingId: 'manual',
      stage: 'meeting_set',
      notes: [],
      lastActivity: new Date().toISOString(),
      isManual: true,
      prospectName: newProspect.name.trim(),
      prospectCompany: newProspect.company.trim(),
      prospectEmail: newProspect.email.trim(),
      prospectPhone: newProspect.phone.trim(),
      prospectSqft: newProspect.sqft ? parseInt(newProspect.sqft) : undefined,
    };
    const items = [...getPipeline(), item];
    savePipeline(items);
    setPipeline(items);
    setNewProspect({ name: '', company: '', email: '', phone: '', sqft: '' });
    setAddOpen(false);
  };

  const itemsByStage = (stage: PipelineStage) => pipeline.filter(p => p.stage === stage);

  const touchpoints = selectedItem ? generateTouchpoints(selectedItem) : [];

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-[1600px] px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
              <p className="mt-1 text-muted-foreground">Track your outreach across all prospects</p>
            </div>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
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
                    <Input
                      placeholder="e.g. John Smith"
                      value={newProspect.name}
                      onChange={e => setNewProspect(p => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Company</label>
                    <Input
                      placeholder="e.g. Acme Corp"
                      value={newProspect.company}
                      onChange={e => setNewProspect(p => ({ ...p, company: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Email</label>
                      <Input
                        type="email"
                        placeholder="john@acme.com"
                        value={newProspect.email}
                        onChange={e => setNewProspect(p => ({ ...p, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Phone</label>
                      <Input
                        placeholder="(202) 555-0100"
                        value={newProspect.phone}
                        onChange={e => setNewProspect(p => ({ ...p, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Size Requirement (SF)</label>
                    <Input
                      type="number"
                      placeholder="50000"
                      value={newProspect.sqft}
                      onChange={e => setNewProspect(p => ({ ...p, sqft: e.target.value }))}
                    />
                  </div>
                  <Button onClick={handleAddProspect} className="w-full" disabled={!newProspect.name.trim()}>
                    Add to Pipeline
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex gap-4">
            {/* Kanban Board */}
            <div className={`flex gap-4 overflow-x-auto pb-4 transition-all ${selectedItem ? 'flex-1' : 'w-full'}`}>
              {stages.map(stage => (
                <div key={stage} className="min-w-[220px] flex-1">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${stageColors[stage]} text-xs`}>
                        {stageLabels[stage]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{itemsByStage(stage).length}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {itemsByStage(stage).map(item => {
                      if (!item.isManual) {
                        const { tenant, building } = getTenantInfo(item.tenantId, item.buildingId);
                        if (!tenant || !building) return null;
                      }

                      const isSelected = selectedItem?.tenantId === item.tenantId && selectedItem?.buildingId === item.buildingId;

                      return (
                        <Card
                          key={`${item.tenantId}-${item.buildingId}`}
                          className={`cursor-pointer border-border bg-card p-3 transition-all hover:border-primary/30 ${isSelected ? 'border-primary ring-1 ring-primary/20' : ''}`}
                          onClick={() => setSelectedItem(isSelected ? null : item)}
                        >
                          <div className="mb-2 flex items-start justify-between">
                            <p className="text-sm font-semibold text-foreground">{getDisplayName(item)}</p>
                            <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                          </div>
                          <p className="text-[11px] text-muted-foreground">{getDisplayCompany(item)}</p>
                          <p className="text-[11px] text-muted-foreground">{getDisplayDetail(item)}</p>

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
                                  <Button onClick={handleAddNote} className="bg-primary text-primary-foreground">
                                    Add
                                  </Button>
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
                  animate={{ width: 380, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25 }}
                  className="shrink-0 overflow-hidden"
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
                      <button onClick={() => setSelectedItem(null)} className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
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

                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Suggested Touchpoints
                    </h4>
                    <p className="mb-3 text-[11px] text-muted-foreground">
                      Warm follow-up ideas based on where they are in the pipeline. Click to draft a message.
                    </p>

                    <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                      {touchpoints.map(tp => {
                        const Icon = touchpointIcons[tp.type];
                        return (
                          <div
                            key={tp.id}
                            className="group cursor-pointer rounded-md border border-border bg-secondary/20 p-3 transition-all hover:border-primary/30 hover:bg-secondary/50"
                          >
                            <div className="mb-1.5 flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                                <Icon className="h-3.5 w-3.5 text-primary" />
                              </div>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                                {touchpointLabels[tp.type]}
                              </Badge>
                              {tp.suggested && (
                                <Badge variant="outline" className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">
                                  Suggested
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium text-foreground">{tp.title}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{tp.description}</p>
                          </div>
                        );
                      })}
                    </div>

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

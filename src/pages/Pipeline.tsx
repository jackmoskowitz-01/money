import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GripVertical, Plus, StickyNote, ChevronRight } from 'lucide-react';
import { buildings } from '@/data/mockData';
import {
  getPipeline, savePipeline, updatePipelineStage, addPipelineNote,
  stageLabels, stageColors,
  type PipelineStage, type PipelineItem,
} from '@/data/pipelineData';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const stages: PipelineStage[] = ['meeting_set', 'meeting_held', 'moving_forward', 'won', 'closed', 'lost'];

const Pipeline = () => {
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [noteTarget, setNoteTarget] = useState<{ tenantId: string; buildingId: string } | null>(null);

  useEffect(() => {
    // Initialize pipeline with all tenants
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

  const handleStageChange = (tenantId: string, buildingId: string, newStage: PipelineStage) => {
    updatePipelineStage(tenantId, buildingId, newStage);
    setPipeline(getPipeline());
  };

  const handleAddNote = () => {
    if (!noteTarget || !noteInput.trim()) return;
    addPipelineNote(noteTarget.tenantId, noteTarget.buildingId, noteInput.trim());
    setPipeline(getPipeline());
    setNoteInput('');
    setNoteTarget(null);
  };

  const itemsByStage = (stage: PipelineStage) => pipeline.filter(p => p.stage === stage);

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-[1600px] px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
            <p className="mt-1 text-muted-foreground">Track your outreach across all prospects</p>
          </div>

          {/* Kanban Board */}
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map(stage => (
              <div key={stage} className="min-w-[260px] flex-1">
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
                    const { tenant, building } = getTenantInfo(item.tenantId, item.buildingId);
                    if (!tenant || !building) return null;

                    return (
                      <Card key={`${item.tenantId}-${item.buildingId}`} className="border-border bg-card p-3">
                        <div className="mb-2 flex items-start justify-between">
                          <Link
                            to={`/building/${item.buildingId}/tenant/${item.tenantId}`}
                            className="text-sm font-semibold text-foreground hover:text-primary"
                          >
                            {tenant.name}
                          </Link>
                          <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                        <p className="text-[11px] text-muted-foreground">{building.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {tenant.sqft.toLocaleString()} SF · Expires {tenant.leaseExpiration}
                        </p>

                        {item.notes.length > 0 && (
                          <div className="mt-2 border-t border-border pt-2">
                            <p className="text-[10px] text-muted-foreground">
                              <StickyNote className="mr-1 inline h-3 w-3" />
                              {item.notes[item.notes.length - 1]}
                            </p>
                          </div>
                        )}

                        <div className="mt-2 flex items-center gap-1">
                          {/* Stage selector */}
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
                                <DialogTitle className="text-foreground">Add Note — {tenant.name}</DialogTitle>
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

                          <Link to={`/building/${item.buildingId}/tenant/${item.tenantId}`}>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Pipeline;

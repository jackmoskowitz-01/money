import { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Sparkles,
  LayoutGrid, List, Expand, ExternalLink, Search,
  Check, Clock, StickyNote,
  SlidersHorizontal, ChevronDown, Plus,
} from 'lucide-react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, createColumnHelper, type SortingState,
} from '@tanstack/react-table';
import { buildings } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import {
  stageLabels, stageHues, stagePillClass,
  generateTouchpoints,
  type PipelineStage, type PipelineItem, type Touchpoint,
} from '@/data/pipelineData';
import { usePipeline } from '@/hooks/usePipeline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from '@/components/ui/resizable';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PipelineStats } from '@/components/pipeline/PipelineStats';
import { StageColumn } from '@/components/pipeline/StageColumn';
import { MobileDealCard } from '@/components/pipeline/DealCard';
import { TouchpointsPanel, TouchpointsPanelContent } from '@/components/pipeline/TouchpointsPanel';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { OutcomeDialog } from '@/components/pipeline/OutcomeDialog';
import { getAuthToken } from '@/lib/getAuthToken';

const stages: PipelineStage[] = ['hot_prospect', 'meeting_set', 'meeting_held', 'moving_forward', 'won', 'closed', 'lost'];
const OUTREACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-outreach`;

type ViewMode = 'kanban' | 'list';

// ─── Deal Detail Sheet (unchanged behavior, restyled stage chip) ──────────────
interface DealDetailSheetProps {
  item: PipelineItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getDisplayName: (item: PipelineItem) => string;
  getDisplayCompany: (item: PipelineItem) => string;
  getDisplayDetail: (item: PipelineItem) => string;
}
const DealDetailSheet = ({
  item, open, onOpenChange,
  getDisplayName, getDisplayCompany, getDisplayDetail,
}: DealDetailSheetProps) => {
  if (!item) return null;
  const name = getDisplayName(item);
  const company = getDisplayCompany(item);
  const detail = getDisplayDetail(item);
  const touchpoints = generateTouchpoints(item);
  const sentTps = item.sentTouchpoints || [];
  const sentIds = new Set(sentTps.map(t => t.id));
  const detailPath = !item.isManual ? `/building/${item.buildingId}/tenant/${item.tenantId}` : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] overflow-y-auto bg-card border-border p-0">
        <div className="p-6 pb-2">
          <SheetHeader className="mb-4">
            <div className="flex items-start justify-between gap-2 pr-6">
              <div>
                <SheetTitle className="text-lg font-bold leading-snug">{name}</SheetTitle>
                {company && <p className="mt-0.5 text-sm text-muted-foreground">{company}</p>}
                <span
                  className={stagePillClass + ' mt-2'}
                  style={{ ['--stage-hue' as never]: stageHues[item.stage] }}
                >
                  {stageLabels[item.stage]}
                </span>
              </div>
            </div>
          </SheetHeader>
          {detail && (
            <div className="rounded-md border border-border bg-secondary/30 px-3 py-2.5 mb-4">
              <p className="text-xs text-muted-foreground">{detail}</p>
            </div>
          )}
          <div className="mb-4">
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Touchpoints</h4>
            {sentTps.length > 0 ? (
              <div className="space-y-1.5">
                {sentTps.slice(-3).reverse().map((tp, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-primary shrink-0" />
                    <span className="flex-1 truncate">{tp.title}</span>
                    {tp.sentAt && (
                      <span className="text-[10px] shrink-0">
                        {new Date(tp.sentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No touchpoints sent yet.</p>
            )}
          </div>
          {touchpoints.filter(t => t.suggested && !sentIds.has(t.id)).length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggested Next Steps</h4>
              <div className="space-y-1.5">
                {touchpoints.filter(t => t.suggested && !sentIds.has(t.id)).slice(0, 2).map(tp => (
                  <div key={tp.id} className="rounded-md border border-border bg-secondary/20 px-3 py-2">
                    <p className="text-xs font-medium text-foreground">{tp.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{tp.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {item.notes.length > 0 && (
            <div className="mb-4">
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</h4>
              <div className="space-y-1.5">
                {item.notes.slice(-3).map((note, i) => (
                  <div key={i} className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                    <StickyNote className="inline h-3 w-3 mr-1.5 shrink-0" />{note}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mb-6 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            Last activity: {new Date(item.lastActivity).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          {detailPath && (
            <Link to={detailPath}>
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                <ExternalLink className="h-3.5 w-3.5" /> Full Details
              </Button>
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// ─── Pipeline list-view table (mostly unchanged, stage cell restyled) ─────────
interface PipelineTableRow {
  item: PipelineItem; name: string; company: string; stage: PipelineStage;
  detail: string; sqft: number | null; leaseExp: string;
  lastActivity: string; touchpointsSent: number; notesCount: number;
}
const colHelper = createColumnHelper<PipelineTableRow>();

interface PipelineTableProps {
  pipeline: PipelineItem[];
  selectedItem: PipelineItem | null;
  onSelect: (item: PipelineItem) => void;
  onQuickView: (item: PipelineItem, e: React.MouseEvent) => void;
  getDisplayName: (item: PipelineItem) => string;
  getDisplayCompany: (item: PipelineItem) => string;
  getDisplayDetail: (item: PipelineItem) => string;
}
const PipelineTable = ({
  pipeline, selectedItem, onSelect, onQuickView,
  getDisplayName, getDisplayCompany, getDisplayDetail,
}: PipelineTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const data = useMemo<PipelineTableRow[]>(() =>
    pipeline.map(item => {
      const detail = getDisplayDetail(item);
      const sfMatch = detail.match(/([\d,]+)\s*SF/);
      const sqft = sfMatch ? parseInt(sfMatch[1].replace(/,/g, ''), 10) : (item.prospectSqft ?? null);
      const expMatch = detail.match(/Expires\s+(\S+)/);
      const leaseExp = expMatch ? expMatch[1] : '';
      return {
        item, name: getDisplayName(item), company: getDisplayCompany(item),
        stage: item.stage, detail, sqft, leaseExp,
        lastActivity: item.lastActivity,
        touchpointsSent: (item.sentTouchpoints || []).length, notesCount: item.notes.length,
      };
    }),
    [pipeline, getDisplayName, getDisplayCompany, getDisplayDetail]
  );

  const columns = useMemo(() => [
    colHelper.accessor('name', { header: 'Prospect',
      cell: info => <span className="font-medium text-foreground">{info.getValue()}</span> }),
    colHelper.accessor('company', { header: 'Company',
      cell: info => <span className="text-muted-foreground">{info.getValue()}</span> }),
    colHelper.accessor('stage', { header: 'Stage',
      cell: info => (
        <span className={stagePillClass} style={{ ['--stage-hue' as never]: stageHues[info.getValue()] }}>
          {stageLabels[info.getValue()]}
        </span>
      ) }),
    colHelper.accessor('sqft', { header: 'SF',
      cell: info => { const v = info.getValue();
        return v ? <span className="text-muted-foreground font-mono">{v.toLocaleString()}</span>
                 : <span className="text-muted-foreground/40">—</span>; } }),
    colHelper.accessor('leaseExp', { header: 'Lease Exp',
      cell: info => { const v = info.getValue();
        return v ? <span className="text-muted-foreground">{v}</span>
                 : <span className="text-muted-foreground/40">—</span>; } }),
    colHelper.accessor('lastActivity', { header: 'Last Activity',
      cell: info => <span className="text-muted-foreground">
        {new Date(info.getValue()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </span> }),
    colHelper.accessor('touchpointsSent', { header: 'Touchpoints',
      cell: info => { const v = info.getValue();
        return v > 0 ? <span className="text-primary text-xs">{v} sent</span>
                     : <span className="text-muted-foreground/40">—</span>; } }),
    colHelper.accessor('notesCount', { header: 'Notes',
      cell: info => { const v = info.getValue();
        return v > 0 ? <span className="text-xs text-muted-foreground">{v}</span>
                     : <span className="text-muted-foreground/40">—</span>; } }),
    colHelper.display({ id: 'actions', header: '',
      cell: ({ row }) => (
        <button
          onClick={e => { e.stopPropagation(); onQuickView(row.original.item, e); }}
          className="rounded p-1 text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
          title="Quick view"
        ><Expand className="h-3.5 w-3.5" /></button>
      ) }),
  ], [onQuickView]);

  const table = useReactTable({
    data, columns, state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(hg => (
            <TableRow key={hg.id} className="border-border hover:bg-transparent">
              {hg.headers.map(header => (
                <TableHead
                  key={header.id}
                  className="text-xs text-muted-foreground font-medium py-2 px-3 whitespace-nowrap"
                  onClick={header.column.getToggleSortingHandler()}
                  style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                >
                  <div className="flex items-center gap-1 select-none">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc' && <span className="text-[10px]">↑</span>}
                    {header.column.getIsSorted() === 'desc' && <span className="text-[10px]">↓</span>}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map(row => {
            const isSelected =
              selectedItem?.tenantId === row.original.item.tenantId &&
              selectedItem?.buildingId === row.original.item.buildingId;
            return (
              <TableRow key={row.id}
                className={`border-border cursor-pointer transition-colors ${
                  isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-secondary/30'}`}
                onClick={() => onSelect(row.original.item)}>
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id} className="py-2.5 px-3 text-xs">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
          {table.getRowModel().rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-xs text-muted-foreground">
                No deals in pipeline.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

// ─── Main Pipeline page ──────────────────────────────────────────────────────
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  const [sheetItem, setSheetItem] = useState<PipelineItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

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
    return getTenantInfo(item.tenantId, item.buildingId).tenant?.name || 'Unknown';
  };
  const getDisplayCompany = (item: PipelineItem) => {
    if (item.isManual) return item.prospectCompany || '';
    return getTenantInfo(item.tenantId, item.buildingId).building?.name || '';
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
      setOutcomeDialog({ tenantId, buildingId, stage: newStage }); return;
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
    await supabase.from('pipeline_deals').update({
      outcome: stage === 'won' ? 'won' : 'lost',
      outcome_reason: outcomeReason.trim(),
      updated_at: new Date().toISOString(),
    } as any).eq('tenant_id', tenantId).eq('building_id', buildingId);
    if (selectedItem?.tenantId === tenantId && selectedItem?.buildingId === buildingId) {
      setSelectedItem({ ...selectedItem, stage });
    }
    setOutcomeDialog(null); setOutcomeReason('');
  };
  const handleAddNote = async () => {
    if (!noteTarget || !noteInput.trim()) return;
    await addNote(noteTarget.tenantId, noteTarget.buildingId, noteInput.trim());
    setNoteInput(''); setNoteTarget(null);
  };
  const handleAddProspect = async () => {
    if (!newProspect.name.trim()) return;
    if (await addProspect(newProspect)) {
      setNewProspect({ name: '', company: '', email: '', phone: '', sqft: '' });
      setAddOpen(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, item: PipelineItem) => {
    setDragItem(item); e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStage(stage);
  };
  const handleCardDragOver = (e: React.DragEvent, stage: PipelineStage, index: number) => {
    e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage); setDragOverIndex(index);
  };
  const handleDragLeave = () => { setDragOverStage(null); setDragOverIndex(null); };
  const handleDrop = async (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault(); setDragOverStage(null); setDragOverIndex(null);
    if (!dragItem) return;
    if (dragItem.stage === stage && dragOverIndex !== null) {
      const stageItems = itemsByStage(stage);
      const fromIndex = stageItems.findIndex(i => i.tenantId === dragItem.tenantId && i.buildingId === dragItem.buildingId);
      if (fromIndex !== -1 && fromIndex !== dragOverIndex) {
        await reorderInStage(stage, fromIndex, dragOverIndex);
      }
    } else if (dragItem.stage !== stage) {
      await handleStageChange(dragItem.tenantId, dragItem.buildingId, stage);
    }
    setDragItem(null);
  };
  const handleDragEnd = () => { setDragItem(null); setDragOverStage(null); setDragOverIndex(null); };

  const generateTouchpointEmail = useCallback(async (tp: Touchpoint, item: PipelineItem) => {
    setEmailTouchpoint(tp); setGeneratingEmail(true); setGeneratedEmail(''); setCopied(false);
    const name = getDisplayName(item);
    const company = getDisplayCompany(item);
    let tenantName = name, buildingName = company;
    let contactName = item.isManual ? name : '';
    let contactTitle = '', industry = '';
    let sqft = item.prospectSqft || 0;
    let leaseExpiration = '', vacancyRate = 0, headcount = 0;
    let clientsInBuilding: string[] = [];
    if (!item.isManual) {
      const { tenant, building } = getTenantInfo(item.tenantId, item.buildingId);
      if (tenant && building) {
        tenantName = tenant.name; buildingName = building.name;
        contactName = tenant.contactName; contactTitle = tenant.contactTitle;
        industry = tenant.industry; sqft = tenant.sqft;
        leaseExpiration = tenant.leaseExpiration;
        vacancyRate = building.vacancyRate; headcount = tenant.headcount;
        clientsInBuilding = building.tenants.filter(t => t.isClient && t.id !== tenant.id).map(t => t.name);
      }
    }
    try {
      const resp = await fetch(OUTREACH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAuthToken()}` },
        body: JSON.stringify({
          tenantName, buildingName, contactName, contactTitle, industry, sqft,
          leaseExpiration, outreachReason: `Touchpoint: ${tp.title} — ${tp.description}`,
          vacancyRate, headcount, clientsInBuilding,
        }),
      });
      if (!resp.ok) { setGeneratingEmail(false); return; }
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '', full = '';
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
      const sent: Touchpoint = {
        ...tp, sentAt: new Date().toISOString(),
        followUpDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
      return { ...prev, sentTouchpoints: [...(prev.sentTouchpoints || []), sent] };
    });
  };
  const handleCopyEmail = () => {
    navigator.clipboard.writeText(generatedEmail);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const handleDeleteDeal = async (item: PipelineItem, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDeal(item.tenantId, item.buildingId);
    if (selectedItem?.tenantId === item.tenantId && selectedItem?.buildingId === item.buildingId) {
      setSelectedItem(null);
    }
  };
  const handleQuickView = (item: PipelineItem, e: React.MouseEvent) => {
    e.stopPropagation(); setSheetItem(item); setSheetOpen(true);
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return pipeline;
    const q = searchQuery.toLowerCase();
    return pipeline.filter(p =>
      getDisplayName(p).toLowerCase().includes(q) ||
      getDisplayCompany(p).toLowerCase().includes(q) ||
      getDisplayDetail(p).toLowerCase().includes(q)
    );
  }, [pipeline, searchQuery]);

  const itemsByStage = (stage: PipelineStage) =>
    filtered.filter(p => p.stage === stage).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

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

  const touchpointsPanelProps = selectedItem
    ? {
        selectedItem, touchpoints, sentTouchpointIds,
        emailTouchpoint, generatingEmail, generatedEmail, copied,
        onClose: () => { setSelectedItem(null); setEmailTouchpoint(null); setGeneratedEmail(''); },
        onGenerateEmail: generateTouchpointEmail,
        onMarkSent: handleMarkSent,
        onCopyEmail: handleCopyEmail,
        onClearEmail: () => { setEmailTouchpoint(null); setGeneratedEmail(''); },
      }
    : null;

  const renderKanbanColumns = () =>
    stages.map(stage => (
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
        onQuickView={handleQuickView}
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
    ));

  return (
    <div className="min-h-screen pt-12">
      <div className="mx-auto max-w-[1600px] px-2 sm:px-4 py-4 sm:py-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

          {/* ── Topbar ─────────────────────────────────────────────────── */}
          <div className="mb-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight">Deals</h1>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                Manage your pipeline and close more deals.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative hidden md:flex items-center w-[320px] h-9 rounded-lg border border-border bg-card pl-3 pr-2 text-[12.5px] text-muted-foreground">
                <Search className="h-3.5 w-3.5 mr-2 shrink-0" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search deals, tenants, buildings…"
                  className="h-7 border-0 bg-transparent px-0 py-0 text-[12.5px] placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <span className="ml-2 font-mono text-[10.5px] text-muted-foreground border border-border rounded px-1.5 py-0.5 bg-secondary/40">⌘K</span>
              </div>

              <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[12.5px]">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
              </Button>

              <div className="hidden md:flex">
                <ToggleGroup
                  type="single" value={viewMode}
                  onValueChange={(v) => { if (v) setViewMode(v as ViewMode); }}
                  className="border border-border rounded-md p-0.5 gap-0 h-9"
                >
                  <ToggleGroupItem value="kanban" size="sm"
                    className="h-7 w-8 p-0 data-[state=on]:bg-secondary data-[state=on]:text-foreground text-muted-foreground rounded"
                    aria-label="Kanban view">
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" size="sm"
                    className="h-7 w-8 p-0 data-[state=on]:bg-secondary data-[state=on]:text-foreground text-muted-foreground rounded"
                    aria-label="List view">
                    <List className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9 gap-1.5 text-[12.5px] shadow-[0_8px_22px_hsla(213,94%,58%,0.25)]">
                    <Plus className="h-3.5 w-3.5" /> New Deal
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="text-foreground">Add New Prospect</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Contact Name *</label>
                      <Input placeholder="e.g. John Smith"
                        value={newProspect.name}
                        onChange={e => setNewProspect(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Company</label>
                      <Input placeholder="e.g. Acme Corp"
                        value={newProspect.company}
                        onChange={e => setNewProspect(p => ({ ...p, company: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Email</label>
                        <Input type="email" placeholder="john@acme.com"
                          value={newProspect.email}
                          onChange={e => setNewProspect(p => ({ ...p, email: e.target.value }))} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-muted-foreground">Phone</label>
                        <Input placeholder="(202) 555-0100"
                          value={newProspect.phone}
                          onChange={e => setNewProspect(p => ({ ...p, phone: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">Size Requirement (SF)</label>
                      <Input type="number" placeholder="50000"
                        value={newProspect.sqft}
                        onChange={e => setNewProspect(p => ({ ...p, sqft: e.target.value }))} />
                    </div>
                    <Button onClick={handleAddProspect} className="w-full" disabled={!newProspect.name.trim()}>
                      Add to Pipeline
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* ── Overdue banner ─────────────────────────────────────────── */}
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

          {/* ── Mobile: stacked list ──────────────────────────────────── */}
          <div className="block md:hidden space-y-4">
            {stages.map(stage => {
              const items = itemsByStage(stage);
              if (items.length === 0) return null;
              return (
                <div key={stage}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={stagePillClass} style={{ ['--stage-hue' as never]: stageHues[stage] }}>
                      {stageLabels[stage]}
                    </span>
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
                          item={item} stages={stages}
                          getDisplayName={getDisplayName}
                          getDisplayCompany={getDisplayCompany}
                          getDisplayDetail={getDisplayDetail}
                          onSelect={(deal) => { setSelectedItem(deal); setDrawerOpen(true); }}
                          onStageChange={handleStageChange}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: floating drawer trigger */}
          <div className="block md:hidden">
            <AnimatePresence>
              {selectedItem && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                  transition={{ type: 'spring', damping: 20 }}
                  className="absolute bottom-6 left-1/2 z-40 -translate-x-1/2"
                >
                  <button onClick={() => setDrawerOpen(true)}
                    className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg">
                    <Sparkles className="h-4 w-4" /> View Touchpoints
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
            <Drawer open={drawerOpen}
              onOpenChange={(open) => { setDrawerOpen(open);
                if (!open) { setEmailTouchpoint(null); setGeneratedEmail(''); } }}>
              <DrawerContent className="max-h-[90vh]">
                {selectedItem && touchpointsPanelProps && (
                  <div className="overflow-y-auto px-4 pb-6 pt-2">
                    <TouchpointsPanelContent
                      {...touchpointsPanelProps}
                      onClose={() => {
                        setDrawerOpen(false); setSelectedItem(null);
                        setEmailTouchpoint(null); setGeneratedEmail('');
                      }}
                    />
                  </div>
                )}
              </DrawerContent>
            </Drawer>
          </div>

          {/* ── Desktop: list view ────────────────────────────────────── */}
          {viewMode === 'list' && (
            <div className="hidden md:block">
              <PipelineTable
                pipeline={filtered}
                selectedItem={selectedItem}
                onSelect={item => setSelectedItem(item)}
                onQuickView={handleQuickView}
                getDisplayName={getDisplayName}
                getDisplayCompany={getDisplayCompany}
                getDisplayDetail={getDisplayDetail}
              />
              <PipelineStats pipeline={filtered} />
            </div>
          )}

          {/* ── Desktop: kanban view ──────────────────────────────────── */}
          {viewMode === 'kanban' && (
            <div className="hidden md:block">
              {selectedItem && touchpointsPanelProps ? (
                <ResizablePanelGroup direction="horizontal" className="min-h-[520px]">
                  <ResizablePanel defaultSize={70} minSize={50}>
                    <div className="flex gap-3 overflow-x-auto pb-4 pr-2 h-full">
                      {renderKanbanColumns()}
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle className="mx-1 bg-border/50 hover:bg-border transition-colors" />
                  <ResizablePanel defaultSize={30} minSize={20}>
                    <AnimatePresence>
                      <TouchpointsPanel {...touchpointsPanelProps} />
                    </AnimatePresence>
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3 pb-2">
                    {renderKanbanColumns()}
                  </div>
                  <PipelineStats pipeline={filtered} />
                </>
              )}
            </div>
          )}

        </motion.div>
      </div>

      <OutcomeDialog
        outcomeDialog={outcomeDialog}
        outcomeReason={outcomeReason}
        onReasonChange={setOutcomeReason}
        onConfirm={handleOutcomeConfirm}
        onClose={() => { setOutcomeDialog(null); setOutcomeReason(''); }}
      />

      <DealDetailSheet
        item={sheetItem} open={sheetOpen}
        onOpenChange={(open) => { setSheetOpen(open); if (!open) setSheetItem(null); }}
        getDisplayName={getDisplayName}
        getDisplayCompany={getDisplayCompany}
        getDisplayDetail={getDisplayDetail}
      />
    </div>
  );
};

export default Pipeline;

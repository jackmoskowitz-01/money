import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building, MoreHorizontal, Plus, StickyNote, Trash2, Check,
  ArrowRightLeft, ClipboardList, ExternalLink, Expand,
} from 'lucide-react';
import {
  type PipelineStage, type PipelineItem,
  stageLabels, stageHues, stagePillClass,
} from '@/data/pipelineData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator,
  ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import LogActivityButton from '@/components/LogActivityButton';
import { supabase } from '@/integrations/supabase/client';
import { addActivity } from '@/data/activityData';
import { toast } from 'sonner';
import { useOrganizationId } from '@/hooks/useOrganization';

interface DealCardProps {
  item: PipelineItem;
  stages: PipelineStage[];
  isSelected: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  noteInput: string;
  onNoteInputChange: (value: string) => void;
  onNoteSubmit: () => void;
  onNoteTargetSet: (target: { tenantId: string; buildingId: string }) => void;
  onSelect: (item: PipelineItem | null) => void;
  onStageChange: (tenantId: string, buildingId: string, stage: PipelineStage) => void;
  onDelete: (item: PipelineItem, e: React.MouseEvent) => void;
  onQuickView?: (item: PipelineItem, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, item: PipelineItem) => void;
  onDragOver: (e: React.DragEvent, stage: PipelineStage, index: number) => void;
  onDragEnd: () => void;
  stage: PipelineStage;
  index: number;
  getDisplayName: (item: PipelineItem) => string;
  getDisplayCompany: (item: PipelineItem) => string;
  getDisplayDetail: (item: PipelineItem) => string;
}

type ActivityTypeValue = 'call' | 'email_sent' | 'meeting' | 'note';
const activityTypes: { value: ActivityTypeValue; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'email_sent', label: 'Email Sent' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
];
const titleForType = (type: ActivityTypeValue, name: string) => ({
  call: `Call with ${name}`, email_sent: `Email to ${name}`,
  meeting: `Meeting with ${name}`, note: `Note about ${name}`,
}[type]);

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#4f7bd6,#2c4a8c)',
  'linear-gradient(135deg,#c66,#813a3a)',
  'linear-gradient(135deg,#6cc,#2c7777)',
  'linear-gradient(135deg,#b76,#5d3d2c)',
];

/** Tiny avatar stack derived from notes count + name initials. Pure visual. */
const AvatarStack = ({ name, count }: { name: string; count: number }) => {
  if (count <= 0) return null;
  const initials = name.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || '').join('') || '·';
  const shown = Math.min(count, 2);
  const extra = count - shown;
  return (
    <div className="ml-auto flex items-center">
      {Array.from({ length: shown }).map((_, i) => (
        <div
          key={i}
          className="w-[18px] h-[18px] rounded-full grid place-items-center text-[9px] font-semibold text-white -ml-[5px] first:ml-0"
          style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length], borderWidth: 1.5, borderStyle: 'solid', borderColor: 'hsl(var(--card))' }}
        >
          {initials}
        </div>
      ))}
      {extra > 0 && (
        <span className="ml-1 text-[10px] text-muted-foreground font-medium">+{extra}</span>
      )}
    </div>
  );
};

export const DealCard = ({
  item, stages, isSelected, isDragging, isDropTarget,
  noteInput, onNoteInputChange, onNoteSubmit, onNoteTargetSet,
  onSelect, onStageChange, onDelete, onQuickView,
  onDragStart, onDragOver, onDragEnd,
  stage, index,
  getDisplayName, getDisplayCompany, getDisplayDetail,
}: DealCardProps) => {
  const sentCount = (item.sentTouchpoints || []).length;
  const navigate = useNavigate();
  const orgId = useOrganizationId();
  const displayName = getDisplayName(item);
  const company = getDisplayCompany(item);
  const detail = getDisplayDetail(item);
  const hue = stageHues[item.stage];

  // Try to split detail into "City, State" + "X SF"
  const sfMatch = detail.match(/([\d,]+\s*SF)/i);
  const sfText = sfMatch?.[1] || '';
  const locText = company || detail.replace(sfText, '').replace(/^[\s·]+|[\s·]+$/g, '');

  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const openNoteDialog = () => {
    onNoteTargetSet({ tenantId: item.tenantId, buildingId: item.buildingId });
    setNoteDialogOpen(true);
  };
  const handleNoteSubmit = () => { onNoteSubmit(); setNoteDialogOpen(false); };

  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityType, setActivityType] = useState<ActivityTypeValue>('call');
  const [activityDescription, setActivityDescription] = useState('');
  const [activitySubmitting, setActivitySubmitting] = useState(false);
  const openActivityDialog = () => {
    setActivityType('call'); setActivityDescription(''); setActivityDialogOpen(true);
  };
  const handleActivitySubmit = async () => {
    setActivitySubmitting(true);
    const title = titleForType(activityType, displayName);
    addActivity({
      tenantId: item.tenantId, buildingId: item.buildingId,
      type: activityType, title, description: activityDescription.trim(),
    });
    await supabase.from('activities').insert({
      tenant_id: item.tenantId, building_id: item.buildingId,
      type: activityType, title, description: activityDescription.trim(),
      timestamp: new Date().toISOString(),
      ...(orgId ? { organization_id: orgId } : {}),
    }).then(({ error }) => { if (error) console.error('Activity DB insert error:', error); });
    toast.success('Activity logged');
    setActivitySubmitting(false);
    setActivityDialogOpen(false);
  };

  const detailPath = !item.isManual ? `/building/${item.buildingId}/tenant/${item.tenantId}` : null;

  // Stage pill text — short rather than full label
  const shortPill: Record<PipelineStage, string> = {
    hot_prospect: 'Hot Prospect',
    meeting_set: 'Meeting Set',
    meeting_held: 'Discovery Done',
    moving_forward: 'Proposal Sent',
    won: 'In Negotiation',
    closed: 'Closed',
    lost: 'Lost',
  };

  return (
    <>
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Note — {displayName}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="Add a note..."
              value={noteInput}
              onChange={e => onNoteInputChange(e.target.value)}
              className="border-border bg-secondary/50 text-foreground"
              onKeyDown={e => e.key === 'Enter' && handleNoteSubmit()}
              autoFocus
            />
            <Button onClick={handleNoteSubmit} className="bg-primary text-primary-foreground">Add</Button>
          </div>
          {item.notes.length > 0 && (
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {item.notes.map((n, i) => <p key={i} className="text-xs text-muted-foreground">• {n}</p>)}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-sm">Log Activity — {displayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Activity Type</label>
              <Select value={activityType} onValueChange={v => setActivityType(v as ActivityTypeValue)}>
                <SelectTrigger className="border-border bg-secondary/50 text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activityTypes.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                Title: {titleForType(activityType, displayName)}
              </label>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Description</label>
              <Textarea
                value={activityDescription}
                onChange={e => setActivityDescription(e.target.value)}
                placeholder="Add details..."
                className="border-border bg-secondary/50 text-xs min-h-[80px]"
              />
            </div>
            <Button size="sm" className="w-full text-xs h-8" onClick={handleActivitySubmit} disabled={activitySubmitting}>
              {activitySubmitting ? 'Saving...' : 'Log Activity'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            draggable
            onDragStart={e => onDragStart(e, item)}
            onDragOver={e => onDragOver(e, stage, index)}
            onDragEnd={onDragEnd}
            style={{ ['--stage-hue' as never]: hue }}
          >
            <Card
              className={[
                'cursor-grab active:cursor-grabbing border-border bg-card p-3 transition-all',
                'hover:border-[hsl(var(--stage-hue)/0.35)]',
                isSelected ? 'border-[hsl(var(--stage-hue))] ring-1 ring-[hsl(var(--stage-hue)/0.25)]' : '',
                isDragging ? 'opacity-50 scale-95' : '',
                isDropTarget ? 'border-t-2 border-t-[hsl(var(--stage-hue))]' : '',
              ].join(' ')}
              onClick={() => onSelect(isSelected ? null : item)}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <div
                  className="w-[22px] h-[22px] rounded-md grid place-items-center shrink-0"
                  style={{ background: 'hsl(var(--stage-hue) / 0.10)', color: 'hsl(var(--stage-hue))' }}
                >
                  <Building className="h-3 w-3" />
                </div>
                <p className="text-[13px] font-semibold tracking-tight text-foreground truncate">
                  {displayName}
                </p>
                <div className="ml-auto flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                  <LogActivityButton
                    tenantId={item.tenantId}
                    buildingId={item.buildingId}
                    prospectName={displayName}
                    variant="icon"
                  />
                  {onQuickView && (
                    <button
                      onClick={e => onQuickView(item, e)}
                      className="rounded p-0.5 text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Quick view"
                    >
                      <Expand className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={e => onDelete(item, e)}
                    className="rounded p-0.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Remove from pipeline"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
                    title="More"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {locText && (
                <p className="text-[11.5px] text-muted-foreground leading-snug">{locText}</p>
              )}
              {sfText && (
                <p className="text-[11px] text-muted-foreground font-mono leading-snug">{sfText}</p>
              )}

              <div className="mt-2.5 flex items-center gap-2">
                <span
                  className={stagePillClass}
                  style={{ ['--stage-hue' as never]: hue }}
                >
                  {shortPill[item.stage]}
                </span>
                <AvatarStack name={displayName} count={1 + (item.notes.length > 0 ? 1 : 0) + Math.min(sentCount, 3)} />
              </div>

              {sentCount > 0 && (
                <div className="mt-1.5 flex items-center gap-1">
                  <Check className="h-3 w-3" style={{ color: 'hsl(var(--stage-hue))' }} />
                  <span className="text-[10px]" style={{ color: 'hsl(var(--stage-hue))' }}>
                    {sentCount} touchpoint{sentCount > 1 ? 's' : ''} sent
                  </span>
                </div>
              )}

              {item.notes.length > 0 && (
                <div className="mt-2 border-t border-border pt-2">
                  <p className="text-[10px] text-muted-foreground truncate">
                    <StickyNote className="mr-1 inline h-3 w-3" />
                    {item.notes[item.notes.length - 1]}
                  </p>
                </div>
              )}

              {item.stage === 'closed' && (
                <div className="mt-2 text-[10.5px] text-muted-foreground">
                  Closed {new Date(item.lastActivity).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              )}
            </Card>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-52">
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
              Move to Stage
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              {stages.filter(s => s !== item.stage).map(s => (
                <ContextMenuItem key={s} onSelect={() => onStageChange(item.tenantId, item.buildingId, s)}>
                  {stageLabels[s]}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />
          <ContextMenuItem onSelect={openNoteDialog} className="gap-2">
            <StickyNote className="h-3.5 w-3.5 text-muted-foreground" /> Add Note
          </ContextMenuItem>
          <ContextMenuItem onSelect={openActivityDialog} className="gap-2">
            <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" /> Log Activity
          </ContextMenuItem>
          {detailPath && (
            <ContextMenuItem onSelect={() => navigate(detailPath)} className="gap-2">
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /> View Details
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => {
              const ev = new MouseEvent('click', { bubbles: true }) as unknown as React.MouseEvent;
              onDelete(item, ev);
            }}
            className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </>
  );
};

/** Mobile card — keeps existing simpler shape, restyled with stage hue. */
export const MobileDealCard = ({
  item, stages, getDisplayName, getDisplayCompany, getDisplayDetail,
  onSelect, onStageChange,
}: Pick<DealCardProps, 'item' | 'stages' | 'getDisplayName' | 'getDisplayCompany' | 'getDisplayDetail' | 'onSelect' | 'onStageChange'>) => {
  const sentCount = (item.sentTouchpoints || []).length;
  const hue = stageHues[item.stage];
  return (
    <Card
      className="border-border bg-card p-3"
      style={{ ['--stage-hue' as never]: hue }}
      onClick={() => onSelect(item)}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-[22px] h-[22px] rounded-md grid place-items-center shrink-0"
          style={{ background: 'hsl(var(--stage-hue) / 0.10)', color: 'hsl(var(--stage-hue))' }}
        >
          <Building className="h-3 w-3" />
        </div>
        <p className="text-[13px] font-semibold text-foreground truncate flex-1">{getDisplayName(item)}</p>
      </div>
      <p className="text-[11.5px] text-muted-foreground">{getDisplayCompany(item)}</p>
      <p className="text-[11px] text-muted-foreground font-mono">{getDisplayDetail(item)}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className={stagePillClass} style={{ ['--stage-hue' as never]: hue }}>
          {stageLabels[item.stage]}
        </span>
        {sentCount > 0 && (
          <span className="text-[10px]" style={{ color: 'hsl(var(--stage-hue))' }}>
            <Check className="inline h-3 w-3 mr-0.5" />
            {sentCount}
          </span>
        )}
      </div>
    </Card>
  );
};

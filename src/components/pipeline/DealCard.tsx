import { Link } from 'react-router-dom';
import {
  GripVertical, Plus, StickyNote, ChevronRight, Trash2,
  Check, Mail, Phone, Building2,
} from 'lucide-react';
import { stageLabels, type PipelineStage, type PipelineItem } from '@/data/pipelineData';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import LogActivityButton from '@/components/LogActivityButton';

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
  onDragStart: (e: React.DragEvent, item: PipelineItem) => void;
  onDragOver: (e: React.DragEvent, stage: PipelineStage, index: number) => void;
  onDragEnd: () => void;
  stage: PipelineStage;
  index: number;
  getDisplayName: (item: PipelineItem) => string;
  getDisplayCompany: (item: PipelineItem) => string;
  getDisplayDetail: (item: PipelineItem) => string;
}

export const DealCard = ({
  item, stages, isSelected, isDragging, isDropTarget,
  noteInput, onNoteInputChange, onNoteSubmit, onNoteTargetSet,
  onSelect, onStageChange, onDelete,
  onDragStart, onDragOver, onDragEnd,
  stage, index,
  getDisplayName, getDisplayCompany, getDisplayDetail,
}: DealCardProps) => {
  const sentCount = (item.sentTouchpoints || []).length;

  return (
    <Card
      draggable
      onDragStart={e => onDragStart(e, item)}
      onDragOver={e => onDragOver(e, stage, index)}
      onDragEnd={onDragEnd}
      className={`cursor-grab active:cursor-grabbing border-border bg-card p-3 transition-all hover:border-primary/30 ${isSelected ? 'border-primary ring-1 ring-primary/20' : ''} ${isDragging ? 'opacity-50 scale-95' : ''} ${isDropTarget ? 'border-t-2 border-t-primary' : ''}`}
      onClick={() => onSelect(isSelected ? null : item)}
    >
      <div className="mb-2 flex items-start justify-between">
        <p className="text-sm font-semibold text-foreground">{getDisplayName(item)}</p>
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <LogActivityButton
            tenantId={item.tenantId}
            buildingId={item.buildingId}
            prospectName={getDisplayName(item)}
            variant="icon"
          />
          <button
            onClick={e => onDelete(item, e)}
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
          onChange={e => onStageChange(item.tenantId, item.buildingId, e.target.value as PipelineStage)}
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
              onClick={() => onNoteTargetSet({ tenantId: item.tenantId, buildingId: item.buildingId })}
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
                onChange={e => onNoteInputChange(e.target.value)}
                className="border-border bg-secondary/50 text-foreground"
                onKeyDown={e => e.key === 'Enter' && onNoteSubmit()}
              />
              <Button onClick={onNoteSubmit} className="bg-primary text-primary-foreground">Add</Button>
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
};

/** Simplified card for mobile view */
export const MobileDealCard = ({
  item, stages, getDisplayName, getDisplayCompany, getDisplayDetail,
  onSelect, onStageChange,
}: Pick<DealCardProps, 'item' | 'stages' | 'getDisplayName' | 'getDisplayCompany' | 'getDisplayDetail' | 'onSelect' | 'onStageChange'>) => {
  const sentCount = (item.sentTouchpoints || []).length;

  return (
    <Card className="border-border bg-card p-3" onClick={() => onSelect(item)}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-foreground">{getDisplayName(item)}</p>
        <select
          value={item.stage}
          onChange={e => { e.stopPropagation(); onStageChange(item.tenantId, item.buildingId, e.target.value as PipelineStage); }}
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
};

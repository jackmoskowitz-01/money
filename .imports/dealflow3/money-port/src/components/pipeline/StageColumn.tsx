import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Plus } from 'lucide-react';
import { buildings } from '@/data/mockData';
import {
  stageLabels, stageHues,
  type PipelineStage, type PipelineItem,
} from '@/data/pipelineData';
import { DealCard } from './DealCard';

interface StageColumnProps {
  stage: PipelineStage;
  items: PipelineItem[];
  stages: PipelineStage[];
  selectedItem: PipelineItem | null;
  dragItem: PipelineItem | null;
  dragOverStage: PipelineStage | null;
  dragOverIndex: number | null;
  noteInput: string;
  onNoteInputChange: (value: string) => void;
  onNoteSubmit: () => void;
  onNoteTargetSet: (target: { tenantId: string; buildingId: string }) => void;
  onSelect: (item: PipelineItem | null) => void;
  onStageChange: (tenantId: string, buildingId: string, stage: PipelineStage) => void;
  onDelete: (item: PipelineItem, e: React.MouseEvent) => void;
  onQuickView?: (item: PipelineItem, e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, item: PipelineItem) => void;
  onDragOver: (e: React.DragEvent, stage: PipelineStage) => void;
  onCardDragOver: (e: React.DragEvent, stage: PipelineStage, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, stage: PipelineStage) => void;
  onDragEnd: () => void;
  getDisplayName: (item: PipelineItem) => string;
  getDisplayCompany: (item: PipelineItem) => string;
  getDisplayDetail: (item: PipelineItem) => string;
}

const RENT_PER_SF = 65;

const totalValue = (items: PipelineItem[]) => {
  const sum = items.reduce((s, p) => {
    if (p.isManual) return s + (p.prospectSqft || 0) * RENT_PER_SF;
    const b = buildings.find(x => x.id === p.buildingId);
    const t = b?.tenants.find(t => t.id === p.tenantId);
    return s + (t?.sqft || 0) * RENT_PER_SF;
  }, 0);
  if (sum >= 1_000_000) return `$${(sum / 1_000_000).toFixed(1)}M`;
  if (sum >= 1_000) return `$${(sum / 1_000).toFixed(0)}K`;
  return `$${sum.toFixed(0)}`;
};

export const StageColumn = ({
  stage, items, stages, selectedItem, dragItem, dragOverStage, dragOverIndex,
  noteInput, onNoteInputChange, onNoteSubmit, onNoteTargetSet,
  onSelect, onStageChange, onDelete, onQuickView,
  onDragStart, onDragOver, onCardDragOver, onDragLeave, onDrop, onDragEnd,
  getDisplayName, getDisplayCompany, getDisplayDetail,
}: StageColumnProps) => {
  const hue = stageHues[stage];
  const isDropZone = dragOverStage === stage;

  return (
    <div
      className={`min-w-[200px] sm:min-w-[230px] flex-1 flex flex-col gap-2.5 transition-colors ${
        isDropZone ? 'rounded-lg ring-2 ring-[hsl(var(--stage-hue)/0.35)] bg-[hsl(var(--stage-hue)/0.04)]' : ''
      }`}
      style={{ ['--stage-hue' as never]: hue }}
      onDragOver={e => onDragOver(e, stage)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop(e, stage)}
    >
      {/* Column header card */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-card px-3.5 py-3">
        <span
          aria-hidden
          className="absolute left-0 right-0 top-0 h-[2px]"
          style={{
            background:
              'linear-gradient(90deg, transparent, hsl(var(--stage-hue)) 30%, hsl(var(--stage-hue)) 70%, transparent)',
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-14"
          style={{
            background: 'radial-gradient(ellipse at top, hsl(var(--stage-hue) / 0.10), transparent 70%)',
          }}
        />
        <div className="relative flex items-center justify-between">
          <span className="text-[13.5px] font-semibold tracking-tight text-foreground">
            {stageLabels[stage]}
          </span>
          <button className="text-muted-foreground hover:text-foreground p-0.5 rounded">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="relative mt-2.5 flex items-baseline gap-3">
          <span className="text-[13px] font-semibold text-foreground">{items.length}</span>
          <span
            className="ml-auto font-mono text-[13px] font-medium"
            style={{ color: 'hsl(var(--stage-hue))' }}
          >
            {totalValue(items)}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5">
        {items.map((item, idx) => {
          const isSelected =
            selectedItem?.tenantId === item.tenantId && selectedItem?.buildingId === item.buildingId;
          const isDragging =
            dragItem?.tenantId === item.tenantId && dragItem?.buildingId === item.buildingId;
          const isDropTarget =
            dragOverStage === stage &&
            dragOverIndex === idx &&
            dragItem &&
            !(dragItem.tenantId === item.tenantId && dragItem.buildingId === item.buildingId);

          return (
            <DealCard
              key={`${item.tenantId}-${item.buildingId}`}
              item={item}
              stages={stages}
              isSelected={isSelected}
              isDragging={isDragging}
              isDropTarget={!!isDropTarget}
              noteInput={noteInput}
              onNoteInputChange={onNoteInputChange}
              onNoteSubmit={onNoteSubmit}
              onNoteTargetSet={onNoteTargetSet}
              onSelect={onSelect}
              onStageChange={onStageChange}
              onDelete={onDelete}
              onQuickView={onQuickView}
              onDragStart={onDragStart}
              onDragOver={onCardDragOver}
              onDragEnd={onDragEnd}
              stage={stage}
              index={idx}
              getDisplayName={getDisplayName}
              getDisplayCompany={getDisplayCompany}
              getDisplayDetail={getDisplayDetail}
            />
          );
        })}

        <button
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong bg-transparent px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:border-[hsl(var(--stage-hue)/0.4)]"
          style={{ borderColor: 'hsl(var(--border))' }}
          onClick={() => onSelect(null)}
        >
          <Plus className="h-3 w-3" /> Add Deal
        </button>
      </div>

      {/* Hide the unused Badge import warning from older versions */}
      {false && <Badge>{stageLabels[stage]}</Badge>}
    </div>
  );
};

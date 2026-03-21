import { Badge } from '@/components/ui/badge';
import { stageLabels, stageColors, type PipelineStage, type PipelineItem } from '@/data/pipelineData';
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

export const StageColumn = ({
  stage, items, stages, selectedItem, dragItem, dragOverStage, dragOverIndex,
  noteInput, onNoteInputChange, onNoteSubmit, onNoteTargetSet,
  onSelect, onStageChange, onDelete,
  onDragStart, onDragOver, onCardDragOver, onDragLeave, onDrop, onDragEnd,
  getDisplayName, getDisplayCompany, getDisplayDetail,
}: StageColumnProps) => {
  return (
    <div
      className={`min-w-[180px] sm:min-w-[220px] flex-1 rounded-lg p-1.5 sm:p-2 transition-colors ${dragOverStage === stage ? 'bg-primary/5 ring-2 ring-primary/20' : ''}`}
      onDragOver={e => onDragOver(e, stage)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop(e, stage)}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${stageColors[stage]} text-xs`}>
            {stageLabels[stage]}
          </Badge>
          <span className="text-xs text-muted-foreground">{items.length}</span>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => {
          if (!item.isManual) {
            // Check will be done by parent via getDisplayName returning 'Unknown'
          }

          const isSelected = selectedItem?.tenantId === item.tenantId && selectedItem?.buildingId === item.buildingId;
          const isDragging = dragItem?.tenantId === item.tenantId && dragItem?.buildingId === item.buildingId;
          const isDropTarget = dragOverStage === stage && dragOverIndex === idx && dragItem && !(dragItem.tenantId === item.tenantId && dragItem.buildingId === item.buildingId);

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
      </div>
    </div>
  );
};

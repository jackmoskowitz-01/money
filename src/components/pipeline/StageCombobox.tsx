import { cn } from '@/lib/utils';
import { stageLabels, stageColors, type PipelineStage } from '@/data/pipelineData';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';

const STAGE_ORDER: PipelineStage[] = [
  'hot_prospect',
  'meeting_set',
  'meeting_held',
  'moving_forward',
  'won',
  'closed',
  'lost',
];

const stageOptions: ComboboxOption[] = STAGE_ORDER.map(s => ({
  value: s,
  label: stageLabels[s],
  badgeClassName: cn(
    'inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium',
    stageColors[s],
  ),
}));

interface StageComboboxProps {
  value: PipelineStage;
  stages: PipelineStage[];
  onValueChange: (stage: PipelineStage) => void;
  /** Pass 'compact' for the small in-card variant (default) or 'full' for wider contexts */
  size?: 'compact' | 'full';
}

export function StageCombobox({ value, stages, onValueChange, size = 'compact' }: StageComboboxProps) {
  // Respect the parent's allowed stages (in case only a subset is shown)
  const options = stageOptions.filter(o => stages.includes(o.value as PipelineStage));

  const renderBadge = (label: string, stage: string) => (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium',
        stageColors[stage as PipelineStage],
      )}
    >
      {label}
    </span>
  );

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={v => onValueChange(v as PipelineStage)}
      placeholder="Set stage…"
      searchPlaceholder="Search stages…"
      triggerClassName={cn(
        'border-border bg-secondary/50 hover:bg-secondary/70 text-foreground',
        size === 'compact'
          ? 'h-6 rounded-sm px-1.5 py-0.5 text-[10px]'
          : 'h-8 rounded-md px-2.5 text-xs',
      )}
      contentClassName="w-44"
      renderTriggerLabel={selected =>
        selected ? renderBadge(selected.label, selected.value) : 'Set stage…'
      }
      renderOptionLabel={option => renderBadge(option.label, option.value)}
    />
  );
}

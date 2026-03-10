import { Badge } from '@/components/ui/badge';
import type { ScoopCategory } from '@/hooks/useScoops';

const CATEGORY_CONFIG: Record<ScoopCategory, { label: string; className: string }> = {
  lease_move: { label: 'Lease Move', className: 'bg-primary/15 text-primary border-primary/30' },
  rfp: { label: 'RFP', className: 'bg-info/15 text-info border-info/30' },
  expansion: { label: 'Expansion', className: 'bg-success/15 text-success border-success/30' },
  contraction: { label: 'Contraction', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  personnel: { label: 'Personnel', className: 'bg-warning/15 text-warning border-warning/30' },
  concession: { label: 'Concession', className: 'bg-accent/80 text-accent-foreground border-accent' },
  conversion: { label: 'Conversion', className: 'bg-secondary text-secondary-foreground border-border' },
  general: { label: 'General', className: 'bg-muted text-muted-foreground border-border' },
};

export const ScoopCategoryBadge = ({ category }: { category: ScoopCategory }) => {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.className}`}>
      {config.label}
    </Badge>
  );
};

export const CATEGORY_OPTIONS: { value: ScoopCategory; label: string }[] = [
  { value: 'lease_move', label: 'Lease Move' },
  { value: 'rfp', label: 'RFP' },
  { value: 'expansion', label: 'Expansion' },
  { value: 'contraction', label: 'Contraction' },
  { value: 'personnel', label: 'Personnel Change' },
  { value: 'concession', label: 'Concession' },
  { value: 'conversion', label: 'Conversion' },
  { value: 'general', label: 'General' },
];

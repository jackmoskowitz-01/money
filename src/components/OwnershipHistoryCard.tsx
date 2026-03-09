import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ownershipHistory } from '@/data/activityData';

interface Props {
  buildingId: string;
}

const OwnershipHistoryCard = ({ buildingId }: Props) => {
  const record = ownershipHistory[buildingId];
  if (!record) return null;

  return (
    <Card className="border-border bg-card p-3">
      <h4 className="mb-2 text-xs font-semibold text-muted-foreground">🏢 OWNERSHIP HISTORY</h4>
      <div className="relative space-y-0">
        {record.history.map((entry, i) => (
          <div key={i} className="relative flex gap-3 pb-3">
            {i < record.history.length - 1 && (
              <div className="absolute left-[7px] top-4 h-[calc(100%-8px)] w-px bg-border" />
            )}
            <div className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-primary bg-card" />
            <div>
              <p className="text-xs font-medium text-foreground">{entry.owner}</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{entry.acquiredDate}</span>
                {entry.price && <Badge variant="outline" className="text-[9px]">{entry.price}</Badge>}
                {entry.capRate && <span className="text-[10px] text-muted-foreground">Cap: {entry.capRate}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default OwnershipHistoryCard;

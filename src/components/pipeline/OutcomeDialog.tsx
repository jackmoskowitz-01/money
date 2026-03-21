import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { PipelineStage } from '@/data/pipelineData';

const WON_REASONS = ['Strong relationship', 'Competitive pricing', 'Perfect timing', 'Market knowledge', 'Referral'];
const LOST_REASONS = ['Lost to competitor', 'Budget constraints', 'Went dark', 'Decided to renew', 'Bad timing', 'Wrong fit'];

interface OutcomeDialogProps {
  outcomeDialog: { tenantId: string; buildingId: string; stage: PipelineStage } | null;
  outcomeReason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const OutcomeDialog = ({
  outcomeDialog, outcomeReason, onReasonChange, onConfirm, onClose,
}: OutcomeDialogProps) => {
  const isWon = outcomeDialog?.stage === 'won';
  const reasons = isWon ? WON_REASONS : LOST_REASONS;

  return (
    <Dialog open={!!outcomeDialog} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isWon ? '🎉 Deal Won!' : '📉 Deal Lost'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            {isWon
              ? 'Congrats! What made this deal close?'
              : 'What happened? This helps the AI learn for next time.'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {reasons.map(reason => (
              <button
                key={reason}
                onClick={() => onReasonChange(reason)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  outcomeReason === reason
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
          <Input
            placeholder="Add more detail (optional)..."
            value={outcomeReason}
            onChange={e => onReasonChange(e.target.value)}
            className="text-sm"
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Skip
            </Button>
            <Button size="sm" onClick={onConfirm}>
              {isWon ? '🎉 Confirm Win' : 'Confirm'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

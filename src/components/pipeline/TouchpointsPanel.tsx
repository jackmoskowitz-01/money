import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Mail, Phone, Building2, MessageSquare, Sparkles, Send,
  Check, Clock, Loader2, Copy, UserPlus,
} from 'lucide-react';
import {
  stageLabels, stageColors, touchpointLabels,
  type PipelineItem, type Touchpoint,
} from '@/data/pipelineData';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const touchpointIcons: Record<Touchpoint['type'], typeof Mail> = {
  market_update: Sparkles,
  lease_comp: Building2,
  space_available: Building2,
  building_news: Building2,
  check_in: MessageSquare,
  intro_colleague: UserPlus,
  event_invite: Send,
};

interface TouchpointsPanelProps {
  selectedItem: PipelineItem;
  touchpoints: Touchpoint[];
  sentTouchpointIds: Set<string>;
  emailTouchpoint: Touchpoint | null;
  generatingEmail: boolean;
  generatedEmail: string;
  copied: boolean;
  onClose: () => void;
  onGenerateEmail: (tp: Touchpoint, item: PipelineItem) => void;
  onMarkSent: (tp: Touchpoint) => void;
  onCopyEmail: () => void;
  onClearEmail: () => void;
}

export const TouchpointsPanel = ({
  selectedItem, touchpoints, sentTouchpointIds,
  emailTouchpoint, generatingEmail, generatedEmail, copied,
  onClose, onGenerateEmail, onMarkSent, onCopyEmail, onClearEmail,
}: TouchpointsPanelProps) => {
  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 400, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 25 }}
      className="shrink-0 overflow-hidden hidden lg:block"
    >
      <Card className="sticky top-20 border-border bg-card p-4">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-foreground">
              {selectedItem.isManual ? selectedItem.prospectName || 'Unknown' : selectedItem.tenantId}
            </h3>
            <p className="text-xs text-muted-foreground">
              {selectedItem.isManual ? selectedItem.prospectCompany || '' : selectedItem.buildingId}
            </p>
            <Badge variant="outline" className={`mt-1.5 ${stageColors[selectedItem.stage]} text-[10px]`}>
              {stageLabels[selectedItem.stage]}
            </Badge>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contact info for manual prospects */}
        {selectedItem.isManual && (selectedItem.prospectEmail || selectedItem.prospectPhone) && (
          <div className="mb-4 space-y-1.5 rounded-md border border-border bg-secondary/30 p-3">
            {selectedItem.prospectEmail && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" /> {selectedItem.prospectEmail}
              </p>
            )}
            {selectedItem.prospectPhone && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" /> {selectedItem.prospectPhone}
              </p>
            )}
            {selectedItem.prospectSqft && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" /> {selectedItem.prospectSqft.toLocaleString()} SF requirement
              </p>
            )}
          </div>
        )}

        {/* Email Draft Panel */}
        <AnimatePresence>
          {emailTouchpoint && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    {generatingEmail ? 'Generating email...' : 'Draft Email'}
                  </p>
                  <div className="flex items-center gap-1">
                    {!generatingEmail && generatedEmail && (
                      <>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={onCopyEmail}>
                          {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                          {copied ? 'Copied' : 'Copy'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-primary"
                          onClick={() => {
                            onMarkSent(emailTouchpoint);
                            onClearEmail();
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" /> Mark Sent
                        </Button>
                      </>
                    )}
                    <button onClick={onClearEmail} className="rounded p-0.5 hover:bg-secondary">
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                {generatingEmail && !generatedEmail && (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Drafting your email...</span>
                  </div>
                )}
                {generatedEmail && (
                  <div className="max-h-60 overflow-y-auto rounded bg-background p-2.5">
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{generatedEmail}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Suggested Touchpoints
        </h4>
        <p className="mb-3 text-[11px] text-muted-foreground">
          Warm follow-up ideas based on pipeline stage. Click to generate an email draft.
        </p>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {touchpoints.map(tp => {
            const Icon = touchpointIcons[tp.type];
            const isSent = sentTouchpointIds.has(tp.id);
            const isActive = emailTouchpoint?.id === tp.id;
            return (
              <div
                key={tp.id}
                className={`group cursor-pointer rounded-md border p-3 transition-all ${
                  isSent
                    ? 'border-primary/20 bg-primary/5 opacity-70'
                    : isActive
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-secondary/20 hover:border-primary/30 hover:bg-secondary/50'
                }`}
                onClick={() => {
                  if (!isSent) onGenerateEmail(tp, selectedItem);
                }}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-md ${isSent ? 'bg-primary/20' : 'bg-primary/10'}`}>
                    {isSent ? <Check className="h-3.5 w-3.5 text-primary" /> : <Icon className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                    {touchpointLabels[tp.type]}
                  </Badge>
                  {isSent && (
                    <Badge variant="outline" className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">
                      Sent
                    </Badge>
                  )}
                  {tp.suggested && !isSent && (
                    <Badge variant="outline" className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">
                      Suggested
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">{tp.title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{tp.description}</p>
                {isSent && (
                  <p className="mt-1 text-[10px] text-primary/70">
                    <Clock className="inline h-3 w-3 mr-0.5" />
                    Sent {new Date((selectedItem.sentTouchpoints || []).find(s => s.id === tp.id)?.sentAt || '').toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Sent touchpoints history */}
        {(selectedItem.sentTouchpoints || []).length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">TOUCHPOINT HISTORY</h4>
            <div className="space-y-1">
              {(selectedItem.sentTouchpoints || []).map((tp, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Check className="h-3 w-3 text-primary shrink-0" />
                  <span className="flex-1">{tp.title}</span>
                  <span className="text-[10px] shrink-0">{new Date(tp.sentAt!).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes section */}
        {selectedItem.notes.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">NOTES</h4>
            <div className="space-y-1">
              {selectedItem.notes.map((n, i) => (
                <p key={i} className="text-[11px] text-muted-foreground">• {n}</p>
              ))}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

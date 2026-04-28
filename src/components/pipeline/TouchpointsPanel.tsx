import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Mail, Phone, Building2, MessageSquare, Sparkles, Send,
  Check, Clock, Loader2, Copy, UserPlus, StickyNote, Activity,
} from 'lucide-react';
import {
  stageLabels, stageColors, touchpointLabels,
  type PipelineItem, type Touchpoint,
} from '@/data/pipelineData';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

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
  // Optional: caller can wire up persistent note saving
  onAddNote?: (note: string) => void;
}

// Build a unified activity log from sentTouchpoints and notes with timestamps.
// Notes don't carry a timestamp on the data model, so we use lastActivity as a
// fallback and surface them in chronological order alongside touchpoint sends.
function buildActivityLog(item: PipelineItem) {
  type ActivityEntry = {
    key: string;
    kind: 'touchpoint' | 'note';
    label: string;
    timestamp: string;
  };

  const entries: ActivityEntry[] = [];

  (item.sentTouchpoints || []).forEach((tp, i) => {
    entries.push({
      key: `tp-${i}`,
      kind: 'touchpoint',
      label: tp.title,
      timestamp: tp.sentAt || item.lastActivity,
    });
  });

  // Notes don't store individual timestamps; use lastActivity as a placeholder
  // so they still appear in the log. In a future migration these can carry their own ts.
  item.notes.forEach((note, i) => {
    entries.push({
      key: `note-${i}`,
      kind: 'note',
      label: note,
      timestamp: item.lastActivity,
    });
  });

  return entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

// Shared inner content — used by both the desktop sidebar Card and the mobile Drawer.
export const TouchpointsPanelContent = ({
  selectedItem, touchpoints, sentTouchpointIds,
  emailTouchpoint, generatingEmail, generatedEmail, copied,
  onClose, onGenerateEmail, onMarkSent, onCopyEmail, onClearEmail,
  onAddNote,
}: TouchpointsPanelProps) => {
  const [noteInput, setNoteInput] = useState('');
  // Local notes that were added this session (before a re-fetch propagates them)
  const [localNotes, setLocalNotes] = useState<string[]>([]);

  const allNotes = [...selectedItem.notes, ...localNotes];
  const activityLog = buildActivityLog({
    ...selectedItem,
    notes: allNotes,
  });

  const handleAddNote = () => {
    const trimmed = noteInput.trim();
    if (!trimmed) return;
    if (onAddNote) {
      onAddNote(trimmed);
    } else {
      // Optimistic local-only fallback when caller hasn't wired up persistence
      setLocalNotes(prev => [...prev, trimmed]);
    }
    setNoteInput('');
  };

  const displayName = selectedItem.isManual
    ? selectedItem.prospectName || 'Unknown'
    : selectedItem.tenantId;

  const displaySub = selectedItem.isManual
    ? selectedItem.prospectCompany || ''
    : selectedItem.buildingId;

  return (
    <>
      {/* Prospect header — always visible above tabs */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">{displayName}</h3>
          <p className="text-xs text-muted-foreground">{displaySub}</p>
          <Badge variant="outline" className={`mt-1.5 ${stageColors[selectedItem.stage]} text-[10px]`}>
            {stageLabels[selectedItem.stage]}
          </Badge>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full grid grid-cols-4 mb-4">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="touchpoints" className="text-xs">Touchpoints</TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview">
          <div className="space-y-4">
            {/* Contact info for manual prospects */}
            {selectedItem.isManual &&
              (selectedItem.prospectEmail || selectedItem.prospectPhone || selectedItem.prospectSqft) && (
                <div className="space-y-1.5 rounded-md border border-border bg-secondary/30 p-3">
                  {selectedItem.prospectEmail && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" /> {selectedItem.prospectEmail}
                    </p>
                  )}
                  {selectedItem.prospectPhone && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" /> {selectedItem.prospectPhone}
                    </p>
                  )}
                  {selectedItem.prospectSqft && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3 shrink-0" />
                      {selectedItem.prospectSqft.toLocaleString()} SF requirement
                    </p>
                  )}
                </div>
              )}

            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" />
                Suggested Touchpoints
              </h4>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Warm follow-up ideas based on pipeline stage. Click to generate an email draft.
              </p>

              <div className="space-y-2">
                {touchpoints
                  .filter(tp => tp.suggested && !sentTouchpointIds.has(tp.id))
                  .slice(0, 3)
                  .map(tp => {
                    const Icon = touchpointIcons[tp.type];
                    return (
                      <div
                        key={tp.id}
                        className="group cursor-pointer rounded-md border border-border bg-secondary/20 p-3 transition-all hover:border-primary/30 hover:bg-secondary/50"
                        onClick={() => onGenerateEmail(tp, selectedItem)}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                            {touchpointLabels[tp.type]}
                          </Badge>
                          <Badge variant="outline" className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">
                            Suggested
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground">{tp.title}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{tp.description}</p>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Touchpoints ── */}
        <TabsContent value="touchpoints">
          <div className="space-y-4">
            {/* Email draft panel */}
            <AnimatePresence>
              {emailTouchpoint && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">
                        {generatingEmail ? 'Generating email...' : 'Draft Email'}
                      </p>
                      <div className="flex items-center gap-1">
                        {!generatingEmail && generatedEmail && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={onCopyEmail}
                            >
                              {copied
                                ? <Check className="h-3 w-3 text-primary" />
                                : <Copy className="h-3 w-3" />}
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
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                          {generatedEmail}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Full touchpoint list */}
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
                    onClick={() => { if (!isSent) onGenerateEmail(tp, selectedItem); }}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-md ${isSent ? 'bg-primary/20' : 'bg-primary/10'}`}>
                        {isSent
                          ? <Check className="h-3.5 w-3.5 text-primary" />
                          : <Icon className="h-3.5 w-3.5 text-primary" />}
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
                        Sent{' '}
                        {new Date(
                          (selectedItem.sentTouchpoints || []).find(s => s.id === tp.id)?.sentAt || '',
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Touchpoint history */}
            {(selectedItem.sentTouchpoints || []).length > 0 && (
              <div className="border-t border-border pt-3">
                <h4 className="mb-2 text-xs font-semibold text-muted-foreground">TOUCHPOINT HISTORY</h4>
                <div className="space-y-1">
                  {(selectedItem.sentTouchpoints || []).map((tp, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Check className="h-3 w-3 text-primary shrink-0" />
                      <span className="flex-1">{tp.title}</span>
                      <span className="text-[10px] shrink-0">
                        {new Date(tp.sentAt!).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Notes ── */}
        <TabsContent value="notes">
          <div className="space-y-3">
            {allNotes.length > 0 ? (
              <div className="space-y-2">
                {allNotes.map((note, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground"
                  >
                    {note}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                <StickyNote className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No notes yet.</p>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <Textarea
                placeholder="Add a note..."
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote();
                }}
                rows={3}
                className="resize-none text-xs"
              />
              <Button
                size="sm"
                className="w-full text-xs"
                disabled={!noteInput.trim()}
                onClick={handleAddNote}
              >
                Add Note
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Activity ── */}
        <TabsContent value="activity">
          <div className="space-y-1">
            {activityLog.length > 0 ? (
              <>
                {activityLog.map(entry => (
                  <div key={entry.key} className="flex items-start gap-2.5 py-1.5">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary">
                      {entry.kind === 'touchpoint'
                        ? <Send className="h-2.5 w-2.5 text-primary" />
                        : <StickyNote className="h-2.5 w-2.5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug truncate">{entry.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {entry.kind === 'touchpoint' ? 'Touchpoint sent' : 'Note added'}
                        {' · '}
                        {new Date(entry.timestamp).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
};

// Desktop sidebar — renders as a flex-filling panel inside ResizablePanelGroup.
// The motion animation is applied to opacity only; width is controlled by the
// resizable panel host so we must not set a fixed width here.
export const TouchpointsPanel = (props: TouchpointsPanelProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="h-full overflow-y-auto hidden lg:block"
    >
      <Card className="sticky top-20 border-border bg-card p-4">
        <TouchpointsPanelContent {...props} />
      </Card>
    </motion.div>
  );
};

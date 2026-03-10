import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ListOrdered, Loader2, X, Mail, Clock, Send, Copy, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const SMART_OUTREACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-outreach`;

interface SequenceStep {
  step: number;
  timing: string;
  subject: string;
  body: string;
}

interface SequenceBuilderProps {
  tenantName: string;
  contactName: string;
  industry: string;
  sqft: number;
  buildingName: string;
  leaseExpiration: string;
  outreachReason?: string;
  contactEmail?: string;
}

const SequenceBuilder = ({
  tenantName, contactName, industry, sqft, buildingName, leaseExpiration, outreachReason, contactEmail,
}: SequenceBuilderProps) => {
  const [sequence, setSequence] = useState<SequenceStep[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSequence, setShowSequence] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [numSteps, setNumSteps] = useState(4);

  const generateSequence = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    setShowSequence(true);
    setSequence([]);

    try {
      const resp = await fetch(SMART_OUTREACH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: 'build_sequence',
          tenantName, contactName, industry, sqft, buildingName, leaseExpiration, outreachReason,
          steps: numSteps,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        toast.error(err.error || 'Failed to generate sequence');
        setShowSequence(false);
        setIsLoading(false);
        return;
      }

      const data = await resp.json();
      setSequence(data.sequence || []);
      if (data.sequence?.length > 0) {
        setExpandedStep(1);
        toast.success(`${data.sequence.length}-step sequence generated`);
      }
    } catch {
      toast.error('Failed to generate sequence');
      setShowSequence(false);
    }
    setIsLoading(false);
  }, [isLoading, tenantName, contactName, industry, sqft, buildingName, leaseExpiration, outreachReason, numSteps]);

  const copyStep = (step: SequenceStep) => {
    navigator.clipboard.writeText(`Subject: ${step.subject}\n\n${step.body}`);
    setCopiedStep(step.step);
    toast.success(`Step ${step.step} copied`);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const openInEmail = (step: SequenceStep) => {
    const mailto = `mailto:${encodeURIComponent(contactEmail || '')}?subject=${encodeURIComponent(step.subject)}&body=${encodeURIComponent(step.body)}`;
    window.open(mailto, '_blank');
  };

  const stepLabels = ['Intro', 'Value-Add', 'Urgency', 'Break-Up', 'Re-engage'];

  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold">Sequence Builder</h3>
        </div>
        {showSequence && (
          <button onClick={() => setShowSequence(false)} className="rounded p-0.5 hover:bg-secondary">
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {!showSequence ? (
        <div>
          <p className="text-[10px] text-muted-foreground mb-3">
            Generate a multi-touch outreach sequence that escalates from intro to break-up.
          </p>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] text-muted-foreground">Steps:</span>
            {[3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setNumSteps(n)}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                  numSteps === n ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            className="w-full text-xs h-8"
            onClick={generateSequence}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ListOrdered className="h-3 w-3 mr-1" />}
            Generate {numSteps}-Step Sequence
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Building your outreach sequence...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {sequence.map((step, i) => {
            const isExpanded = expandedStep === step.step;
            return (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div
                  onClick={() => setExpandedStep(isExpanded ? null : step.step)}
                  className={`rounded-md border transition-all cursor-pointer ${
                    isExpanded ? 'border-primary/30 bg-primary/5' : 'border-border bg-secondary/20 hover:bg-secondary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 p-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {step.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-foreground truncate">{step.subject}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[9px] text-muted-foreground">{step.timing}</span>
                        {stepLabels[i] && (
                          <Badge variant="outline" className="text-[8px] px-1 py-0">{stepLabels[i]}</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-2.5 pb-2.5 border-t border-border/50 pt-2">
                          <div className="text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap mb-2 max-h-48 overflow-y-auto">
                            {step.body}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); copyStep(step); }}
                              className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary"
                            >
                              {copiedStep === step.step ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                              {copiedStep === step.step ? 'Copied' : 'Copy'}
                            </button>
                            {contactEmail && (
                              <button
                                onClick={(e) => { e.stopPropagation(); openInEmail(step); }}
                                className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-primary-foreground bg-primary hover:bg-primary/90"
                              >
                                <Send className="h-3 w-3" /> Send
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs h-7 mt-2"
            onClick={generateSequence}
            disabled={isLoading}
          >
            Regenerate Sequence
          </Button>
        </div>
      )}
    </Card>
  );
};

export default SequenceBuilder;

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, AlertTriangle, Phone, Mail, Search, CheckCircle2, Loader2, RefreshCw, ChevronDown, ChevronUp, Zap, Target, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type Priority = {
  action: string;
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  type: 'task' | 'outreach' | 'pipeline' | 'research';
};

type Briefing = {
  greeting: string;
  priorities: Priority[];
  insights: string[];
  stale_alert: string | null;
};

type BriefingContext = {
  pipelineCount: number;
  overdueCount: number;
  dueTodayCount: number;
  staleCount: number;
  weeklyActivities: number;
  generatedAt: string;
};

const CACHE_KEY = 'daily-briefing-cache';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

function getCachedBriefing(): { briefing: Briefing; context: BriefingContext } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.data;
  } catch { return null; }
}

function setCachedBriefing(data: { briefing: Briefing; context: BriefingContext }) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
}

const typeIcons: Record<string, typeof Phone> = {
  task: CheckCircle2,
  outreach: Mail,
  pipeline: Target,
  research: Search,
};

export default function DailyBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [context, setContext] = useState<BriefingContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchBriefing = async (force = false) => {
    if (!force) {
      const cached = getCachedBriefing();
      if (cached) {
        setBriefing(cached.briefing);
        setContext(cached.context);
        setHasLoaded(true);
        return;
      }
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-briefing`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate briefing');
      }

      const result = await resp.json();
      setBriefing(result.briefing);
      setContext(result.context);
      setCachedBriefing(result);
    } catch (err: any) {
      console.error('Briefing error:', err);
      toast({ title: 'Briefing unavailable', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  if (!hasLoaded && !loading) return null;

  const urgencyStyles = {
    high: { border: 'border-l-destructive', bg: 'bg-destructive/5', badge: 'bg-destructive/10 text-destructive', icon: 'text-destructive' },
    medium: { border: 'border-l-warning', bg: 'bg-warning/5', badge: 'bg-warning/10 text-warning', icon: 'text-warning' },
    low: { border: 'border-l-primary', bg: 'bg-primary/5', badge: 'bg-primary/10 text-primary', icon: 'text-primary' },
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
      <Card className="border-primary/20 bg-card overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="w-full border-b border-border px-5 py-3 flex items-center gap-2.5 bg-gradient-to-r from-primary/8 via-accent/5 to-transparent hover:from-primary/12 transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <h2 className="text-sm font-bold text-foreground">AI Daily Briefing</h2>
            <p className="text-[10px] text-muted-foreground">
              {context ? `Generated ${new Date(context.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : 'Your AI-powered daily playbook'}
            </p>
          </div>
          {context && (
            <div className="ml-auto flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-bold px-2">
                {context.pipelineCount} deals · {context.overdueCount} overdue
              </Badge>
              {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          )}
          {loading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-primary" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {loading && !briefing ? (
                <div className="px-5 py-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />
                  <p className="text-xs text-muted-foreground">Analyzing your pipeline, tasks, and market intel...</p>
                </div>
              ) : briefing ? (
                <div className="divide-y divide-border">
                  {/* Greeting */}
                  <div className="px-5 py-3">
                    <p className="text-sm text-foreground/80 italic">{briefing.greeting}</p>
                  </div>

                  {/* Stale Alert */}
                  {briefing.stale_alert && (
                    <div className="px-5 py-2.5 bg-destructive/5 flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                      <p className="text-[11px] text-destructive font-medium">{briefing.stale_alert}</p>
                    </div>
                  )}

                  {/* Priorities */}
                  <div className="divide-y divide-border/50">
                    {briefing.priorities.map((p, i) => {
                      const styles = urgencyStyles[p.urgency];
                      const Icon = typeIcons[p.type] || Zap;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + i * 0.06 }}
                          className={`px-5 py-3 border-l-[3px] ${styles.border} ${styles.bg} hover:bg-muted/20 transition-colors`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background/80 ${styles.icon}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground">{p.action}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{p.reason}</p>
                            </div>
                            <Badge className={`text-[9px] px-1.5 py-0 border-0 font-semibold shrink-0 ${styles.badge}`}>
                              {p.urgency === 'high' ? 'Urgent' : p.urgency === 'medium' ? 'Important' : 'Suggested'}
                            </Badge>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Insights */}
                  {briefing.insights.length > 0 && (
                    <div className="px-5 py-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Insights</p>
                      <div className="space-y-1.5">
                        {briefing.insights.map((insight, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-primary mt-0.5 text-[10px]">▸</span>
                            <p className="text-[11px] text-muted-foreground leading-snug">{insight}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Refresh */}
                  <div className="px-5 py-2.5 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-6 gap-1 text-muted-foreground hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); fetchBriefing(true); }}
                      disabled={loading}
                    >
                      <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

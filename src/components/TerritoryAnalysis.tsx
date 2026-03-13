import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Loader2, Target, AlertTriangle, ChevronDown, ChevronUp, MapPin, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Building } from '@/data/mockData';

type BlindSpot = {
  building_name: string;
  address: string;
  reason: string;
  opportunity_type: 'high_vacancy' | 'many_tenants' | 'no_activity' | 'competitor_gap';
};

type Analysis = {
  coverage_score: number;
  coverage_summary: string;
  blind_spots: BlindSpot[];
  recommendations: string[];
};

interface Props {
  buildings: Building[];
  onSelectBuilding?: (building: Building) => void;
}

const opportunityColors: Record<string, string> = {
  high_vacancy: 'bg-warning/10 text-warning',
  many_tenants: 'bg-primary/10 text-primary',
  no_activity: 'bg-destructive/10 text-destructive',
  competitor_gap: 'bg-info/10 text-info',
};

const opportunityLabels: Record<string, string> = {
  high_vacancy: 'High Vacancy',
  many_tenants: 'Many Tenants',
  no_activity: 'No Activity',
  competitor_gap: 'Competitor Gap',
};

export default function TerritoryAnalysis({ buildings, onSelectBuilding }: Props) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setExpanded(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const buildingSummary = buildings.map(b => ({
        id: b.id,
        name: b.name,
        address: b.address,
        tenantCount: b.tenants.length,
        vacancyRate: b.vacancyRate,
        class: b.class,
      }));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/territory-analysis`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ buildings: buildingSummary }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Analysis failed');
      }

      const result = await resp.json();
      setAnalysis(result.analysis);
      setHasRun(true);
    } catch (err: any) {
      console.error('Territory analysis error:', err);
      toast.error(err.message || 'Failed to run territory analysis');
    } finally {
      setLoading(false);
    }
  }, [buildings]);

  const handleSpotClick = (spot: BlindSpot) => {
    const match = buildings.find(b =>
      b.name.toLowerCase().includes(spot.building_name.toLowerCase()) ||
      b.address.toLowerCase().includes(spot.address.toLowerCase())
    );
    if (match && onSelectBuilding) {
      onSelectBuilding(match);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 75) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Card className="border-border bg-card/95 backdrop-blur-lg overflow-hidden">
      <button
        onClick={() => hasRun ? setExpanded(prev => !prev) : runAnalysis()}
        className="flex w-full items-center justify-between p-3 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/10">
            <Brain className="h-3.5 w-3.5 text-accent-foreground" />
          </div>
          <div className="text-left">
            <h3 className="text-xs font-bold">Smart Territory Analysis</h3>
            {!hasRun && <p className="text-[10px] text-muted-foreground">Click to analyze coverage</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analysis && (
            <Badge className={`text-[10px] border-0 font-bold px-2 ${analysis.coverage_score >= 75 ? 'bg-success/10 text-success' : analysis.coverage_score >= 50 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
              {analysis.coverage_score}% coverage
            </Badge>
          )}
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : hasRun ? (
            expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Target className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
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
            {loading && !analysis ? (
              <div className="px-3 py-6 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary mb-2" />
                <p className="text-[11px] text-muted-foreground">Analyzing {buildings.length} buildings...</p>
              </div>
            ) : analysis ? (
              <div className="border-t border-border">
                {/* Summary */}
                <div className="px-3 py-2.5 bg-secondary/10">
                  <p className="text-[11px] text-muted-foreground">{analysis.coverage_summary}</p>
                </div>

                {/* Blind Spots */}
                {analysis.blind_spots.length > 0 && (
                  <div className="divide-y divide-border/50">
                    <div className="px-3 py-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Blind Spots
                      </p>
                    </div>
                    {analysis.blind_spots.map((spot, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => handleSpotClick(spot)}
                        className="w-full text-left px-3 py-2.5 hover:bg-secondary/30 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-foreground truncate">{spot.building_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{spot.address}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{spot.reason}</p>
                          </div>
                          <Badge className={`text-[9px] px-1.5 py-0 border-0 shrink-0 ${opportunityColors[spot.opportunity_type] || 'bg-muted text-muted-foreground'}`}>
                            {opportunityLabels[spot.opportunity_type] || spot.opportunity_type}
                          </Badge>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {analysis.recommendations.length > 0 && (
                  <div className="px-3 py-2.5 border-t border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Recommendations</p>
                    <div className="space-y-1">
                      {analysis.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="text-primary text-[10px] mt-0.5">▸</span>
                          <p className="text-[11px] text-muted-foreground leading-snug">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Refresh */}
                <div className="px-3 py-2 border-t border-border flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] h-5 gap-1 text-muted-foreground hover:text-primary"
                    onClick={(e) => { e.stopPropagation(); runAnalysis(); }}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-2.5 w-2.5 ${loading ? 'animate-spin' : ''}`} />
                    Re-analyze
                  </Button>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

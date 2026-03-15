import { useState, useCallback, useEffect } from 'react';
import { Loader2, Sparkles, Building2, Users, MapPin, Briefcase, Zap, User, Newspaper, RefreshCw, ExternalLink, Shield, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { type ProspectEnrichment, updateCustomProspect, getCustomProspect } from '@/data/customProspects';
import { supabase } from '@/integrations/supabase/client';

const ENRICH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrich-prospect`;

type Props = {
  prospectId: string;
  companyName: string;
  website?: string;
  address?: string;
  cachedEnrichment?: ProspectEnrichment;
  onEnriched?: (enrichment: ProspectEnrichment) => void;
};

const signalColors: Record<string, string> = {
  growth: 'bg-green-500/10 text-green-600 border-green-500/20',
  contraction: 'bg-red-500/10 text-red-600 border-red-500/20',
  opportunity: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  neutral: 'bg-muted text-muted-foreground border-border',
};

const sizeLabels: Record<string, string> = {
  startup: '🚀 Startup',
  small: '🏢 Small Business',
  'mid-market': '🏗️ Mid-Market',
  enterprise: '🏛️ Enterprise',
};

const ProspectEnrichmentCard = ({ prospectId, companyName, website, address, cachedEnrichment, onEnriched }: Props) => {
  const [enrichment, setEnrichment] = useState<ProspectEnrichment | null>(cachedEnrichment || null);
  const [loading, setLoading] = useState(false);

  const fetchEnrichment = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(ENRICH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ companyName, website, address }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Enrichment failed');
      }

      const data = await resp.json();
      if (data.enrichment) {
        const enriched: ProspectEnrichment = {
          ...data.enrichment,
          enrichedAt: new Date().toISOString(),
          citations: data.citations || [],
        };
        setEnrichment(enriched);
        // Cache to localStorage
        updateCustomProspect(prospectId, { enrichment: enriched });
        onEnriched?.(enriched);
        toast.success('Company profile enriched');
      } else {
        toast.error('No enrichment data found');
      }
    } catch (e) {
      console.error('Enrichment failed:', e);
      toast.error('Failed to enrich prospect');
    } finally {
      setLoading(false);
    }
  }, [prospectId, companyName, website, address, onEnriched]);

  // Auto-enrich on mount if no cached data
  useEffect(() => {
    if (!enrichment) {
      fetchEnrichment();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const timeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  };

  return (
    <Card className="border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">AI Company Profile</h3>
          {enrichment?.confidenceScore != null && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary">
              <Shield className="h-2 w-2 mr-0.5" /> {enrichment.confidenceScore}% confidence
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {enrichment?.enrichedAt && (
            <span className="text-[10px] text-muted-foreground/60">Updated {timeSince(enrichment.enrichedAt)}</span>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchEnrichment} disabled={loading} title="Re-enrich">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="p-4">
        {loading && !enrichment ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Researching {companyName}...</span>
            <span className="text-[10px] text-muted-foreground/50">Scanning web for company intelligence</span>
          </div>
        ) : !enrichment ? (
          <div className="py-6 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground">No enrichment data yet</p>
            <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={fetchEnrichment}>
              Enrich Now
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overview */}
            {enrichment.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{enrichment.description}</p>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2">
              {enrichment.industry && (
                <div className="rounded-md bg-secondary/30 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Briefcase className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Industry</span>
                  </div>
                  <p className="text-xs font-medium text-foreground">{enrichment.industry}</p>
                </div>
              )}
              {enrichment.employeeCount && (
                <div className="rounded-md bg-secondary/30 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Employees</span>
                  </div>
                  <p className="text-xs font-medium text-foreground">
                    {enrichment.employeeCount}
                    {enrichment.companySize && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({sizeLabels[enrichment.companySize] || enrichment.companySize})
                      </span>
                    )}
                  </p>
                </div>
              )}
              {enrichment.headquarters && (
                <div className="rounded-md bg-secondary/30 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Headquarters</span>
                  </div>
                  <p className="text-xs font-medium text-foreground">{enrichment.headquarters}</p>
                </div>
              )}
              {enrichment.spaceDetails?.currentSqft && (
                <div className="rounded-md bg-secondary/30 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Current Space</span>
                  </div>
                  <p className="text-xs font-medium text-foreground">{enrichment.spaceDetails.currentSqft} SF</p>
                </div>
              )}
            </div>

            {/* Office Locations */}
            {enrichment.officeLocations?.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Office Locations</h4>
                <div className="flex flex-wrap gap-1">
                  {enrichment.officeLocations.map((loc, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] bg-secondary/30">
                      <MapPin className="h-2 w-2 mr-0.5" /> {loc}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* CRE Signals */}
            {enrichment.creSignals?.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  <Zap className="h-3 w-3 inline mr-1 text-primary" />Broker Signals
                </h4>
                <div className="space-y-1">
                  {enrichment.creSignals.map((signal, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/10 p-2">
                      <Zap className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      <p className="text-[11px] text-foreground leading-snug">{signal}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}




            {/* Recent News */}
            {enrichment.recentNews?.length > 0 && (
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Recent News</h4>
                <div className="space-y-1.5">
                  {enrichment.recentNews.map((news, i) => (
                    <div key={i} className="rounded-md border border-border bg-secondary/20 p-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className={`text-[8px] px-1 py-0 capitalize ${signalColors[news.signal] || signalColors.neutral}`}>
                          {news.signal}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground/60">{news.date}</span>
                      </div>
                      <p className="text-[11px] font-medium text-foreground">{news.headline}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{news.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Citations */}
            {enrichment.citations?.length > 0 && (
              <div className="pt-2 border-t border-border">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Sources</h4>
                <div className="flex flex-wrap gap-1">
                  {enrichment.citations.slice(0, 5).map((url, i) => {
                    let domain = '';
                    try { domain = new URL(url).hostname.replace('www.', ''); } catch { domain = url; }
                    return (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[9px] text-primary hover:underline bg-primary/5 rounded px-1.5 py-0.5"
                      >
                        <ExternalLink className="h-2 w-2" /> {domain}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default ProspectEnrichmentCard;

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2, Building2, TrendingUp, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tenant } from '@/data/mockData';

type EnrichmentData = {
  industry?: string;
  employeeCount?: string;
  companySize?: string;
  headquarters?: string;
  description?: string;
  creSignals?: string[];
  confidenceScore?: number;
};

interface Props {
  tenants: Tenant[];
  buildingName: string;
}

export default function AutoEnrichBadges({ tenants, buildingName }: Props) {
  const [enriched, setEnriched] = useState<Record<string, EnrichmentData>>({});
  const [enriching, setEnriching] = useState<Set<string>>(new Set());
  const runRef = useRef(false);

  const enrichTenant = useCallback(async (tenant: Tenant) => {
    if (enriched[tenant.id] || enriching.has(tenant.id)) return;

    setEnriching(prev => new Set(prev).add(tenant.id));

    try {
      const { data, error } = await supabase.functions.invoke('enrich-prospect', {
        body: {
          companyName: tenant.name,
          address: buildingName,
        },
      });

      if (error) throw error;

      if (data?.enrichment) {
        setEnriched(prev => ({ ...prev, [tenant.id]: data.enrichment }));
      }
    } catch (err: any) {
      // Silently fail for auto-enrich — don't spam user with errors
      console.warn(`Auto-enrich failed for ${tenant.name}:`, err.message);
    } finally {
      setEnriching(prev => {
        const n = new Set(prev);
        n.delete(tenant.id);
        return n;
      });
    }
  }, [enriched, enriching, buildingName]);

  useEffect(() => {
    if (runRef.current) return;
    runRef.current = true;

    // Auto-enrich up to 3 non-client tenants, staggered
    const candidates = tenants.filter(t => !t.isClient).slice(0, 3);
    candidates.forEach((tenant, i) => {
      setTimeout(() => enrichTenant(tenant), i * 2000); // 2s stagger
    });

    return () => { runRef.current = false; };
  }, [tenants]);

  const enrichedEntries = Object.entries(enriched);
  if (enrichedEntries.length === 0 && enriching.size === 0) return null;

  return (
    <div className="mb-3 rounded-md border border-primary/15 bg-primary/5 p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Auto-Enriched Intel</span>
        {enriching.size > 0 && (
          <Loader2 className="h-3 w-3 animate-spin text-primary ml-auto" />
        )}
      </div>
      <div className="space-y-2">
        {enrichedEntries.map(([tenantId, data]) => {
          const tenant = tenants.find(t => t.id === tenantId);
          if (!tenant) return null;
          return (
            <motion.div
              key={tenantId}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-md bg-card/60 p-2 border border-border/50"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-[11px] font-semibold text-foreground">{tenant.name}</p>
                {data.companySize && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                    {data.companySize}
                  </Badge>
                )}
              </div>
              {data.description && (
                <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1">{data.description}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {data.employeeCount && (
                  <span className="text-[9px] bg-secondary/50 text-muted-foreground rounded-full px-1.5 py-0.5">
                    👥 {data.employeeCount}
                  </span>
                )}
                {data.headquarters && (
                  <span className="text-[9px] bg-secondary/50 text-muted-foreground rounded-full px-1.5 py-0.5">
                    📍 {data.headquarters}
                  </span>
                )}
                {data.industry && (
                  <span className="text-[9px] bg-secondary/50 text-muted-foreground rounded-full px-1.5 py-0.5">
                    🏢 {data.industry}
                  </span>
                )}
              </div>
              {data.creSignals && data.creSignals.length > 0 && (
                <div className="mt-1.5 flex items-start gap-1">
                  <TrendingUp className="h-2.5 w-2.5 text-primary mt-0.5 shrink-0" />
                  <p className="text-[10px] text-primary font-medium line-clamp-1">{data.creSignals[0]}</p>
                </div>
              )}
            </motion.div>
          );
        })}
        {Array.from(enriching).map(id => {
          const tenant = tenants.find(t => t.id === id);
          if (!tenant || enriched[id]) return null;
          return (
            <div key={id} className="flex items-center gap-2 rounded-md bg-card/40 p-2 border border-border/30">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground">Enriching {tenant.name}...</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

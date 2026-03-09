import { TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { tenantEnrichments, type TenantEnrichment } from '@/data/activityData';

const signalIcons: Record<string, typeof TrendingUp> = {
  hiring: TrendingUp,
  layoffs: TrendingDown,
  funding: DollarSign,
  earnings: DollarSign,
};

const signalColors: Record<string, string> = {
  hiring: 'text-success',
  layoffs: 'text-destructive',
  funding: 'text-primary',
  earnings: 'text-info',
};

interface Props {
  tenantId: string;
  tenantName: string;
  headcount: number;
  sqft: number;
}

const TenantEnrichmentCard = ({ tenantId, tenantName, headcount, sqft }: Props) => {
  const enrichment = tenantEnrichments[tenantId];
  if (!enrichment) return null;

  const actualSpe = Math.round(sqft / headcount);
  const diff = actualSpe - enrichment.marketAvgSpacePerEmployee;
  const diffPct = Math.round((diff / enrichment.marketAvgSpacePerEmployee) * 100);

  return (
    <div className="space-y-3">
      {/* Space Calculator */}
      <Card className="border-border bg-card p-3">
        <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> SPACE EFFICIENCY
        </h4>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-secondary p-2">
            <p className="text-lg font-bold text-foreground">{actualSpe}</p>
            <p className="text-[10px] text-muted-foreground">SF/Employee</p>
          </div>
          <div className="rounded-md bg-secondary p-2">
            <p className="text-lg font-bold text-foreground">{enrichment.marketAvgSpacePerEmployee}</p>
            <p className="text-[10px] text-muted-foreground">Market Avg</p>
          </div>
          <div className="rounded-md bg-secondary p-2">
            <p className={`text-lg font-bold ${diff > 30 ? 'text-warning' : diff < -10 ? 'text-info' : 'text-foreground'}`}>
              {diff > 0 ? '+' : ''}{diffPct}%
            </p>
            <p className="text-[10px] text-muted-foreground">vs Market</p>
          </div>
        </div>
        {diff > 30 && (
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-warning/10 px-2 py-1.5">
            <AlertTriangle className="h-3 w-3 text-warning" />
            <p className="text-[11px] text-warning">
              {tenantName} uses {diffPct}% more space per employee than market average — potential contraction candidate
            </p>
          </div>
        )}
      </Card>

      {/* Financial Signals */}
      {enrichment.financialSignals.length > 0 && (
        <Card className="border-border bg-card p-3">
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">📊 FINANCIAL SIGNALS</h4>
          <div className="space-y-2">
            {enrichment.financialSignals.map((signal, i) => {
              const Icon = signalIcons[signal.type] || TrendingUp;
              return (
                <div key={i} className="flex items-start gap-2">
                  <Icon className={`mt-0.5 h-3.5 w-3.5 ${signalColors[signal.type]}`} />
                  <div>
                    <p className="text-xs font-medium text-foreground">{signal.title}</p>
                    <p className="text-[11px] text-muted-foreground">{signal.date}</p>
                  </div>
                  <Badge variant="outline" className={`ml-auto text-[9px] capitalize ${signalColors[signal.type]}`}>
                    {signal.type}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

export default TenantEnrichmentCard;

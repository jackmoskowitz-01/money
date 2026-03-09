import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, User, Building2, Clock, Copy, Check, AlertTriangle } from 'lucide-react';
import { buildings, newsItems, getUrgencyColor } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const TenantDetail = () => {
  const { buildingId, tenantId } = useParams();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const building = buildings.find(b => b.id === buildingId);
  const tenant = building?.tenants.find(t => t.id === tenantId);

  if (!building || !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-14">
        <p className="text-muted-foreground">Tenant not found</p>
      </div>
    );
  }

  const relatedNews = newsItems.filter(
    n => n.relatedTenants?.includes(tenantId!) || n.relatedBuildings?.includes(buildingId!)
  );

  const generateOutreach = (reasonIndex: number) => {
    const reason = tenant.outreachReasons[reasonIndex];
    return `Hi ${tenant.contactName},\n\nI hope this message finds you well. I'm reaching out regarding ${tenant.name}'s space at ${building.name}.\n\n${reason.description}\n\nI'd love to discuss how we can help ${tenant.name} evaluate your options and ensure you're positioned for the best outcome. Would you have 15 minutes this week for a brief call?\n\nBest regards`;
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/map" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Map
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{tenant.name}</h1>
              <p className="text-muted-foreground">{building.name} · {tenant.industry}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              {tenant.outreachReasons.filter(r => r.urgency === 'high').length} urgent signals
            </Badge>
          </div>

          {/* Quick Info */}
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: Building2, label: 'Space', value: `${tenant.sqft.toLocaleString()} SF` },
              { icon: Clock, label: 'Lease Expires', value: tenant.leaseExpiration },
              { icon: User, label: 'Headcount', value: String(tenant.headcount) },
              { icon: Mail, label: 'Contact', value: tenant.contactName },
            ].map(item => (
              <Card key={item.label} className="border-border bg-card p-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <item.icon className="h-4 w-4" />
                  <span className="text-xs">{item.label}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
              </Card>
            ))}
          </div>

          {/* Outreach Reasons */}
          <h2 className="mb-4 text-lg font-semibold">Outreach Reasons</h2>
          <div className="mb-8 space-y-4">
            {tenant.outreachReasons.map((reason, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    {reason.urgency === 'high' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    <h3 className="text-sm font-semibold text-foreground">{reason.title}</h3>
                    <Badge variant="outline" className={`ml-auto text-[10px] ${getUrgencyColor(reason.urgency)}`}>
                      {reason.urgency}
                    </Badge>
                  </div>
                  <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{reason.description}</p>

                  {/* Generated Outreach */}
                  <div className="rounded-md border border-border bg-secondary/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-medium text-muted-foreground">SUGGESTED OUTREACH</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleCopy(generateOutreach(i), `outreach-${i}`)}
                      >
                        {copiedId === `outreach-${i}` ? (
                          <><Check className="mr-1 h-3 w-3" /> Copied</>
                        ) : (
                          <><Copy className="mr-1 h-3 w-3" /> Copy</>
                        )}
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
                      {generateOutreach(i)}
                    </pre>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Related News */}
          {relatedNews.length > 0 && (
            <>
              <h2 className="mb-4 text-lg font-semibold">Related News</h2>
              <div className="space-y-3">
                {relatedNews.map(news => (
                  <Card key={news.id} className="border-border bg-card p-3">
                    <p className="text-sm font-semibold text-foreground">{news.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{news.summary}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/60">{news.source} · {news.date}</p>
                  </Card>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default TenantDetail;

import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, User, Building2, Clock, Copy, Check, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
import { buildings, newsItems, getUrgencyColor } from '@/data/mockData';
import { updatePipelineStage, getOrCreatePipelineItem, stageLabels, stageColors, type PipelineStage } from '@/data/pipelineData';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const stages: PipelineStage[] = ['not_contacted', 'contacted', 'meeting_set', 'proposal_sent', 'won', 'lost'];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-outreach`;

const TenantDetail = () => {
  const { buildingId, tenantId } = useParams();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [aiEmails, setAiEmails] = useState<Record<number, string>>({});
  const [aiLoading, setAiLoading] = useState<number | null>(null);
  const [currentStage, setCurrentStage] = useState<PipelineStage>('not_contacted');
  const { toast } = useToast();

  const building = buildings.find(b => b.id === buildingId);
  const tenant = building?.tenants.find(t => t.id === tenantId);

  useEffect(() => {
    if (tenantId && buildingId) {
      const item = getOrCreatePipelineItem(tenantId, buildingId);
      setCurrentStage(item.stage);
    }
  }, [tenantId, buildingId]);

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

  const generateStaticOutreach = (reasonIndex: number) => {
    const reason = tenant.outreachReasons[reasonIndex];
    return `Hi ${tenant.contactName},\n\nI hope this message finds you well. I'm reaching out regarding ${tenant.name}'s space at ${building.name}.\n\n${reason.description}\n\nI'd love to discuss how we can help ${tenant.name} evaluate your options and ensure you're positioned for the best outcome. Would you have 15 minutes this week for a brief call?\n\nBest regards`;
  };

  const generateAIOutreach = async (reasonIndex: number) => {
    const reason = tenant.outreachReasons[reasonIndex];
    setAiLoading(reasonIndex);
    setAiEmails(prev => ({ ...prev, [reasonIndex]: '' }));

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          tenantName: tenant.name,
          buildingName: building.name,
          contactName: tenant.contactName,
          contactTitle: tenant.contactTitle,
          industry: tenant.industry,
          sqft: tenant.sqft,
          leaseExpiration: tenant.leaseExpiration,
          outreachReason: `${reason.title}: ${reason.description}`,
          vacancyRate: building.vacancyRate,
          headcount: tenant.headcount,
        }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) {
          toast({ title: 'Rate Limited', description: 'Please try again in a moment.', variant: 'destructive' });
        } else if (resp.status === 402) {
          toast({ title: 'Credits Exhausted', description: 'Please add AI credits in Settings.', variant: 'destructive' });
        } else {
          toast({ title: 'Error', description: 'Failed to generate email.', variant: 'destructive' });
        }
        setAiLoading(null);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullText += content;
              setAiEmails(prev => ({ ...prev, [reasonIndex]: fullText }));
            }
          } catch { /* partial JSON, wait */ }
        }
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to generate AI email.', variant: 'destructive' });
    }
    setAiLoading(null);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStageChange = (stage: PipelineStage) => {
    updatePipelineStage(tenantId!, buildingId!, stage);
    setCurrentStage(stage);
  };

  return (
    <div className="min-h-screen pt-14">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/map" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Map
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{tenant.name}</h1>
              <p className="text-muted-foreground">{building.name} · {tenant.industry}</p>
            </div>
            <Badge variant="outline" className="text-xs">
              {tenant.outreachReasons.filter(r => r.urgency === 'high').length} urgent signals
            </Badge>
          </div>

          {/* Pipeline Stage */}
          <Card className="mb-6 border-border bg-card p-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Pipeline Stage:</span>
              <select
                value={currentStage}
                onChange={e => handleStageChange(e.target.value as PipelineStage)}
                className="rounded-md border border-border bg-secondary/50 px-2 py-1 text-xs font-medium text-foreground"
              >
                {stages.map(s => (
                  <option key={s} value={s}>{stageLabels[s]}</option>
                ))}
              </select>
              <Badge variant="outline" className={`text-[10px] ${stageColors[currentStage]}`}>
                {stageLabels[currentStage]}
              </Badge>
            </div>
          </Card>

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

                  {/* AI Generate Button */}
                  <div className="mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => generateAIOutreach(i)}
                      disabled={aiLoading === i}
                    >
                      {aiLoading === i ? (
                        <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Generating...</>
                      ) : (
                        <><Sparkles className="mr-1.5 h-3 w-3" /> Generate AI Email</>
                      )}
                    </Button>
                  </div>

                  {/* AI Generated Email */}
                  {aiEmails[i] && (
                    <div className="mb-3 rounded-md border border-primary/20 bg-primary/5 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-medium text-primary">✨ AI-GENERATED OUTREACH</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleCopy(aiEmails[i], `ai-${i}`)}
                        >
                          {copiedId === `ai-${i}` ? (
                            <><Check className="mr-1 h-3 w-3" /> Copied</>
                          ) : (
                            <><Copy className="mr-1 h-3 w-3" /> Copy</>
                          )}
                        </Button>
                      </div>
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
                        {aiEmails[i]}
                        {aiLoading === i && <span className="animate-pulse">▊</span>}
                      </pre>
                    </div>
                  )}

                  {/* Static Template */}
                  <div className="rounded-md border border-border bg-secondary/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-medium text-muted-foreground">TEMPLATE OUTREACH</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleCopy(generateStaticOutreach(i), `outreach-${i}`)}
                      >
                        {copiedId === `outreach-${i}` ? (
                          <><Check className="mr-1 h-3 w-3" /> Copied</>
                        ) : (
                          <><Copy className="mr-1 h-3 w-3" /> Copy</>
                        )}
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
                      {generateStaticOutreach(i)}
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

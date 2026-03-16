import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Mail, BarChart3, TrendingUp, Clock, ShieldCheck, AlertTriangle,
  ArrowRight, Filter, MessageSquare, Sparkles, ThumbsUp, ThumbsDown,
  Zap, Eye, Send, RefreshCw, ChevronDown
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEmailThreads, type EmailThread, type ResponseAnalytics } from '@/hooks/useEmailThreads';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CLASSIFY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/classify-reply`;

const sentimentConfig: Record<string, { color: string; icon: typeof ThumbsUp; label: string }> = {
  positive: { color: 'text-emerald-400', icon: ThumbsUp, label: 'Positive' },
  interested: { color: 'text-blue-400', icon: Sparkles, label: 'Interested' },
  neutral: { color: 'text-muted-foreground', icon: MessageSquare, label: 'Neutral' },
  negative: { color: 'text-red-400', icon: ThumbsDown, label: 'Negative' },
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    sent: 'bg-muted text-muted-foreground',
    replied: 'bg-emerald-500/20 text-emerald-400',
    spam: 'bg-red-500/20 text-red-400',
    meeting_set: 'bg-blue-500/20 text-blue-400',
    closed: 'bg-primary/20 text-primary',
  };
  return map[status] || map.sent;
};

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: typeof Mail; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${accent || 'bg-primary/10'}`}>
          <Icon className={`h-5 w-5 ${accent ? 'text-white' : 'text-primary'}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

function RateBar({ label, sent, replied, rate }: { label: string; sent: number; replied: number; rate: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-sm text-foreground w-32 truncate" title={label}>{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2.5 relative overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(rate, 100)}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 bg-primary rounded-full"
        />
      </div>
      <span className="text-sm font-medium text-foreground w-12 text-right">{rate}%</span>
      <span className="text-xs text-muted-foreground w-20 text-right">{replied}/{sent}</span>
    </div>
  );
}

export default function EmailAnalytics() {
  const { threads, loading, recordReply, getAnalytics, updateThreadStatus } = useEmailThreads();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [classifying, setClassifying] = useState<string | null>(null);

  const analytics = useMemo(() => getAnalytics(), [getAnalytics]);

  const filteredThreads = useMemo(() => {
    let list = threads;
    if (filterStatus !== 'all') list = list.filter(t => t.threadStatus === filterStatus);
    return list;
  }, [threads, filterStatus]);

  const handleSimulateReply = async (thread: EmailThread, replyText: string) => {
    setClassifying(thread.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Please log in'); return; }

      // Classify the reply
      const classRes = await fetch(CLASSIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: 'classify',
          replyContent: replyText,
          originalSubject: thread.subject,
          originalBody: thread.bodyPreview,
          prospectName: thread.prospectName,
          prospectEmail: thread.prospectEmail,
          industry: thread.industry,
        }),
      });
      const classification = await classRes.json();

      // Get suggested replies if relevant
      let suggestions: any[] = [];
      if (classification.is_relevant) {
        const sugRes = await fetch(CLASSIFY_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: 'suggest_replies',
            replyContent: replyText,
            originalSubject: thread.subject,
            originalBody: thread.bodyPreview,
            prospectName: thread.prospectName,
            industry: thread.industry,
            sentiment: classification.sentiment,
          }),
        });
        const sugData = await sugRes.json();
        suggestions = sugData.suggestions || [];
      }

      await recordReply(thread.id, replyText, classification, suggestions);

      if (classification.is_relevant) {
        toast.success(`Reply classified: ${classification.sentiment} — ${classification.suggested_action}`);
      } else {
        toast.info(`Filtered as spam: ${classification.spam_reason}`);
      }
    } catch (e) {
      toast.error('Classification failed');
    } finally {
      setClassifying(null);
    }
  };

  const sortedTemplates = useMemo(() =>
    Object.entries(analytics.byTemplate)
      .filter(([k]) => k && k !== 'Unknown')
      .sort((a, b) => b[1].rate - a[1].rate),
  [analytics]);

  const sortedTones = useMemo(() =>
    Object.entries(analytics.byTone)
      .filter(([k]) => k && k !== 'Unknown')
      .sort((a, b) => b[1].rate - a[1].rate),
  [analytics]);

  const sortedIndustries = useMemo(() =>
    Object.entries(analytics.byIndustry)
      .filter(([k]) => k && k !== 'Unknown')
      .sort((a, b) => b[1].rate - a[1].rate),
  [analytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 pt-20 pb-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Email Intelligence
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Response tracking, spam filtering & AI-powered analytics
            </p>
          </div>
          <Badge variant="outline" className="text-xs gap-1">
            <ShieldCheck className="h-3 w-3" />
            {analytics.spamFiltered} spam filtered
          </Badge>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Send} label="Emails Sent" value={analytics.totalSent} />
          <StatCard icon={MessageSquare} label="Replies" value={analytics.relevantReplies}
            sub={`${analytics.responseRate}% response rate`} accent="bg-emerald-500/20" />
          <StatCard icon={Clock} label="Avg Response" value={`${analytics.avgResponseTimeHours}h`}
            sub="time to reply" />
          <StatCard icon={ShieldCheck} label="Spam Filtered" value={analytics.spamFiltered}
            sub="auto-replies & junk" accent="bg-red-500/10" />
        </div>

        <Tabs defaultValue="performance" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="threads">All Threads ({threads.length})</TabsTrigger>
            <TabsTrigger value="replies">Replies ({analytics.relevantReplies})</TabsTrigger>
          </TabsList>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* By Template */}
              <Card className="p-4 bg-card border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" /> Response Rate by Template
                </h3>
                {sortedTemplates.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">No template data yet — send some outreach to start tracking</p>
                ) : sortedTemplates.map(([name, data]) => (
                  <RateBar key={name} label={name} sent={data.sent} replied={data.replied} rate={data.rate} />
                ))}
              </Card>

              {/* By Tone */}
              <Card className="p-4 bg-card border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> Response Rate by Tone
                </h3>
                {sortedTones.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">No tone data yet</p>
                ) : sortedTones.map(([name, data]) => (
                  <RateBar key={name} label={name} sent={data.sent} replied={data.replied} rate={data.rate} />
                ))}
              </Card>

              {/* By Industry */}
              <Card className="p-4 bg-card border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Response Rate by Industry
                </h3>
                {sortedIndustries.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">No industry data yet</p>
                ) : sortedIndustries.map(([name, data]) => (
                  <RateBar key={name} label={name} sent={data.sent} replied={data.replied} rate={data.rate} />
                ))}
              </Card>

              {/* Sentiment Breakdown */}
              <Card className="p-4 bg-card border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" /> Reply Sentiment
                </h3>
                {Object.keys(analytics.bySentiment).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">No replies analyzed yet</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(analytics.bySentiment).map(([sentiment, count]) => {
                      const config = sentimentConfig[sentiment] || sentimentConfig.neutral;
                      const Icon = config.icon;
                      return (
                        <div key={sentiment} className="flex items-center gap-3">
                          <Icon className={`h-4 w-4 ${config.color}`} />
                          <span className="text-sm text-foreground capitalize flex-1">{config.label}</span>
                          <span className="text-sm font-medium text-foreground">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Threads Tab */}
          <TabsContent value="threads" className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                  <SelectItem value="meeting_set">Meeting Set</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredThreads.length === 0 ? (
              <Card className="p-8 bg-card border-border text-center">
                <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No tracked emails yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Emails sent via the outreach composer will automatically appear here
                </p>
              </Card>
            ) : filteredThreads.map(thread => (
              <Card key={thread.id} className="p-4 bg-card border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {thread.prospectName}
                      </span>
                      <Badge className={`text-[10px] ${statusBadge(thread.threadStatus)}`}>
                        {thread.threadStatus.replace('_', ' ')}
                      </Badge>
                      {thread.replySentiment && sentimentConfig[thread.replySentiment] && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          {(() => {
                            const cfg = sentimentConfig[thread.replySentiment];
                            const SIcon = cfg.icon;
                            return <><SIcon className={`h-3 w-3 ${cfg.color}`} />{cfg.label}</>;
                          })()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{thread.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {thread.prospectEmail} · {thread.industry || 'N/A'} · Sent {new Date(thread.sentAt).toLocaleDateString()}
                    </p>
                    {thread.replyDetected && thread.isRelevant && thread.responseTimeHours !== null && (
                      <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Replied in {thread.responseTimeHours}h
                      </p>
                    )}
                    {!thread.isRelevant && thread.spamReason && (
                      <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Filtered: {thread.spamReason}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {thread.threadStatus === 'replied' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => updateThreadStatus(thread.id, 'meeting_set')}
                      >
                        <Zap className="h-3 w-3 mr-1" /> Mark Meeting Set
                      </Button>
                    )}
                  </div>
                </div>

                {/* AI Suggested Replies */}
                {thread.aiSuggestedReplies.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" /> AI Suggested Replies
                    </p>
                    <div className="grid gap-2">
                      {thread.aiSuggestedReplies.map((sug: any, i: number) => (
                        <div key={i} className="bg-muted/50 rounded-lg p-2.5">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px] capitalize">{sug.style}</Badge>
                            <span className="text-xs text-muted-foreground">Re: {sug.subject}</span>
                          </div>
                          <p className="text-xs text-foreground">{sug.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </TabsContent>

          {/* Replies Tab */}
          <TabsContent value="replies" className="space-y-3">
            {analytics.recentReplies.length === 0 ? (
              <Card className="p-8 bg-card border-border text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No replies tracked yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  When prospects reply, AI will classify and suggest responses
                </p>
              </Card>
            ) : analytics.recentReplies.map(thread => (
              <Card key={thread.id} className="p-4 bg-card border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-foreground">{thread.prospectName}</span>
                  {thread.replySentiment && sentimentConfig[thread.replySentiment] && (() => {
                    const cfg = sentimentConfig[thread.replySentiment!];
                    const SIcon = cfg.icon;
                    return <Badge variant="outline" className="text-[10px] gap-1">
                      <SIcon className={`h-3 w-3 ${cfg.color}`} />{cfg.label}
                    </Badge>;
                  })()}
                </div>
                <p className="text-xs text-muted-foreground mb-2">Re: {thread.subject}</p>
                {thread.replyContent && (
                  <div className="bg-muted/30 rounded-lg p-3 text-xs text-foreground">
                    {thread.replyContent.substring(0, 300)}
                    {thread.replyContent.length > 300 && '...'}
                  </div>
                )}
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

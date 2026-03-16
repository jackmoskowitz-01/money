import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type EmailThread = {
  id: string;
  prospectName: string;
  prospectEmail: string;
  subject: string;
  bodyPreview: string;
  templateUsed: string;
  toneUsed: string;
  outreachReason: string;
  industry: string;
  sentAt: string;
  replyDetected: boolean;
  replyAt: string | null;
  replyContent: string | null;
  replySentiment: string | null;
  isRelevant: boolean;
  relevanceScore: number;
  spamReason: string | null;
  aiSuggestedReplies: any[];
  responseTimeHours: number | null;
  threadStatus: string;
  tenantId: string | null;
  buildingId: string | null;
};

type DbRow = {
  id: string;
  user_id: string;
  tenant_id: string | null;
  building_id: string | null;
  prospect_name: string;
  prospect_email: string;
  subject: string;
  body_preview: string;
  template_used: string;
  tone_used: string;
  outreach_reason: string;
  industry: string;
  sent_at: string;
  reply_detected: boolean;
  reply_at: string | null;
  reply_content: string | null;
  reply_sentiment: string | null;
  is_relevant: boolean;
  relevance_score: number;
  spam_reason: string | null;
  ai_suggested_replies: any;
  response_time_hours: number | null;
  thread_status: string;
  activity_id: string | null;
  created_at: string;
  updated_at: string;
};

const rowToThread = (r: DbRow): EmailThread => ({
  id: r.id,
  prospectName: r.prospect_name,
  prospectEmail: r.prospect_email,
  subject: r.subject,
  bodyPreview: r.body_preview,
  templateUsed: r.template_used,
  toneUsed: r.tone_used,
  outreachReason: r.outreach_reason,
  industry: r.industry,
  sentAt: r.sent_at,
  replyDetected: r.reply_detected,
  replyAt: r.reply_at,
  replyContent: r.reply_content,
  replySentiment: r.reply_sentiment,
  isRelevant: r.is_relevant,
  relevanceScore: r.relevance_score,
  spamReason: r.spam_reason,
  aiSuggestedReplies: Array.isArray(r.ai_suggested_replies) ? r.ai_suggested_replies : [],
  responseTimeHours: r.response_time_hours,
  threadStatus: r.thread_status,
  tenantId: r.tenant_id,
  buildingId: r.building_id,
});

export type ResponseAnalytics = {
  totalSent: number;
  totalReplies: number;
  relevantReplies: number;
  spamFiltered: number;
  responseRate: number;
  avgResponseTimeHours: number;
  byTemplate: Record<string, { sent: number; replied: number; rate: number }>;
  byTone: Record<string, { sent: number; replied: number; rate: number }>;
  byIndustry: Record<string, { sent: number; replied: number; rate: number }>;
  bySentiment: Record<string, number>;
  recentReplies: EmailThread[];
};

export function useEmailThreads() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('email_threads')
      .select('*')
      .order('sent_at', { ascending: false });

    if (error) {
      console.error('Error fetching email threads:', error);
      return;
    }
    setThreads((data as unknown as DbRow[]).map(rowToThread));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const logOutreach = useCallback(async (data: {
    prospectName: string;
    prospectEmail: string;
    subject: string;
    bodyPreview: string;
    templateUsed?: string;
    toneUsed?: string;
    outreachReason?: string;
    industry?: string;
    tenantId?: string;
    buildingId?: string;
    activityId?: string;
  }) => {
    if (!user) return;
    const row = {
      user_id: user.id,
      prospect_name: data.prospectName,
      prospect_email: data.prospectEmail,
      subject: data.subject,
      body_preview: data.bodyPreview.substring(0, 500),
      template_used: data.templateUsed || '',
      tone_used: data.toneUsed || '',
      outreach_reason: data.outreachReason || '',
      industry: data.industry || '',
      tenant_id: data.tenantId || null,
      building_id: data.buildingId || null,
      activity_id: data.activityId || null,
    };

    const { error } = await supabase.from('email_threads').insert(row);
    if (!error) {
      fetchThreads();
      // Auto-digest: feed email send to AI brain
      const { digestEvent } = await import('@/lib/autoDigest');
      digestEvent('email_sent', {
        prospect: data.prospectName,
        email: data.prospectEmail,
        subject: data.subject,
        template: data.templateUsed || 'custom',
        tone: data.toneUsed || 'professional',
        reason: data.outreachReason || '',
        industry: data.industry || '',
        bodyPreview: data.bodyPreview.substring(0, 200),
      });
    }
    return !error;
  }, [user, fetchThreads]);

  const recordReply = useCallback(async (threadId: string, replyContent: string, classification: {
    is_relevant: boolean;
    spam_reason?: string;
    sentiment: string;
    urgency: string;
    suggested_action: string;
  }, suggestedReplies: any[] = []) => {
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;

    const replyAt = new Date().toISOString();
    const sentAt = new Date(thread.sentAt).getTime();
    const responseTimeHours = (Date.now() - sentAt) / (1000 * 60 * 60);

    const { error } = await supabase
      .from('email_threads')
      .update({
        reply_detected: true,
        reply_at: replyAt,
        reply_content: replyContent,
        reply_sentiment: classification.sentiment,
        is_relevant: classification.is_relevant,
        spam_reason: classification.spam_reason || null,
        relevance_score: classification.is_relevant ? 1 : 0,
        ai_suggested_replies: suggestedReplies,
        response_time_hours: Math.round(responseTimeHours * 10) / 10,
        thread_status: classification.is_relevant ? 'replied' : 'spam',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', threadId);

    if (!error) fetchThreads();
  }, [threads, fetchThreads]);

  const getAnalytics = useCallback((): ResponseAnalytics => {
    const totalSent = threads.length;
    const replied = threads.filter(t => t.replyDetected);
    const relevant = replied.filter(t => t.isRelevant);
    const spam = replied.filter(t => !t.isRelevant);

    const avgTime = relevant.length > 0
      ? relevant.reduce((sum, t) => sum + (t.responseTimeHours || 0), 0) / relevant.length
      : 0;

    const groupBy = (key: 'templateUsed' | 'toneUsed' | 'industry') => {
      const map: Record<string, { sent: number; replied: number; rate: number }> = {};
      threads.forEach(t => {
        const val = t[key] || 'Unknown';
        if (!map[val]) map[val] = { sent: 0, replied: 0, rate: 0 };
        map[val].sent++;
        if (t.replyDetected && t.isRelevant) map[val].replied++;
      });
      Object.values(map).forEach(v => { v.rate = v.sent > 0 ? Math.round((v.replied / v.sent) * 100) : 0; });
      return map;
    };

    const bySentiment: Record<string, number> = {};
    relevant.forEach(t => {
      const s = t.replySentiment || 'unknown';
      bySentiment[s] = (bySentiment[s] || 0) + 1;
    });

    return {
      totalSent,
      totalReplies: replied.length,
      relevantReplies: relevant.length,
      spamFiltered: spam.length,
      responseRate: totalSent > 0 ? Math.round((relevant.length / totalSent) * 100) : 0,
      avgResponseTimeHours: Math.round(avgTime * 10) / 10,
      byTemplate: groupBy('templateUsed'),
      byTone: groupBy('toneUsed'),
      byIndustry: groupBy('industry'),
      bySentiment,
      recentReplies: relevant.filter(t => t.replyDetected).slice(0, 10),
    };
  }, [threads]);

  const updateThreadStatus = useCallback(async (threadId: string, status: string) => {
    await supabase
      .from('email_threads')
      .update({ thread_status: status, updated_at: new Date().toISOString() } as any)
      .eq('id', threadId);
    fetchThreads();
  }, [fetchThreads]);

  return { threads, loading, logOutreach, recordReply, getAnalytics, updateThreadStatus, refetch: fetchThreads };
}

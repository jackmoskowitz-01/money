import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type IntelligenceData = {
  emailStats: {
    totalSent: number;
    replyRate: number;
    avgResponseHours: number;
    bestTemplates: { template: string; replyRate: number; count: number }[];
    bestTones: { tone: string; replyRate: number; count: number }[];
    bestReasons: { reason: string; replyRate: number; count: number }[];
    industryPerformance: { industry: string; replyRate: number; count: number }[];
    sentimentBreakdown: { positive: number; neutral: number; negative: number };
  };
  activityPatterns: {
    totalActivities: number;
    byType: Record<string, number>;
    byDayOfWeek: Record<string, number>;
    byHour: Record<string, number>;
    mostActiveProspects: { tenantId: string; count: number }[];
    weeklyTrend: { week: string; count: number }[];
  };
  dealPatterns: {
    totalDeals: number;
    stageDistribution: Record<string, number>;
    avgTouchpointsToWin: number;
    avgDaysToWin: number;
    winRate: number;
    outcomeReasons: { reason: string; count: number }[];
    staleDealCount: number;
  };
  scoopTrends: {
    totalScoops: number;
    byCategory: Record<string, number>;
    topTags: { tag: string; count: number }[];
    recentHighlights: string[];
    verifiedPct: number;
  };
  contactDensity: {
    totalContacts: number;
    prospectContactCounts: Record<string, number>;
  };
  styleFingerprint: {
    avgWordCount: number;
    dominantTone: string;
    toneDistribution: Record<string, number>;
  };
  generatedAt: string;
};

const CACHE_KEY = 'intelligence-cache';
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

function getCached(): IntelligenceData | null {
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

function setCache(data: IntelligenceData) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
}

export function useIntelligence() {
  const [data, setData] = useState<IntelligenceData | null>(getCached);
  const [loading, setLoading] = useState(false);

  const fetch_ = async (force = false) => {
    if (!force) {
      const cached = getCached();
      if (cached) { setData(cached); return; }
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/intelligence-gather`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        }
      );
      if (!resp.ok) throw new Error('Failed to fetch intelligence');
      const result = await resp.json();
      setData(result);
      setCache(result);
    } catch (err) {
      console.error('Intelligence fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, []);

  return { intelligence: data, loading, refresh: () => fetch_(true) };
}

/** Format intelligence data as context string for the copilot */
export function formatIntelligenceContext(data: IntelligenceData): string {
  const parts: string[] = ['## 🧠 Intelligence Insights (auto-computed from your data)\n'];

  // Email performance
  if (data.emailStats.totalSent > 0) {
    parts.push(`### Email Performance (${data.emailStats.totalSent} emails analyzed)`);
    parts.push(`- Overall reply rate: ${data.emailStats.replyRate}%`);
    parts.push(`- Avg response time: ${data.emailStats.avgResponseHours}h`);
    if (data.emailStats.bestTemplates.length > 0) {
      parts.push(`- Top templates by reply rate: ${data.emailStats.bestTemplates.slice(0, 3).map(t => `"${t.template}" (${t.replyRate}%, n=${t.count})`).join(', ')}`);
    }
    if (data.emailStats.bestTones.length > 0) {
      parts.push(`- Best tones: ${data.emailStats.bestTones.slice(0, 3).map(t => `${t.tone} (${t.replyRate}%)`).join(', ')}`);
    }
    if (data.emailStats.bestReasons.length > 0) {
      parts.push(`- Best outreach reasons: ${data.emailStats.bestReasons.slice(0, 3).map(r => `"${r.reason}" (${r.replyRate}%)`).join(', ')}`);
    }
    if (data.emailStats.industryPerformance.length > 0) {
      parts.push(`- Industry response: ${data.emailStats.industryPerformance.slice(0, 3).map(i => `${i.industry} ${i.replyRate}%`).join(', ')}`);
    }
    const sent = data.emailStats.sentimentBreakdown;
    if (sent.positive + sent.negative + sent.neutral > 0) {
      parts.push(`- Reply sentiment: ${sent.positive} positive, ${sent.neutral} neutral, ${sent.negative} negative`);
    }
  }

  // Activity patterns
  if (data.activityPatterns.totalActivities > 0) {
    parts.push(`\n### Activity Patterns (${data.activityPatterns.totalActivities} activities)`);
    const topType = Object.entries(data.activityPatterns.byType).sort(([,a],[,b]) => b - a);
    if (topType.length > 0) parts.push(`- Activity mix: ${topType.slice(0, 4).map(([t,c]) => `${t}: ${c}`).join(', ')}`);
    const topDay = Object.entries(data.activityPatterns.byDayOfWeek).sort(([,a],[,b]) => b - a);
    if (topDay.length > 0) parts.push(`- Most active days: ${topDay.slice(0, 3).map(([d,c]) => `${d} (${c})`).join(', ')}`);
    const topHour = Object.entries(data.activityPatterns.byHour).sort(([,a],[,b]) => b - a);
    if (topHour.length > 0) parts.push(`- Peak hours: ${topHour.slice(0, 3).map(([h,c]) => `${h} (${c})`).join(', ')}`);
  }

  // Deal patterns
  if (data.dealPatterns.totalDeals > 0) {
    parts.push(`\n### Deal Patterns (${data.dealPatterns.totalDeals} deals)`);
    parts.push(`- Win rate: ${data.dealPatterns.winRate}%`);
    if (data.dealPatterns.avgTouchpointsToWin > 0) parts.push(`- Avg touchpoints to win: ${data.dealPatterns.avgTouchpointsToWin}`);
    if (data.dealPatterns.avgDaysToWin > 0) parts.push(`- Avg days to win: ${data.dealPatterns.avgDaysToWin}`);
    if (data.dealPatterns.staleDealCount > 0) parts.push(`- ⚠️ ${data.dealPatterns.staleDealCount} stale deals (7+ days no activity)`);
    if (data.dealPatterns.outcomeReasons.length > 0) {
      parts.push(`- Win/loss reasons: ${data.dealPatterns.outcomeReasons.slice(0, 5).map(r => `"${r.reason}" (${r.count}x)`).join(', ')}`);
    }
  }

  // Scoop trends
  if (data.scoopTrends.totalScoops > 0) {
    parts.push(`\n### Market Intel Trends (${data.scoopTrends.totalScoops} scoops)`);
    const cats = Object.entries(data.scoopTrends.byCategory).sort(([,a],[,b]) => b - a);
    if (cats.length > 0) parts.push(`- Top categories: ${cats.slice(0, 4).map(([c,n]) => `${c}: ${n}`).join(', ')}`);
    if (data.scoopTrends.topTags.length > 0) {
      parts.push(`- Trending tags: ${data.scoopTrends.topTags.slice(0, 5).map(t => `#${t.tag} (${t.count})`).join(', ')}`);
    }
    if (data.scoopTrends.recentHighlights.length > 0) {
      parts.push(`- Recent intel: ${data.scoopTrends.recentHighlights.slice(0, 3).join(' | ')}`);
    }
  }

  // Style
  if (data.styleFingerprint.avgWordCount > 0) {
    parts.push(`\n### Your Communication Style`);
    parts.push(`- Avg email length: ${data.styleFingerprint.avgWordCount} words`);
    parts.push(`- Dominant tone: ${data.styleFingerprint.dominantTone}`);
    parts.push(`- IMPORTANT: When drafting emails, match this style — use similar length and tone unless the user asks otherwise.`);
  }

  return parts.join('\n');
}

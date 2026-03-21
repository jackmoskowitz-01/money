import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ═══ 1. Email Performance Stats ═══
    const { data: threads } = await supabase
      .from("email_threads")
      .select("template_used, tone_used, outreach_reason, industry, reply_detected, reply_sentiment, response_time_hours, thread_status, sent_at")
      .order("sent_at", { ascending: false })
      .limit(500);

    const emailStats = {
      totalSent: threads?.length || 0,
      replyRate: 0,
      avgResponseHours: 0,
      bestTemplates: [] as { template: string; replyRate: number; count: number }[],
      bestTones: [] as { tone: string; replyRate: number; count: number }[],
      bestReasons: [] as { reason: string; replyRate: number; count: number }[],
      industryPerformance: [] as { industry: string; replyRate: number; count: number }[],
      sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
    };

    if (threads && threads.length > 0) {
      const replied = threads.filter((t: any) => t.reply_detected);
      emailStats.replyRate = Math.round((replied.length / threads.length) * 100);
      const responseTimes = replied.filter((t: any) => t.response_time_hours).map((t: any) => t.response_time_hours);
      emailStats.avgResponseHours = responseTimes.length > 0 ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length) : 0;

      // Best templates
      const templateMap: Record<string, { replies: number; total: number }> = {};
      threads.forEach((t: any) => {
        const key = t.template_used || "none";
        if (!templateMap[key]) templateMap[key] = { replies: 0, total: 0 };
        templateMap[key].total++;
        if (t.reply_detected) templateMap[key].replies++;
      });
      emailStats.bestTemplates = Object.entries(templateMap)
        .map(([template, { replies, total }]) => ({ template, replyRate: Math.round((replies / total) * 100), count: total }))
        .filter(t => t.count >= 3)
        .sort((a, b) => b.replyRate - a.replyRate)
        .slice(0, 5);

      // Best tones
      const toneMap: Record<string, { replies: number; total: number }> = {};
      threads.forEach((t: any) => {
        const key = t.tone_used || "default";
        if (!toneMap[key]) toneMap[key] = { replies: 0, total: 0 };
        toneMap[key].total++;
        if (t.reply_detected) toneMap[key].replies++;
      });
      emailStats.bestTones = Object.entries(toneMap)
        .map(([tone, { replies, total }]) => ({ tone, replyRate: Math.round((replies / total) * 100), count: total }))
        .filter(t => t.count >= 2)
        .sort((a, b) => b.replyRate - a.replyRate)
        .slice(0, 5);

      // Best outreach reasons
      const reasonMap: Record<string, { replies: number; total: number }> = {};
      threads.forEach((t: any) => {
        const key = t.outreach_reason || "none";
        if (!reasonMap[key]) reasonMap[key] = { replies: 0, total: 0 };
        reasonMap[key].total++;
        if (t.reply_detected) reasonMap[key].replies++;
      });
      emailStats.bestReasons = Object.entries(reasonMap)
        .map(([reason, { replies, total }]) => ({ reason, replyRate: Math.round((replies / total) * 100), count: total }))
        .filter(t => t.count >= 2 && t.reason !== "none")
        .sort((a, b) => b.replyRate - a.replyRate)
        .slice(0, 5);

      // Industry performance
      const industryMap: Record<string, { replies: number; total: number }> = {};
      threads.forEach((t: any) => {
        const key = t.industry || "Unknown";
        if (!industryMap[key]) industryMap[key] = { replies: 0, total: 0 };
        industryMap[key].total++;
        if (t.reply_detected) industryMap[key].replies++;
      });
      emailStats.industryPerformance = Object.entries(industryMap)
        .map(([industry, { replies, total }]) => ({ industry, replyRate: Math.round((replies / total) * 100), count: total }))
        .filter(t => t.count >= 2)
        .sort((a, b) => b.replyRate - a.replyRate);

      // Sentiment
      replied.forEach((t: any) => {
        if (t.reply_sentiment === "positive") emailStats.sentimentBreakdown.positive++;
        else if (t.reply_sentiment === "negative") emailStats.sentimentBreakdown.negative++;
        else emailStats.sentimentBreakdown.neutral++;
      });
    }

    // ═══ 2. Activity Pattern Insights ═══
    const { data: activities } = await supabase
      .from("activities")
      .select("type, timestamp, tenant_id")
      .order("timestamp", { ascending: false })
      .limit(500);

    const activityPatterns = {
      totalActivities: activities?.length || 0,
      byType: {} as Record<string, number>,
      byDayOfWeek: {} as Record<string, number>,
      byHour: {} as Record<string, number>,
      mostActiveProspects: [] as { tenantId: string; count: number }[],
      weeklyTrend: [] as { week: string; count: number }[],
    };

    if (activities && activities.length > 0) {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const prospectCounts: Record<string, number> = {};
      const weekCounts: Record<string, number> = {};

      activities.forEach((a: any) => {
        // By type
        activityPatterns.byType[a.type] = (activityPatterns.byType[a.type] || 0) + 1;
        // By day
        const d = new Date(a.timestamp);
        const day = days[d.getDay()];
        activityPatterns.byDayOfWeek[day] = (activityPatterns.byDayOfWeek[day] || 0) + 1;
        // By hour
        const hour = d.getHours().toString().padStart(2, "0") + ":00";
        activityPatterns.byHour[hour] = (activityPatterns.byHour[hour] || 0) + 1;
        // Prospect counts
        prospectCounts[a.tenant_id] = (prospectCounts[a.tenant_id] || 0) + 1;
        // Weekly
        const weekStart = new Date(d);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().split("T")[0];
        weekCounts[weekKey] = (weekCounts[weekKey] || 0) + 1;
      });

      activityPatterns.mostActiveProspects = Object.entries(prospectCounts)
        .map(([tenantId, count]) => ({ tenantId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      activityPatterns.weeklyTrend = Object.entries(weekCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-8)
        .map(([week, count]) => ({ week, count }));
    }

    // ═══ 3. Deal Outcome Patterns ═══
    const { data: deals } = await supabase.from("pipeline_deals").select("*");

    const dealPatterns = {
      totalDeals: deals?.length || 0,
      stageDistribution: {} as Record<string, number>,
      avgTouchpointsToWin: 0,
      avgDaysToWin: 0,
      winRate: 0,
      outcomeReasons: [] as { reason: string; count: number }[],
      staleDealCount: 0,
    };

    if (deals && deals.length > 0) {
      deals.forEach((d: any) => {
        dealPatterns.stageDistribution[d.stage] = (dealPatterns.stageDistribution[d.stage] || 0) + 1;
      });

      const wonDeals = deals.filter((d: any) => d.stage === "won" || d.outcome === "won");
      const lostDeals = deals.filter((d: any) => d.stage === "lost" || d.outcome === "lost");
      const decided = wonDeals.length + lostDeals.length;
      dealPatterns.winRate = decided > 0 ? Math.round((wonDeals.length / decided) * 100) : 0;

      if (wonDeals.length > 0) {
        dealPatterns.avgTouchpointsToWin = Math.round(
          wonDeals.reduce((sum: number, d: any) => sum + (Array.isArray(d.sent_touchpoints) ? d.sent_touchpoints.length : 0), 0) / wonDeals.length
        );
        dealPatterns.avgDaysToWin = Math.round(
          wonDeals.reduce((sum: number, d: any) => {
            const created = new Date(d.created_at).getTime();
            const updated = new Date(d.updated_at).getTime();
            return sum + (updated - created) / 86400000;
          }, 0) / wonDeals.length
        );
      }

      // Outcome reasons
      const reasonCounts: Record<string, number> = {};
      deals.filter((d: any) => d.outcome_reason).forEach((d: any) => {
        reasonCounts[d.outcome_reason] = (reasonCounts[d.outcome_reason] || 0) + 1;
      });
      dealPatterns.outcomeReasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

      // Stale deals
      dealPatterns.staleDealCount = deals.filter((d: any) => {
        if (["won", "lost", "closed"].includes(d.stage)) return false;
        return (Date.now() - new Date(d.last_activity).getTime()) / 86400000 > 7;
      }).length;
    }

    // ═══ 4. Scoop Trends ═══
    const { data: scoops } = await supabase
      .from("scoops")
      .select("category, tags, content, created_at, linked_tenant_name, verified")
      .order("created_at", { ascending: false })
      .limit(100);

    const scoopTrends = {
      totalScoops: scoops?.length || 0,
      byCategory: {} as Record<string, number>,
      topTags: [] as { tag: string; count: number }[],
      recentHighlights: [] as string[],
      verifiedPct: 0,
    };

    if (scoops && scoops.length > 0) {
      const tagCounts: Record<string, number> = {};
      let verified = 0;

      scoops.forEach((s: any) => {
        scoopTrends.byCategory[s.category] = (scoopTrends.byCategory[s.category] || 0) + 1;
        if (s.verified) verified++;
        (s.tags || []).forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      scoopTrends.verifiedPct = Math.round((verified / scoops.length) * 100);
      scoopTrends.topTags = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Recent highlights
      scoopTrends.recentHighlights = scoops.slice(0, 5).map((s: any) => {
        const tenant = s.linked_tenant_name ? ` (${s.linked_tenant_name})` : "";
        return `[${s.category}]${tenant}: ${s.content.slice(0, 120)}`;
      });
    }

    // ═══ 5. Contact Interaction Density ═══
    const { data: contacts } = await supabase.from("company_contacts").select("entity_id, name").limit(500);

    const contactDensity = {
      totalContacts: contacts?.length || 0,
      prospectContactCounts: {} as Record<string, number>,
    };

    if (contacts) {
      contacts.forEach((c: any) => {
        contactDensity.prospectContactCounts[c.entity_id] = (contactDensity.prospectContactCounts[c.entity_id] || 0) + 1;
      });
    }

    // ═══ 6. Communication Style Fingerprint ═══
    const { data: recentEmails } = await supabase
      .from("email_threads")
      .select("body_preview, tone_used")
      .order("sent_at", { ascending: false })
      .limit(20);

    const styleFingerprint = {
      avgWordCount: 0,
      dominantTone: "professional",
      toneDistribution: {} as Record<string, number>,
    };

    if (recentEmails && recentEmails.length > 0) {
      const wordCounts = recentEmails.map((e: any) => (e.body_preview || "").split(/\s+/).length);
      styleFingerprint.avgWordCount = Math.round(wordCounts.reduce((a: number, b: number) => a + b, 0) / wordCounts.length);

      recentEmails.forEach((e: any) => {
        const tone = e.tone_used || "professional";
        styleFingerprint.toneDistribution[tone] = (styleFingerprint.toneDistribution[tone] || 0) + 1;
      });

      const sorted = Object.entries(styleFingerprint.toneDistribution).sort(([, a], [, b]) => (b as number) - (a as number));
      if (sorted.length > 0) styleFingerprint.dominantTone = sorted[0][0];
    }

    const result = {
      emailStats,
      activityPatterns,
      dealPatterns,
      scoopTrends,
      contactDensity,
      styleFingerprint,
      generatedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("intelligence-gather error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

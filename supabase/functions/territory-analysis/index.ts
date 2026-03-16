import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { buildings } = await req.json();

    // Gather activity data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000).toISOString();
    const [activitiesRes, pipelineRes, tasksRes] = await Promise.all([
      supabase.from("activities").select("building_id, tenant_id, type, timestamp").gte("timestamp", thirtyDaysAgo),
      supabase.from("pipeline_deals").select("building_id, tenant_id, stage, last_activity").not("stage", "in", '("lost","closed")'),
      supabase.from("tasks").select("building_id, tenant_id, completed").eq("completed", false),
    ]);

    const activities = activitiesRes.data || [];
    const pipeline = pipelineRes.data || [];
    const tasks = tasksRes.data || [];

    // Compute activity counts per building
    const buildingActivityCount: Record<string, number> = {};
    activities.forEach((a: any) => {
      buildingActivityCount[a.building_id] = (buildingActivityCount[a.building_id] || 0) + 1;
    });

    const buildingPipelineCount: Record<string, number> = {};
    pipeline.forEach((p: any) => {
      buildingPipelineCount[p.building_id] = (buildingPipelineCount[p.building_id] || 0) + 1;
    });

    // Build context for AI
    const buildingSummaries = (buildings || []).slice(0, 40).map((b: any) => {
      const actCount = buildingActivityCount[b.id] || 0;
      const pipeCount = buildingPipelineCount[b.id] || 0;
      const tenantCount = b.tenantCount || b.tenants?.length || 0;
      return `- ${b.name} (${b.address}): ${tenantCount} tenants, ${actCount} activities (30d), ${pipeCount} active deals, ${b.vacancyRate || 0}% vacancy, Class ${b.class || '?'}`;
    }).join("\n");

    const totalActivities = activities.length;
    const coveredBuildings = Object.keys(buildingActivityCount).length;
    const totalBuildings = (buildings || []).length;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are a CRE territory strategist. Analyze a broker's building coverage and suggest under-covered opportunities.

Return ONLY valid JSON:
{
  "coverage_score": 0-100,
  "coverage_summary": "1-2 sentence assessment",
  "blind_spots": [
    { "building_name": "string", "address": "string", "reason": "Why this building deserves attention", "opportunity_type": "high_vacancy|many_tenants|no_activity|competitor_gap" }
  ],
  "recommendations": [
    "Actionable strategy recommendation"
  ]
}

Rules:
- Identify 3-5 buildings with the most untapped potential (high tenant count + low activity, or high vacancy)
- Be specific about WHY each building is a blind spot
- Recommendations should be tactical, not generic`,
          },
          {
            role: "user",
            content: `TERRITORY ANALYSIS REQUEST

Coverage: ${coveredBuildings} of ${totalBuildings} buildings have activity in last 30 days
Total activities (30d): ${totalActivities}
Active pipeline deals: ${pipeline.length}
Pending tasks: ${tasks.length}

BUILDING DATA:
${buildingSummaries}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI service unavailable");
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let analysis;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawContent];
      analysis = JSON.parse(jsonMatch[1]!.trim());
    } catch {
      analysis = {
        coverage_score: 50,
        coverage_summary: "Unable to fully analyze territory coverage.",
        blind_spots: [],
        recommendations: ["Review your building list and log more activities to improve analysis."],
      };
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("territory-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

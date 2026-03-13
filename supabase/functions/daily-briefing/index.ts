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

    // Gather context data in parallel
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600000).toISOString();
    const today = now.toISOString().split("T")[0];

    const [pipelineRes, tasksRes, activitiesRes, scoopsRes] = await Promise.all([
      supabase.from("pipeline_deals").select("*").not("stage", "in", '("lost","closed")').limit(50),
      supabase.from("tasks").select("*").eq("completed", false).order("due_date", { ascending: true }).limit(30),
      supabase.from("activities").select("*").gte("timestamp", sevenDaysAgo).order("timestamp", { ascending: false }).limit(30),
      supabase.from("scoops").select("id, content, category, created_at, linked_tenant_name").order("created_at", { ascending: false }).limit(10),
    ]);

    const pipeline = pipelineRes.data || [];
    const tasks = tasksRes.data || [];
    const activities = activitiesRes.data || [];
    const scoops = scoopsRes.data || [];

    // Build context summary for AI
    const overdueTasks = tasks.filter((t: any) => t.due_date && t.due_date.split("T")[0] < today);
    const dueTodayTasks = tasks.filter((t: any) => t.due_date && t.due_date.split("T")[0] === today);
    const stalePipeline = pipeline.filter((p: any) => {
      const daysSince = (now.getTime() - new Date(p.last_activity).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 7;
    });

    const contextSummary = `
TODAY: ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}

PIPELINE (${pipeline.length} active deals):
${pipeline.map((p: any) => `- ${p.prospect_company || p.prospect_name || p.tenant_id} | Stage: ${p.stage} | Last activity: ${new Date(p.last_activity).toLocaleDateString()}`).join("\n")}

OVERDUE TASKS (${overdueTasks.length}):
${overdueTasks.map((t: any) => `- "${t.title}" (due ${t.due_date?.split("T")[0]}) [${t.priority} priority]`).join("\n") || "None"}

DUE TODAY (${dueTodayTasks.length}):
${dueTodayTasks.map((t: any) => `- "${t.title}" [${t.priority} priority]`).join("\n") || "None"}

OTHER PENDING TASKS (${tasks.length - overdueTasks.length - dueTodayTasks.length}):
${tasks.filter((t: any) => !overdueTasks.includes(t) && !dueTodayTasks.includes(t)).slice(0, 10).map((t: any) => `- "${t.title}" (due ${t.due_date?.split("T")[0]})`).join("\n") || "None"}

STALE DEALS (no activity 7+ days): ${stalePipeline.length}
${stalePipeline.slice(0, 5).map((p: any) => `- ${p.prospect_company || p.tenant_id} in "${p.stage}" — ${Math.round((now.getTime() - new Date(p.last_activity).getTime()) / 86400000)} days idle`).join("\n") || "None"}

RECENT ACTIVITY (last 7 days): ${activities.length} logged
${activities.slice(0, 8).map((a: any) => `- ${a.type}: "${a.title}" (${new Date(a.timestamp).toLocaleDateString()})`).join("\n")}

RECENT SCOOPS:
${scoops.slice(0, 5).map((s: any) => `- [${s.category}] ${s.content.slice(0, 100)}${s.linked_tenant_name ? ` (${s.linked_tenant_name})` : ""}`).join("\n") || "None"}
`.trim();

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
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a senior commercial real estate broker's AI chief of staff. Generate a concise, actionable daily briefing.

Return a JSON object with this exact structure:
{
  "greeting": "Short motivational opener (1 sentence)",
  "priorities": [
    { "action": "Specific action to take", "reason": "Why this matters", "urgency": "high|medium|low", "type": "task|outreach|pipeline|research" }
  ],
  "insights": [
    "Brief market/pipeline insight based on the data"
  ],
  "stale_alert": "Optional warning about stale deals, or null"
}

Rules:
- Return 3-5 priorities, ranked by impact
- Be specific: name prospects, reference actual data
- Keep each action under 15 words
- Insights should be data-driven observations (1-3)
- Be direct and actionable, not generic`,
          },
          { role: "user", content: contextSummary },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle markdown code blocks)
    let briefing;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawContent];
      briefing = JSON.parse(jsonMatch[1]!.trim());
    } catch {
      briefing = {
        greeting: "Good morning — let's make today count.",
        priorities: [{ action: "Review your pipeline and pending tasks", reason: "Stay on top of your deals", urgency: "medium", type: "pipeline" }],
        insights: ["Check your dashboard for the latest metrics."],
        stale_alert: null,
      };
    }

    return new Response(JSON.stringify({
      briefing,
      context: {
        pipelineCount: pipeline.length,
        overdueCount: overdueTasks.length,
        dueTodayCount: dueTodayTasks.length,
        staleCount: stalePipeline.length,
        weeklyActivities: activities.length,
        generatedAt: now.toISOString(),
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-briefing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

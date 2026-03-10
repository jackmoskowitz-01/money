import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const {
      tenantName, industry, sqft, headcount, leaseExpiration, floor,
      contactName, contactTitle, contactEmail,
      buildingName, buildingClass, buildingFloors, buildingYearBuilt, vacancyRate, owner,
      outreachReasons, submarketNews, scoopIntel, activityHistory,
    } = await req.json();

    const systemPrompt = `You are a senior CRE broker preparing for a tenant meeting. Generate a concise, actionable one-page meeting prep brief.

Format the brief with these sections using markdown headers (##):

## Tenant Snapshot
Key facts about the tenant: industry, current space, headcount, SF/person ratio, lease timeline.

## Building Context
Building details, vacancy, ownership, class. Note any leverage points (high vacancy = negotiation power, building sale = uncertainty).

## Outreach Signals
Summarize the active signals/reasons for outreach and what they mean strategically.

## Recent Activity
Summarize any prior outreach, meetings, or touchpoints. If none, note this is a cold outreach.

## Market Intel
Reference any relevant submarket news or broker intel (scoops) that could be conversation starters.

## Talking Points
3-5 specific, actionable talking points for the meeting. These should feel natural, not salesy. Reference specific data points.

## Risks & Objections
2-3 likely objections and suggested responses.

Keep the tone professional but conversational — this is a broker's personal prep doc, not a client-facing deliverable. Be specific with numbers and names. Today's date is ${new Date().toISOString().split('T')[0]}.`;

    const userContent = `Prepare a meeting brief for:

TENANT: ${tenantName}
Industry: ${industry}
Space: ${sqft?.toLocaleString()} SF on Floor ${floor}
Headcount: ${headcount} (${sqft && headcount ? Math.round(sqft / headcount) : 'N/A'} SF/person)
Lease Expiration: ${leaseExpiration || 'Unknown'}
Contact: ${contactName}, ${contactTitle} (${contactEmail})

BUILDING: ${buildingName}
Class: ${buildingClass || 'N/A'} | Floors: ${buildingFloors || 'N/A'} | Built: ${buildingYearBuilt || 'N/A'}
Vacancy: ${vacancyRate}% | Owner: ${owner || 'Unknown'}

OUTREACH SIGNALS:
${outreachReasons?.length ? outreachReasons.map((r: any) => `- [${r.urgency?.toUpperCase()}] ${r.title}: ${r.description}`).join('\n') : 'None identified'}

RECENT ACTIVITY:
${activityHistory?.length ? activityHistory.map((a: any) => `- ${a.date}: ${a.title}`).join('\n') : 'No prior activity logged'}

SUBMARKET NEWS:
${submarketNews?.length ? submarketNews.map((n: any) => `- ${n.title}: ${n.summary}`).join('\n') : 'No recent submarket news'}

BROKER INTEL (SCOOPS):
${scoopIntel?.length ? scoopIntel.map((s: any) => `- ${s.author}: "${s.content}"`).join('\n') : 'No relevant scoops'}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Failed to generate brief" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("meeting-prep error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

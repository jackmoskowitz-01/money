import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tenantName, buildingName, contactName, contactTitle, industry, sqft, leaseExpiration, outreachReason, vacancyRate, headcount, clientsInBuilding } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert commercial real estate broker writing personalized outreach emails. You write compelling, professional emails that are:
- Specific to the tenant's situation and market conditions
- Not generic or template-sounding
- Concise but informative (3-4 paragraphs max)
- Action-oriented with a clear CTA (meeting request)
- Written in a confident but not pushy tone
- Reference specific market data and the tenant's situation

Sign off with just "Best regards" (the broker will add their name).`;

    const userPrompt = `Write a personalized outreach email for the following prospect:

TENANT: ${tenantName}
BUILDING: ${buildingName}
CONTACT: ${contactName}, ${contactTitle}
INDUSTRY: ${industry}
SPACE: ${sqft?.toLocaleString()} SF
LEASE EXPIRATION: ${leaseExpiration}
BUILDING VACANCY: ${vacancyRate}%
HEADCOUNT: ${headcount}

OUTREACH REASON: ${outreachReason}
${clientsInBuilding?.length ? `\nEXISTING CLIENTS IN THIS BUILDING: ${clientsInBuilding.join(', ')}\nIMPORTANT: Naturally mention that our firm already represents ${clientsInBuilding.join(' and ')} in this building — this establishes credibility and familiarity with the property. Reference it as a relationship advantage, not a hard sell.\n` : ''}
Write a compelling, personalized email that references the specific reason for reaching out and demonstrates market knowledge. Make it feel like a real broker wrote it, not AI.`;

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
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-outreach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

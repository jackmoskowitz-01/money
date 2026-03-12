import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tenantName, buildingName, contactName, contactTitle, industry, sqft, leaseExpiration, outreachReason, vacancyRate, headcount, clientsInBuilding, isCustomProspect, greeting } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Calculate the Monday two Mondays from now
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
    const daysToNextMonday = (8 - dayOfWeek) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysToNextMonday);
    const twoMondaysOut = new Date(nextMonday);
    twoMondaysOut.setDate(nextMonday.getDate() + 7);
    const monthName = twoMondaysOut.toLocaleDateString('en-US', { month: 'long' });
    const dayNum = twoMondaysOut.getDate();
    const ordinal = (n: number) => {
      const s = ['th','st','nd','rd'];
      const v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const weekOfDate = `${monthName} ${ordinal(dayNum)}`;

    const systemPrompt = `You are an expert commercial real estate broker writing personalized outreach emails. Write in PLAIN TEXT only — no markdown, no asterisks, no bold, no formatting characters whatsoever. You write compelling, professional emails that are:
- Specific to the tenant's situation and market conditions
- Not generic or template-sounding
- Concise but informative (3-4 paragraphs max)
- Action-oriented with a clear CTA (meeting request)
- Written in a confident but not pushy tone
- Reference specific market data and the tenant's situation

CRITICAL FORMATTING RULES:
- Always use "%" for percentages, NEVER spell out "percent". For example: "22%" not "22 percent".
- When writing dates, always include the ordinal suffix. For example: "March 23rd", "April 1st", "May 2nd", not "March 23" or "April 1".
- Sign off with "Best regards," (WITH a comma after "regards"), then the broker will add their name on the next line.

CRITICAL MEETING REQUEST RULE: When asking for a meeting, ask to meet "the week of ${weekOfDate}". For example: "Would you be open to a brief call the week of ${weekOfDate}?" or "Are you available for coffee the week of ${weekOfDate}?" The date provided is always a Monday — do not change it.

GREETING RULE: ${greeting === 'none' ? `Do NOT use any greeting word like "Hi", "Hello", "Dear", or "Hey". Start the email with just the contact's first name followed by a comma. For example: "Sarah," on its own line.` : `Start the email with "${greeting} [first name]," — for example: "${greeting} Sarah,".`}

${isCustomProspect ? `CUSTOM PROSPECT MODE: The prospect is NOT in our database. You only have their organization name. Use your general knowledge about this organization (what they do, their industry, approximate size, likely office needs) to write a relevant outreach email. If you don't know specifics, keep it general but still tie it to the market news provided. Do NOT make up specific lease details or square footage — keep it about the market opportunity.` : `CRITICAL RULE: If "EXISTING CLIENTS IN THIS BUILDING" is provided, you MUST mention those client names by name in the FIRST paragraph of the email. Lead with the existing relationship — e.g. "Our firm currently represents [client name] at [building], so we know the property well..." This establishes credibility immediately. This is NOT optional — always include it when provided, and always in the opening paragraph.`}`;

    let userPrompt: string;
    if (isCustomProspect) {
      userPrompt = `Write a personalized outreach email for the following prospect:

ORGANIZATION: ${tenantName}

OUTREACH REASON: ${outreachReason}

Write a compelling, personalized email that references the specific market news as the reason for reaching out. Use what you know about this organization to make the email relevant. Demonstrate DC market knowledge and position yourself as a helpful resource, not a salesperson. Make it feel like a real broker wrote it, not AI.`;
    } else {
      userPrompt = `Write a personalized outreach email for the following prospect:

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
    }

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

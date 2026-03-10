import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callAI(apiKey: string, systemPrompt: string, userPrompt: string, stream = false) {
  const response = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream,
    }),
  });
  return response;
}

function errorResponse(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // === FOLLOW-UP DRAFT ===
    if (action === "follow_up") {
      const { originalEmail, tenantName, daysSince, contactName, stage } = body;

      const systemPrompt = `You are an expert commercial real estate broker drafting follow-up emails. The prospect hasn't responded to the original outreach. Write a concise, non-pushy follow-up that:
- References the original email naturally without repeating it
- Adds new value (market insight, new listing, or relevant news)
- Creates gentle urgency without being aggressive
- Matches the relationship stage: ${stage || 'initial outreach'}
Return ONLY the email text — no commentary, no markdown.`;

      const userPrompt = `Draft a follow-up email for ${contactName || 'the prospect'} at ${tenantName}. It's been ${daysSince} days since the original email below was sent with no response.\n\nOriginal email:\n${originalEmail}`;

      const response = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt, true);
      if (!response.ok) {
        if (response.status === 429) return errorResponse(429, "Rate limit exceeded.");
        if (response.status === 402) return errorResponse(402, "AI credits exhausted.");
        return errorResponse(500, "Follow-up generation failed");
      }
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // === RESEARCH BRIEF ===
    if (action === "research_brief") {
      const { tenantName, industry, sqft, buildingName, leaseExpiration, headcount, contactName, contactTitle } = body;

      const systemPrompt = `You are a commercial real estate research analyst preparing a quick prospect briefing for a broker before outreach. Generate a concise research brief with these sections:
1. **Company Overview** (2-3 sentences about what they do, their market position)
2. **Space & Lease Intel** (current space usage, lease timeline, likely needs)
3. **Industry Trends** (2-3 bullets on their industry's real estate impact)
4. **Outreach Angles** (3 specific talking points the broker can use)
5. **Watch Out** (1-2 potential objections or sensitivities)

Use the provided data to make educated inferences. Be specific and actionable. Format with markdown headers and bullets.`;

      const userPrompt = `Research brief for:
Company: ${tenantName}
Industry: ${industry}
Current Space: ${sqft?.toLocaleString() || 'Unknown'} SF at ${buildingName}
Lease Expiry: ${leaseExpiration || 'Unknown'}
Headcount: ${headcount || 'Unknown'}
Contact: ${contactName}, ${contactTitle}`;

      const response = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt, true);
      if (!response.ok) {
        if (response.status === 429) return errorResponse(429, "Rate limit exceeded.");
        if (response.status === 402) return errorResponse(402, "AI credits exhausted.");
        return errorResponse(500, "Research brief generation failed");
      }
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // === OBJECTION HANDLER ===
    if (action === "handle_objection") {
      const { objection, tenantName, industry, sqft, leaseExpiration, buildingName } = body;

      const systemPrompt = `You are an expert commercial real estate broker coaching on objection handling. Given a prospect's objection, provide:
1. A brief analysis of what the objection really means
2. A recommended response (2-3 sentences, conversational)
3. A follow-up question to keep the dialogue going
4. An alternative angle if the direct response doesn't land

Be practical, empathetic, and strategic. Format with clear sections. No markdown code blocks.`;

      const userPrompt = `Prospect: ${tenantName} (${industry}, ${sqft?.toLocaleString() || '?'} SF at ${buildingName})
Lease expires: ${leaseExpiration || 'Unknown'}

Their objection: "${objection}"

How should I respond?`;

      const response = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt, true);
      if (!response.ok) {
        if (response.status === 429) return errorResponse(429, "Rate limit exceeded.");
        if (response.status === 402) return errorResponse(402, "AI credits exhausted.");
        return errorResponse(500, "Objection handling failed");
      }
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // === A/B VARIANT ===
    if (action === "ab_variant") {
      const { currentEmail, tenantName, industry } = body;

      const systemPrompt = `You are an expert commercial real estate email strategist. Given an existing outreach email, create an alternative version that:
- Uses a completely different angle/hook (e.g., if original leads with market data, lead with a question; if original is formal, try conversational)
- Keeps the same core value proposition but frames it differently
- Is roughly the same length
- Could serve as an A/B test variant
Return ONLY the alternative email text — no commentary, no labels like "Version B", no markdown.`;

      const userPrompt = `Create an A/B variant of this email for ${tenantName} (${industry || 'commercial'} sector):\n\n${currentEmail}`;

      const response = await callAI(LOVABLE_API_KEY, systemPrompt, userPrompt, true);
      if (!response.ok) {
        if (response.status === 429) return errorResponse(429, "Rate limit exceeded.");
        if (response.status === 402) return errorResponse(402, "AI credits exhausted.");
        return errorResponse(500, "A/B variant generation failed");
      }
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // === SEQUENCE BUILDER ===
    if (action === "build_sequence") {
      const { tenantName, contactName, industry, sqft, buildingName, leaseExpiration, outreachReason, steps } = body;
      const numSteps = steps || 4;

      const systemPrompt = `You are an expert commercial real estate outreach strategist. Create a ${numSteps}-touch email sequence for prospecting. Each email should:
- Build on the previous one naturally
- Escalate value and urgency progressively
- Follow this pattern: Intro → Value-Add → Urgency → Break-Up
- Be self-contained (prospect may not have read previous emails)

Return a JSON array where each item has: { "step": 1, "timing": "Day 0", "subject": "...", "body": "..." }
Return ONLY valid JSON — no commentary, no markdown.`;

      const userPrompt = `Build a ${numSteps}-step outreach sequence for:
Prospect: ${tenantName}
Contact: ${contactName || 'Unknown'}
Industry: ${industry || 'Unknown'}
Space: ${sqft ? sqft.toLocaleString() + ' SF' : 'Unknown'} at ${buildingName || 'Unknown'}
Lease Expiry: ${leaseExpiration || 'Unknown'}
Outreach Trigger: ${outreachReason || 'General prospecting'}`;

      const response = await fetch(AI_URL, {
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
          tools: [{
            type: "function",
            function: {
              name: "return_sequence",
              description: "Return the email sequence",
              parameters: {
                type: "object",
                properties: {
                  sequence: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        step: { type: "number" },
                        timing: { type: "string" },
                        subject: { type: "string" },
                        body: { type: "string" },
                      },
                      required: ["step", "timing", "subject", "body"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["sequence"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_sequence" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return errorResponse(429, "Rate limit exceeded.");
        if (response.status === 402) return errorResponse(402, "AI credits exhausted.");
        return errorResponse(500, "Sequence generation failed");
      }

      const data = await response.json();
      let sequence: any[] = [];
      try {
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          sequence = parsed.sequence || [];
        }
      } catch {
        try {
          sequence = JSON.parse(data.choices?.[0]?.message?.content || '[]');
        } catch { /* empty */ }
      }

      return new Response(JSON.stringify({ sequence }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return errorResponse(400, "Unknown action");
  } catch (e) {
    console.error("smart-outreach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

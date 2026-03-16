import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, ...body } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // === CLASSIFY A REPLY ===
    if (action === "classify") {
      const { replyContent, originalSubject, originalBody, prospectName, prospectEmail, industry } = body;

      const systemPrompt = `You are an AI email classifier for a commercial real estate broker. Given a reply email, classify it as:

1. **is_relevant**: true/false — Is this a genuine human reply worth responding to? Filter out:
   - Auto-replies / out-of-office
   - Bounce-backs / delivery failures
   - Marketing emails / newsletters
   - Unsubscribe confirmations
   - Generic "do not reply" responses
   - Spam or irrelevant forwards

2. **spam_reason**: If not relevant, explain why (e.g., "auto-reply", "bounce", "marketing")

3. **sentiment**: "positive" | "neutral" | "negative" | "interested" — How does the prospect feel?
   - positive: Wants to learn more, agrees to meet
   - interested: Asking questions, engaging
   - neutral: Non-committal, acknowledging receipt
   - negative: Not interested, asking to stop

4. **urgency**: "hot" | "warm" | "cold"
   - hot: Ready to meet/tour, asking about availability
   - warm: Engaging, asking questions
   - cold: Polite decline but door not closed

5. **suggested_action**: What should the broker do next? (1 sentence)

Return ONLY valid JSON with these fields.`;

      const userPrompt = `Original outreach subject: ${originalSubject}
Original outreach preview: ${originalBody?.substring(0, 500) || 'N/A'}
Prospect: ${prospectName} (${prospectEmail}) — ${industry || 'Unknown'} industry

Reply received:
${replyContent}`;

      const response = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_classification",
              description: "Return the email classification",
              parameters: {
                type: "object",
                properties: {
                  is_relevant: { type: "boolean" },
                  spam_reason: { type: "string" },
                  sentiment: { type: "string", enum: ["positive", "neutral", "negative", "interested"] },
                  urgency: { type: "string", enum: ["hot", "warm", "cold"] },
                  suggested_action: { type: "string" },
                },
                required: ["is_relevant", "sentiment", "urgency", "suggested_action"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_classification" } },
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "Classification failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await response.json();
      let classification = { is_relevant: true, spam_reason: "", sentiment: "neutral", urgency: "warm", suggested_action: "Follow up" };
      try {
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          classification = JSON.parse(toolCall.function.arguments);
        }
      } catch { /* fallback */ }

      return new Response(JSON.stringify(classification), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === SUGGEST REPLIES ===
    if (action === "suggest_replies") {
      const { replyContent, originalSubject, originalBody, prospectName, industry, sentiment } = body;

      const systemPrompt = `You are an expert commercial real estate broker. A prospect has replied to your outreach. Based on their reply sentiment (${sentiment}), draft 3 short response options:

1. **Assertive**: Push for the meeting/next step confidently
2. **Consultative**: Ask a thoughtful follow-up question to deepen the conversation  
3. **Value-Add**: Share a relevant insight or market data point to build credibility

Each response should be 2-4 sentences, professional, and tailored to CRE. Return a JSON array of 3 objects: [{ "style": "...", "subject": "...", "body": "..." }]`;

      const userPrompt = `Prospect: ${prospectName} (${industry || 'commercial'} sector)
Original subject: ${originalSubject}
Their reply: ${replyContent}`;

      const response = await fetch(AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_suggestions",
              description: "Return reply suggestions",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        style: { type: "string" },
                        subject: { type: "string" },
                        body: { type: "string" },
                      },
                      required: ["style", "subject", "body"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_suggestions" } },
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "Suggestion generation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await response.json();
      let suggestions: any[] = [];
      try {
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          suggestions = JSON.parse(toolCall.function.arguments).suggestions || [];
        }
      } catch { /* empty */ }

      return new Response(JSON.stringify({ suggestions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-reply error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, currentEmail, tone, tenantName, industry, buildingName, sqft, leaseExpiration, outreachReason } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (action === "rewrite_tone") {
      const toneDescriptions: Record<string, string> = {
        formal: "Formal and professional — polished language, structured paragraphs, respectful distance. Suitable for C-suite executives and conservative industries.",
        casual: "Casual and conversational — friendly, relaxed, like talking to a peer. Use contractions, short sentences, and a warm tone.",
        consultative: "Consultative and advisory — position yourself as a trusted expert sharing insights. Use data-driven language and strategic framing.",
        urgent: "Urgent and action-oriented — create a sense of time-sensitivity without being pushy. Emphasize deadlines, market windows, and competitive pressure.",
      };

      const systemPrompt = `You are an expert commercial real estate broker rewriting outreach emails. Rewrite the given email in a ${tone} tone. ${toneDescriptions[tone] || ''} Keep the same core message and facts but transform the voice and style. Return ONLY the revised email text — no commentary, no explanation, no markdown.`;

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
            { role: "user", content: `Rewrite this email in a ${tone} tone:\n\n${currentEmail}` },
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
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
        return new Response(JSON.stringify({ error: "Tone rewrite failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    if (action === "subject_lines") {
      const systemPrompt = `You are an expert commercial real estate email strategist. Generate exactly 5 compelling email subject lines for the given outreach email. Each subject line should be under 60 characters, designed to maximize open rates. Use different angles: curiosity, value proposition, urgency, personalization, and specificity. Return ONLY a JSON array of 5 strings — no commentary, no markdown, no explanation.`;

      const context = tenantName
        ? `Prospect: ${tenantName}\nIndustry: ${industry || 'Unknown'}\nBuilding: ${buildingName || 'Unknown'}\nSize: ${sqft ? sqft.toLocaleString() + ' SF' : 'Unknown'}\nLease Expiry: ${leaseExpiration || 'Unknown'}\nOutreach Reason: ${outreachReason || 'General outreach'}`
        : '';

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
            { role: "user", content: `Generate 5 subject lines for this email:\n\n${currentEmail}\n\n${context}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_subject_lines",
              description: "Return 5 email subject line options",
              parameters: {
                type: "object",
                properties: {
                  subjects: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 5,
                    maxItems: 5,
                  }
                },
                required: ["subjects"],
                additionalProperties: false,
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "return_subject_lines" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
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
        return new Response(JSON.stringify({ error: "Subject line generation failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      let subjects: string[] = [];
      try {
        const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          subjects = parsed.subjects || [];
        }
      } catch {
        // Fallback: try parsing content directly
        try {
          subjects = JSON.parse(data.choices?.[0]?.message?.content || '[]');
        } catch { /* empty */ }
      }

      return new Response(JSON.stringify({ subjects }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-drafting error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

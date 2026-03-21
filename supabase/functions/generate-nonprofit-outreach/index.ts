import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, orgName, contactName, contactTitle, mission, memberCount, currentLeaseSqft, leaseExpiration, customContext } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt: string;
    let userPrompt: string;

    if (type === "newsletter") {
      systemPrompt = `You are an expert commercial real estate market analyst writing a concise market update newsletter for non-profit organizations and associations in the Washington, DC metro area. Write in PLAIN TEXT only — no markdown, no asterisks, no bold, no formatting. The newsletter should:
- Be 4-6 paragraphs
- Lead with a compelling market insight relevant to non-profits/associations
- Include specific data points (vacancy rates, rental trends, submarket comparisons)
- Highlight opportunities for non-profits (e.g., rising vacancy = negotiating leverage, sublease opportunities)
- Mention relevant submarkets: East End, CBD, Capitol Hill, Georgetown, Rosslyn-Ballston
- End with a soft CTA inviting them to discuss their space needs
- Tone: authoritative but approachable, not salesy`;

      userPrompt = `Write a market update newsletter for non-profit and association tenants in the DC market.${customContext ? `\n\nAdditional context to incorporate: ${customContext}` : ''}

Include these current market highlights:
- Overall DC vacancy is around 22%, up from 19% last year
- Class A asking rents averaging $55-62/SF in CBD, $48-55/SF in East End
- Several large sublease blocks available (good for non-profits seeking affordable space)
- Capitol Hill and Georgetown seeing increased association interest
- Coworking/flex space growing as option for smaller non-profits`;
    } else {
      systemPrompt = `You are an expert commercial real estate broker writing a personalized outreach email to a non-profit organization or association. Write in PLAIN TEXT only — no markdown, no asterisks, no bold, no formatting. The email should:
- Acknowledge their mission and the importance of their work
- Connect their space needs to current market conditions
- Be warm, consultative, and NOT pushy
- Highlight how current market conditions benefit tenants (high vacancy = leverage)
- Be 3-4 paragraphs max
- Include a specific, low-pressure CTA (coffee meeting, quick call)
- Sign off with just "Best regards"`;

      userPrompt = `Write a personalized outreach email for:

ORGANIZATION: ${orgName}
CONTACT: ${contactName}, ${contactTitle}
MISSION/FOCUS: ${mission}
MEMBERS/STAFF: ${memberCount}
CURRENT SPACE: ${currentLeaseSqft ? `${currentLeaseSqft.toLocaleString()} SF` : 'Unknown'}
LEASE EXPIRATION: ${leaseExpiration || 'Unknown'}
${customContext ? `\nADDITIONAL CONTEXT: ${customContext}` : ''}

Write a compelling, personalized email that demonstrates understanding of their mission and connects it to actionable real estate opportunities.`;
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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-nonprofit-outreach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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

    const systemPrompt = `You are a commercial real estate market analyst specializing in the Washington, DC office market. Generate exactly 8 current, realistic market news items that a CRE broker would find actionable for tenant outreach.

Each news item should be the kind of intelligence that would motivate a broker to reach out to affected tenants — lease expirations, space reductions, expansions, building sales, vacancy trends, sublease availability, etc.

Include a mix of categories:
- lease: tenant lease activity, renewals, expirations
- sale: building transactions, acquisitions
- expansion: companies growing their footprint
- vacancy: vacancy trends, sublease availability
- market: broader market trends, policy changes
- contraction: companies downsizing, reducing space

Make the news feel CURRENT and TIMELY — reference recent quarters, current year trends, and specific DC submarkets (CBD, East End, Capitol Hill, NoMa, Southwest, Georgetown).

Include specific company names, building names/addresses, square footages, and dollar amounts where relevant. Mix in nonprofits, law firms, consulting firms, tech companies, government contractors, and trade associations — the types of tenants common in DC.

IMPORTANT: Return ONLY a valid JSON array with no markdown formatting, no code blocks, no extra text. Each item must have these exact fields:
- id: unique string (n1, n2, etc.)
- title: compelling headline (max 80 chars)
- summary: 2-3 sentence description with specific details
- source: realistic publication name (e.g., Washington Business Journal, Bisnow, CoStar, Bloomberg, Politico, GlobeSt)
- date: today's date or within the last 7 days in YYYY-MM-DD format
- category: one of "lease", "sale", "expansion", "vacancy", "market", "contraction"

Today's date is ${new Date().toISOString().split('T')[0]}.`;

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
          { role: "user", content: "Generate 8 current DC commercial real estate market news items as a JSON array. Return ONLY the JSON array, no markdown." },
        ],
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
      return new Response(JSON.stringify({ error: "Failed to generate news" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Strip markdown code blocks if present
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    let newsItems;
    try {
      newsItems = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", cleaned);
      return new Response(JSON.stringify({ error: "Failed to parse news data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ news: newsItems }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-market-news error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

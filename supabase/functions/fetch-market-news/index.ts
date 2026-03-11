import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const today = new Date().toISOString().split("T")[0];

    // Step 1: Use Perplexity to search for real DC office market news
    const perplexityResp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a commercial real estate news researcher. Search for the most recent news about the Washington DC office market. Focus on leases, building sales, tenant moves, expansions, contractions, vacancy trends, and market developments. Return factual, sourced news only.",
          },
          {
            role: "user",
            content: `Find the latest Washington DC commercial real estate office market news from the past 7 days. Include tenant leases, building sales, expansions, contractions, vacancy updates, and market trends. Focus on specific companies, buildings, and submarkets (CBD, East End, NoMa, Capitol Hill, Southwest, Georgetown). Provide as many specific details as possible — company names, addresses, square footages, deal terms.`,
          },
        ],
        search_recency_filter: "week",
      }),
    });

    if (!perplexityResp.ok) {
      const errText = await perplexityResp.text();
      console.error("Perplexity API error:", perplexityResp.status, errText);
      throw new Error(`Perplexity search failed: ${perplexityResp.status}`);
    }

    const perplexityData = await perplexityResp.json();
    const rawContent = perplexityData.choices?.[0]?.message?.content || "";
    const citations = perplexityData.citations || [];

    console.log("Perplexity returned content length:", rawContent.length, "citations:", citations.length);

    // Step 2: Use Lovable AI to structure the raw search results into news items
    const structureResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a data structuring assistant. Convert raw news content into a JSON array of structured news items. Today's date is ${today}.

IMPORTANT: Return ONLY a valid JSON array. No markdown, no code blocks, no extra text.

Each item must have:
- id: unique string (n1, n2, etc.)
- title: compelling headline (max 80 chars)
- summary: 2-3 sentence description with specific details from the source
- source: the actual publication name if mentioned, otherwise "Market Intelligence"
- date: the date mentioned in the article, or today's date, in YYYY-MM-DD format
- category: one of "lease", "sale", "expansion", "vacancy", "market", "contraction"
- url: source URL if available from citations, otherwise null
- companyMentions: array of company/organization names mentioned in this news item

Extract 6-10 distinct news items from the content. Each should be a separate, actionable piece of intelligence.`,
          },
          {
            role: "user",
            content: `Here is raw DC CRE market news content:\n\n${rawContent}\n\nCitations/Sources:\n${citations.map((c: string, i: number) => `[${i + 1}] ${c}`).join("\n")}\n\nStructure this into a JSON array of news items.`,
          },
        ],
      }),
    });

    if (!structureResp.ok) {
      if (structureResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await structureResp.text();
      console.error("Structure AI error:", structureResp.status, t);
      throw new Error("Failed to structure news");
    }

    const structureData = await structureResp.json();
    const content = structureData.choices?.[0]?.message?.content || "[]";

    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    let newsItems;
    try {
      newsItems = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse structured news:", cleaned);
      return new Response(JSON.stringify({ error: "Failed to parse news data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ news: newsItems, citations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-market-news error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

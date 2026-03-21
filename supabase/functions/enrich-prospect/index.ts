import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { companyName, website, address } = await req.json();

    if (!companyName) {
      return new Response(JSON.stringify({ error: "companyName is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    console.log(`Enriching prospect: ${companyName}`);

    const websiteHint = website ? ` Their website is ${website}.` : "";
    const addressHint = address ? ` They are located at ${address}.` : "";

    // Step 1: Perplexity deep search
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
            content: "You are a corporate intelligence researcher specializing in commercial real estate prospecting. Provide comprehensive, factual company profiles.",
          },
          {
            role: "user",
            content: `Research the company "${companyName}".${websiteHint}${addressHint}

Find and report:
1. Company overview: what they do, their industry/sector
2. Estimated employee count / company size
3. Headquarters and other office locations (especially DC metro area)
4. Recent news (last 90 days): funding, hiring, layoffs, expansions, relocations, mergers, acquisitions
5. Key executives and decision-makers (CEO, COO, CFO, Head of Real Estate/Facilities, Office Manager) with titles
6. Current office space details if available (square footage, lease terms, building name)
7. Any signals relevant to a commercial real estate broker: lease expirations, space needs, growth/contraction

Be specific with names, titles, and facts. If you can't find information for a category, say so.`,
          },
        ],
        search_recency_filter: "month",
      }),
    });

    if (!perplexityResp.ok) {
      const errText = await perplexityResp.text();
      console.error("Perplexity error:", perplexityResp.status, errText);
      if (perplexityResp.status === 402) {
        return new Response(JSON.stringify({ error: "Perplexity credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Perplexity search failed: ${perplexityResp.status}`);
    }

    const perplexityData = await perplexityResp.json();
    const rawContent = perplexityData.choices?.[0]?.message?.content || "";
    const citations = perplexityData.citations || [];

    console.log("Enrichment raw content length:", rawContent.length);

    // Step 2: Structure with Lovable AI
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
            content: `You extract structured company intelligence from raw research. Return ONLY valid JSON, no markdown or code blocks.

Return this exact shape:
{
  "industry": "string - specific industry/sector",
  "employeeCount": "string - estimated headcount or range like '50-100'",
  "companySize": "string - one of: startup, small, mid-market, enterprise",
  "headquarters": "string - HQ city/state",
  "officeLocations": ["array of office location strings"],
  "description": "string - 2-3 sentence company overview",
  "recentNews": [
    { "headline": "string", "date": "YYYY-MM-DD", "summary": "string", "signal": "string - growth|contraction|neutral|opportunity" }
  ],
  "spaceDetails": {
    "currentSqft": "string or null",
    "buildingName": "string or null",
    "leaseExpiration": "string or null"
  },
  "creSignals": ["array of strings - actionable CRE broker insights"],
  "confidenceScore": 0-100
}

Only include data you found in the research. Use null for unknown fields. Do not fabricate. Do NOT include key contacts or decision makers.`,
          },
          {
            role: "user",
            content: `Raw research on "${companyName}":\n\n${rawContent}\n\nCitations:\n${citations.map((c: string, i: number) => `[${i + 1}] ${c}`).join("\n")}`,
          },
        ],
      }),
    });

    if (!structureResp.ok) {
      if (structureResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to structure enrichment data");
    }

    const structureData = await structureResp.json();
    const content = structureData.choices?.[0]?.message?.content || "{}";

    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    let enrichment;
    try {
      enrichment = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse enrichment:", cleaned);
      return new Response(JSON.stringify({ enrichment: null, raw: rawContent, citations }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ enrichment, citations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("enrich-prospect error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

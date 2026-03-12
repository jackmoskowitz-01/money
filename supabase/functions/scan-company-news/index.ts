import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { companies } = await req.json();

    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return new Response(JSON.stringify({ error: "companies array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const companyId = companies[0]?.id;
    const companyName = companies[0]?.name || "";
    const now = Date.now();

    // Check DB cache
    const { data: cached } = await supabase
      .from("cached_company_news")
      .select("news_items, citations, fetched_at")
      .eq("company_id", companyId)
      .single();

    if (cached) {
      const cacheAge = now - new Date(cached.fetched_at).getTime();
      if (cacheAge < CACHE_TTL_MS) {
        console.log(`Serving DB-cached news for ${companyName} (age: ${Math.round(cacheAge / 60000)}min)`);
        return new Response(JSON.stringify({ companyNews: cached.news_items, citations: cached.citations }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const today = new Date().toISOString().split("T")[0];
    const companyNames = companies.map((c: { name: string }) => c.name);
    const companyList = companyNames.join(", ");

    console.log(`Scanning news for ${companyNames.length} companies (cache expired or missing)`);

    const perplexityResp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: "You are a corporate intelligence researcher specializing in commercial real estate signals. Search across Bisnow, CoStar, Commercial Observer, Washington Business Journal, Bloomberg, company press releases, SEC filings, and LinkedIn announcements. Return specific, sourced intelligence only.",
          },
          {
            role: "user",
            content: `Search for the most recent and significant news about these companies. Look for ANY of these signals:\n\n- Office lease signings, renewals, or expirations\n- Relocations, expansions, or space reductions\n- Layoffs, hiring surges, or headcount changes\n- Mergers, acquisitions, or spin-offs\n- Funding rounds or IPO activity\n- Leadership changes (new CEO, CFO, etc.)\n- Government contract wins or losses\n- Return-to-office or remote work policy changes\n- Sublease listings\n- Any news that would affect their real estate footprint\n\nCompanies to search:\n${companyList}\n\nProvide the company name, specific details, publication source, and date for each item found. Focus on actionable intelligence for a DC commercial real estate broker.`,
          },
        ],
        search_recency_filter: "month",
      }),
    });

    if (!perplexityResp.ok) {
      const errText = await perplexityResp.text();
      console.error("Perplexity error:", perplexityResp.status, errText);
      // If API fails, serve stale cache if available
      if (cached) {
        console.log("API failed, serving stale cached news");
        return new Response(JSON.stringify({ companyNews: cached.news_items, citations: cached.citations }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

    console.log("Company scan returned content length:", rawContent.length);

    const companyLookup = companies.map((c: { id: string; name: string; buildingId?: string }) =>
      `${c.name} (id: ${c.id}, buildingId: ${c.buildingId || ""})`
    ).join("\n");

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
            content: `You structure raw company news into JSON. Today is ${today}.

Return ONLY a valid JSON array. No markdown, no code blocks.

Each item must have:
- id: unique string (cn1, cn2, etc.)
- title: headline (max 80 chars)
- summary: 2-3 sentences with specifics
- source: publication name or "Market Intelligence"
- date: YYYY-MM-DD format
- category: one of "lease", "sale", "expansion", "vacancy", "market", "contraction"
- url: source URL if available, otherwise null
- matchedCompanyId: the tenant id from the lookup below that this news is about
- matchedCompanyName: the company name
- matchedBuildingId: the building id from the lookup if available
- relevanceScore: 1-100 how actionable this is for a CRE broker

Company lookup:
${companyLookup}

Only include news items where you found REAL news. Do not fabricate. If no news was found for a company, do not include it.`,
          },
          {
            role: "user",
            content: `Raw news content:\n\n${rawContent}\n\nCitations:\n${citations.map((c: string, i: number) => `[${i + 1}] ${c}`).join("\n")}\n\nStructure into JSON array of company news items.`,
          },
        ],
      }),
    });

    if (!structureResp.ok) {
      if (cached) {
        console.log("Structure API failed, serving stale cached news");
        return new Response(JSON.stringify({ companyNews: cached.news_items, citations: cached.citations }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (structureResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to structure company news");
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
      console.error("Failed to parse company news:", cleaned);
      if (cached) {
        return new Response(JSON.stringify({ companyNews: cached.news_items, citations: cached.citations }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ companyNews: [], citations }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Merge new results with cached results (keep previously found items that aren't duplicates)
    let mergedItems = [...newsItems];
    if (cached && Array.isArray(cached.news_items) && cached.news_items.length > 0) {
      const newTitles = new Set(newsItems.map((n: any) => n.title?.toLowerCase()));
      for (const oldItem of cached.news_items) {
        if (!newTitles.has((oldItem as any).title?.toLowerCase())) {
          mergedItems.push(oldItem);
        }
      }
    }

    // Sort by relevance score descending
    mergedItems.sort((a: any, b: any) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    // Persist to DB cache (upsert)
    const { error: upsertError } = await supabase
      .from("cached_company_news")
      .upsert({
        company_id: companyId,
        company_name: companyName,
        news_items: mergedItems,
        citations,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "company_id" });

    if (upsertError) {
      console.error("Failed to cache news:", upsertError);
    } else {
      console.log(`Cached ${mergedItems.length} news items for ${companyName} in DB`);
    }

    return new Response(JSON.stringify({ companyNews: mergedItems, citations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-company-news error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

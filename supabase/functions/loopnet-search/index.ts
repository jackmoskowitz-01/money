import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "piotrv1001~loopnet-listings-scraper";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) throw new Error("APIFY_API_KEY is not configured");

    const body = await req.json();
    console.log("Raw body:", JSON.stringify(body));

    const { searchUrls, maxItems } = body;

    // This actor requires searchUrls as array of {url: string}
    if (!searchUrls || searchUrls.length === 0) {
      throw new Error("At least one LoopNet search URL is required");
    }

    const input: Record<string, unknown> = {
      searchUrls: searchUrls.map((u: string) => ({ url: u })),
    };

    console.log("LoopNet search input:", JSON.stringify(input));

    const response = await fetch(
      `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_API_KEY}&timeout=300&format=json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Apify error:", response.status, errText);
      throw new Error(`Apify API failed [${response.status}]: ${errText}`);
    }

    let results = await response.json();
    console.log(`LoopNet results: ${Array.isArray(results) ? results.length : 0} items`);

    // Apply maxItems limit client-side
    if (maxItems && Array.isArray(results)) {
      results = results.slice(0, maxItems);
    }

    return new Response(
      JSON.stringify({ success: true, data: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("loopnet-search error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

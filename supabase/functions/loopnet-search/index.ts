import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "parseforge~loopnet-com-commercial-real-estate-scraper";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) throw new Error("APIFY_API_KEY is not configured");

    const { searchUrl, spaceUse, location, maxItems, proxyConfiguration } = await req.json();

    // Build input — searchUrl takes priority over spaceUse/location
    const input: Record<string, unknown> = {};

    if (searchUrl) {
      input.searchUrl = searchUrl;
    } else {
      if (spaceUse) input.spaceUse = spaceUse;
      if (location) input.location = location;
    }

    if (maxItems) input.maxItems = Math.min(Math.max(1, maxItems), 1000000);
    if (proxyConfiguration) input.proxyConfiguration = proxyConfiguration;

    console.log(`LoopNet search input:`, JSON.stringify(input));

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

    const results = await response.json();
    console.log(`LoopNet results: ${Array.isArray(results) ? results.length : 0} items`);

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

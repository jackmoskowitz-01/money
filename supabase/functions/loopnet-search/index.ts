import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "memo23~loopnet-scraper-ppe";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) throw new Error("APIFY_API_KEY is not configured");

    const body = await req.json();
    console.log("Raw body:", JSON.stringify(body));

    const {
      startUrls,
      addresses,
      maxItems,
      includeListingDetails,
      moreResults,
      PriceMin,
      PriceMax,
      BuildingSizeRangeMin,
      BuildingSizeRangeMax,
      State,
      City,
      propertyType,
      maxConcurrency,
    } = body;

    const input: Record<string, unknown> = {};

    // If user provided explicit URLs, use them directly
    if (startUrls && startUrls.length > 0) {
      input.startUrls = startUrls.map((url: string) => ({ url }));
    } else {
      // Auto-construct a LoopNet search URL from State/City filters
      // Format: https://www.loopnet.com/search/commercial-real-estate/{city}-{state}/for-lease/
      const stateVal = (State && State !== "none") ? State.toLowerCase() : "";
      const cityVal = City ? City.trim().toLowerCase().replace(/\s+/g, "-") : "";
      
      if (cityVal && stateVal) {
        const searchUrl = `https://www.loopnet.com/search/commercial-real-estate/${cityVal}-${stateVal}/for-lease/`;
        input.startUrls = [{ url: searchUrl }];
        console.log("Auto-constructed URL:", searchUrl);
      } else if (stateVal) {
        const searchUrl = `https://www.loopnet.com/search/commercial-real-estate/${stateVal}/for-lease/`;
        input.startUrls = [{ url: searchUrl }];
        console.log("Auto-constructed URL (state only):", searchUrl);
      }
    }

    if (addresses && addresses.length > 0) {
      input.addresses = addresses;
    }
    if (maxItems) input.maxItems = maxItems;
    if (includeListingDetails) input.includeListingDetails = true;
    if (moreResults) input.moreResults = true;
    if (PriceMin != null) input.PriceMin = PriceMin;
    if (PriceMax != null) input.PriceMax = PriceMax;
    if (BuildingSizeRangeMin != null) input.BuildingSizeRangeMin = BuildingSizeRangeMin;
    if (BuildingSizeRangeMax != null) input.BuildingSizeRangeMax = BuildingSizeRangeMax;
    if (State && State !== "none") input.State = State;
    if (City) input.City = City;
    if (maxConcurrency) input.maxConcurrency = maxConcurrency;

    input.proxy = { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] };

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

import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "ecomscrape~zoominfo-company-scraper";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) throw new Error("APIFY_API_KEY is not configured");

    const { companyNames, companyUrls, includeSimilar } = await req.json();

    // Accept either company names or ZoomInfo URLs
    const urls_or_companies_names: string[] = [
      ...(companyUrls || []),
      ...(companyNames || []),
    ];

    if (urls_or_companies_names.length === 0) {
      return new Response(
        JSON.stringify({ error: "Provide companyNames or companyUrls array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`ZoomInfo company search: ${urls_or_companies_names.length} targets`);

    const input = {
      urls_or_companies_names,
      include_similar_companies: includeSimilar ?? false,
      max_retries_per_url: 3,
      ignore_url_failures: true,
    };

    // Run actor synchronously and get dataset items directly
    const response = await fetch(
      `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_API_KEY}&timeout=120&format=json`,
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
    console.log(`ZoomInfo company results: ${Array.isArray(results) ? results.length : 0} items`);

    return new Response(
      JSON.stringify({ success: true, data: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("apify-zoominfo-company error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

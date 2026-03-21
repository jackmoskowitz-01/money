import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "pratikdani~zoominfo-people-profile-scraper";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) throw new Error("APIFY_API_KEY is not configured");

    const { profileUrl, profileUrls } = await req.json();

    // This actor takes a single URL per run, but we'll batch multiple sequentially
    const urls: string[] = profileUrls || (profileUrl ? [profileUrl] : []);

    if (urls.length === 0) {
      return new Response(
        JSON.stringify({ error: "Provide profileUrl (string) or profileUrls (array)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`ZoomInfo people search: ${urls.length} profile(s)`);

    const allResults: unknown[] = [];

    for (const url of urls) {
      console.log(`Scraping profile: ${url}`);

      const response = await fetch(
        `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_API_KEY}&timeout=120&format=json`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Apify error for ${url}:`, response.status, errText);
        allResults.push({ url, error: `Failed [${response.status}]` });
        continue;
      }

      const items = await response.json();
      if (Array.isArray(items)) {
        allResults.push(...items);
      } else {
        allResults.push(items);
      }
    }

    console.log(`ZoomInfo people results: ${allResults.length} items`);

    return new Response(
      JSON.stringify({ success: true, data: allResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("apify-zoominfo-people error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

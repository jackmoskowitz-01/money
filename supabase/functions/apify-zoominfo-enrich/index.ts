import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APIFY_BASE = "https://api.apify.com/v2";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const APIFY_API_KEY = Deno.env.get("APIFY_API_KEY");
    if (!APIFY_API_KEY) throw new Error("APIFY_API_KEY is not configured");

    const { companyName, companyUrl, entityId, importContacts, peopleProfileUrls } = await req.json();

    if (!companyName && !companyUrl) {
      return new Response(
        JSON.stringify({ error: "Provide companyName or companyUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<string, unknown> = {};

    // ── Step 1: Company enrichment ──
    console.log(`ZoomInfo enriching company: ${companyName || companyUrl}`);
    const companyInput = {
      urls_or_companies_names: [companyUrl || companyName],
      include_similar_companies: false,
      max_retries_per_url: 3,
      ignore_url_failures: true,
    };

    const companyResp = await fetch(
      `${APIFY_BASE}/acts/ecomscrape~zoominfo-company-scraper/run-sync-get-dataset-items?token=${APIFY_API_KEY}&timeout=120&format=json`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(companyInput) }
    );

    if (!companyResp.ok) {
      const errText = await companyResp.text();
      console.error("Company scrape failed:", companyResp.status, errText);
      throw new Error(`Company scrape failed [${companyResp.status}]`);
    }

    const companyData = await companyResp.json();
    const company = Array.isArray(companyData) ? companyData[0] : companyData;

    if (!company || company.error) {
      return new Response(
        JSON.stringify({ error: "No company data found", raw: company }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map ZoomInfo company data → ProspectEnrichment shape
    const addr = company.address || {};
    const hq = [addr.city, addr.state, addr.country].filter(Boolean).join(", ");
    const empCount = company.number_of_employees;
    const empNum = parseInt(empCount, 10);
    let companySize = "mid-market";
    if (empNum < 50) companySize = "startup";
    else if (empNum < 200) companySize = "small";
    else if (empNum < 1000) companySize = "mid-market";
    else companySize = "enterprise";

    const enrichment = {
      industry: company.industries?.join(", ") || null,
      employeeCount: empCount || null,
      companySize,
      headquarters: hq || null,
      officeLocations: hq ? [hq] : [],
      description: company.description || null,
      recentNews: [],
      spaceDetails: { currentSqft: null, buildingName: null, leaseExpiration: null },
      creSignals: [] as string[],
      confidenceScore: 90,
      revenue: company.revenue_text || null,
      revenueRaw: company.revenue || null,
      website: company.website || null,
      foundingYear: company.founding_year || null,
      stockSymbol: company.stock_symbol || null,
      phone: company.phone_number || null,
      socialLinks: company.social_network_urls || [],
      fundings: company.fundings || null,
      zoomInfoId: company.id || null,
      zoomInfoUrl: company.url || null,
      source: "zoominfo",
    };

    // Generate CRE signals from ZoomInfo data
    if (company.revenue_text) {
      enrichment.creSignals.push(`Revenue: ${company.revenue_text}`);
    }
    if (company.founding_year) {
      const age = new Date().getFullYear() - company.founding_year;
      if (age <= 5) enrichment.creSignals.push(`Young company (founded ${company.founding_year}) — likely in growth phase`);
    }
    if (empNum > 500) {
      enrichment.creSignals.push(`${empCount} employees — enterprise-scale tenant potential`);
    }
    if (company.fundings?.totals?.last_funding_amount) {
      enrichment.creSignals.push(`Recent funding: ${company.fundings.totals.last_funding_amount} — potential expansion signal`);
    }

    results.enrichment = enrichment;
    results.rawCompany = company;

    // ── Step 2: People profile import (optional) ──
    if (importContacts && peopleProfileUrls?.length > 0 && entityId) {
      console.log(`Importing ${peopleProfileUrls.length} ZoomInfo people profiles`);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);

      const importedContacts: unknown[] = [];

      for (const profileUrl of peopleProfileUrls.slice(0, 10)) {
        try {
          const peopleResp = await fetch(
            `${APIFY_BASE}/acts/pratikdani~zoominfo-people-profile-scraper/run-sync-get-dataset-items?token=${APIFY_API_KEY}&timeout=120&format=json`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: profileUrl }) }
          );

          if (!peopleResp.ok) {
            const errText = await peopleResp.text();
            console.error(`People scrape failed for ${profileUrl}:`, errText);
            continue;
          }

          const peopleData = await peopleResp.json();
          const person = Array.isArray(peopleData) ? peopleData[0] : peopleData;
          if (!person || !person.full_name) continue;

          // Map to company_contacts
          const contactData = {
            entity_id: entityId,
            name: person.full_name,
            email: person.contact_info?.email?.replace(/\*/g, '') || person.email || "",
            title: person.title || person.job_title || "",
            mobile_phone: person.contact_info?.mobile || null,
            direct_phone: person.contact_info?.phone || null,
          };

          const { data: inserted, error } = await sb
            .from("company_contacts")
            .insert(contactData)
            .select()
            .single();

          if (error) {
            console.error(`Failed to insert contact ${person.full_name}:`, error.message);
          } else {
            importedContacts.push(inserted);
          }
        } catch (err) {
          console.error(`Error processing ${profileUrl}:`, err);
        }
      }

      results.importedContacts = importedContacts;
      results.peopleImportCount = importedContacts.length;
    }

    console.log("ZoomInfo enrichment complete");

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("apify-zoominfo-enrich error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();

    // Accept flexible field names from Zapier/ZoomInfo
    const name = body.company_name || body.companyName || body.name || body.Company || "";
    const website = body.website || body.Website || body.company_website || "";
    const address = body.headquarters || body.address || body.Address || body.hq || "";
    const industry = body.industry || body.Industry || null;
    const employeeCount = body.employee_count || body.employees || body.Employees || null;
    const revenue = body.revenue || body.Revenue || null;
    const description = body.description || body.Description || null;
    const phone = body.phone || body.Phone || null;
    const foundingYear = body.founding_year || body.founded || null;

    if (!name) {
      return new Response(
        JSON.stringify({ error: "Missing required field: company_name or name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate by name (case-insensitive)
    const { data: existing } = await sb
      .from("custom_prospects")
      .select("id, name")
      .ilike("name", name)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: "Prospect already exists", id: existing.id, name: existing.name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build enrichment from ZoomInfo data if available
    let enrichment = null;
    if (industry || employeeCount || revenue || description) {
      const empNum = parseInt(employeeCount, 10);
      let companySize = "mid-market";
      if (empNum < 50) companySize = "startup";
      else if (empNum < 200) companySize = "small";
      else if (empNum < 1000) companySize = "mid-market";
      else companySize = "enterprise";

      enrichment = {
        industry,
        employeeCount: employeeCount?.toString() || null,
        companySize: isNaN(empNum) ? null : companySize,
        headquarters: address || null,
        officeLocations: address ? [address] : [],
        description,
        recentNews: [],
        spaceDetails: { currentSqft: null, buildingName: null, leaseExpiration: null },
        creSignals: [] as string[],
        confidenceScore: 85,
        revenue: revenue || null,
        website: website || null,
        foundingYear: foundingYear || null,
        phone: phone || null,
        enrichedAt: new Date().toISOString(),
        citations: [],
        source: "zoominfo-zapier",
      };

      if (revenue) enrichment.creSignals.push(`Revenue: ${revenue}`);
      if (empNum > 500) enrichment.creSignals.push(`${employeeCount} employees — enterprise-scale tenant potential`);
    }

    const { data: prospect, error } = await sb
      .from("custom_prospects")
      .insert({
        name,
        website: website || "",
        address: address || "",
        enrichment,
        source: "zapier",
      })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      throw new Error(error.message);
    }

    console.log(`Webhook created prospect: ${name} (${prospect.id})`);

    return new Response(
      JSON.stringify({ success: true, id: prospect.id, name: prospect.name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("zoominfo-webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
    const allowUnauthenticatedWebhook = Deno.env.get("ALLOW_ZOOMINFO_WEBHOOK_WITHOUT_SECRET") === "true";

    if (!webhookSecret && !allowUnauthenticatedWebhook) {
      return new Response(
        JSON.stringify({
          error:
            "Server misconfiguration: set WEBHOOK_SECRET and send it as header x-webhook-secret, or set ALLOW_ZOOMINFO_WEBHOOK_WITHOUT_SECRET=true for local/dev only.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (webhookSecret) {
      const providedSecret = req.headers.get("x-webhook-secret");
      if (providedSecret !== webhookSecret) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const body = await req.json();

    // Helper to truncate strings for safety
    const truncate = (val: string | null | undefined, max = 500): string =>
      val ? String(val).slice(0, max) : "";
    const truncateOrNull = (val: unknown, max = 500): string | null =>
      val ? String(val).slice(0, max) : null;

    // Accept flexible field names from Zapier/ZoomInfo
    const name = truncate(body.company_name || body.companyName || body.name || body.Company);
    const website = truncate(body.website || body.Website || body.company_website);
    const address = truncate(body.headquarters || body.address || body.Address || body.hq);
    const industry = truncateOrNull(body.industry || body.Industry);
    const employeeCount = body.employee_count || body.employees || body.Employees || null;
    const revenue = body.revenue || body.Revenue || null;
    const description = truncateOrNull(body.description || body.Description, 2000);
    const phone = truncateOrNull(body.phone || body.Phone, 50);
    const foundingYear = body.founding_year || body.founded || null;

    // Validate website URL if provided
    if (website) {
      try {
        new URL(website.startsWith("http") ? website : `https://${website}`);
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid website URL" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

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

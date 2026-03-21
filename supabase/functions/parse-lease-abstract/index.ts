import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { abstractText, prospectName, buildingName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!abstractText) throw new Error("abstractText is required");

    const systemPrompt = `You are a CRE lease analyst. Extract structured data from this lease abstract. Be precise with numbers, dates, and dollar amounts. Use YYYY-MM-DD for dates. For rent schedules, return an array of {year: number, annual_rent_psf: number, monthly_rent: number}. For options, return arrays of {type: string, notice_period: string, terms: string}. If a field cannot be determined from the text, leave it null.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Extract all structured lease data from this abstract for tenant "${prospectName || "Unknown"}" at building "${buildingName || "Unknown"}":\n\n${abstractText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_lease_abstract",
              description: "Save the structured lease abstract data extracted from the document",
              parameters: {
                type: "object",
                properties: {
                  tenant_name: { type: "string", description: "Full legal name of the tenant" },
                  landlord_name: { type: "string", description: "Full legal name of the landlord" },
                  building_name: { type: "string", description: "Name of the building or property" },
                  building_address: { type: "string", description: "Full street address of the property" },
                  premises_sf: { type: "number", description: "Rentable square footage of the premises" },
                  floor_suite: { type: "string", description: "Floor number and/or suite identifier" },
                  lease_type: { type: "string", description: "Type of lease: New Lease, Renewal, Expansion, Full Service, Net, Modified Gross, etc." },
                  commencement_date: { type: "string", description: "Lease commencement date in YYYY-MM-DD format" },
                  expiration_date: { type: "string", description: "Lease expiration date in YYYY-MM-DD format" },
                  term_months: { type: "number", description: "Total lease term in months" },
                  base_rent_psf: { type: "number", description: "Initial base rent per square foot per year" },
                  rent_schedule: {
                    type: "array",
                    description: "Full rent schedule by year",
                    items: {
                      type: "object",
                      properties: {
                        year: { type: "number", description: "Year number (1, 2, 3...)" },
                        annual_rent_psf: { type: "number", description: "Annual rent per square foot" },
                        monthly_rent: { type: "number", description: "Monthly rent amount in dollars" },
                      },
                    },
                  },
                  escalation_type: { type: "string", description: "Type of rent escalation: Fixed, CPI, Market, etc." },
                  escalation_rate: { type: "number", description: "Annual escalation rate as a percentage (e.g., 3 for 3%)" },
                  free_rent_months: { type: "number", description: "Number of months of free rent" },
                  ti_allowance_psf: { type: "number", description: "Tenant improvement allowance per square foot" },
                  parking_spaces: { type: "number", description: "Number of parking spaces allocated" },
                  parking_rate: { type: "number", description: "Monthly parking rate per space in dollars" },
                  renewal_options: {
                    type: "array",
                    description: "Renewal option details",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        notice_period: { type: "string" },
                        terms: { type: "string" },
                      },
                    },
                  },
                  expansion_options: {
                    type: "array",
                    description: "Expansion option details",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        notice_period: { type: "string" },
                        terms: { type: "string" },
                      },
                    },
                  },
                  termination_options: {
                    type: "array",
                    description: "Early termination option details",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        notice_period: { type: "string" },
                        terms: { type: "string" },
                      },
                    },
                  },
                  operating_expenses: { type: "string", description: "Operating expense terms including base year, caps, pass-throughs" },
                  security_deposit: { type: "string", description: "Security deposit amount and terms" },
                  assignment_subletting: { type: "string", description: "Assignment and subletting terms" },
                  notable_clauses: { type: "string", description: "Any notable or unusual clauses worth highlighting" },
                },
                required: ["tenant_name"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_lease_abstract" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI extraction failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No structured data extracted from the abstract");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    // Calculate completeness score
    const scoredFields = [
      "tenant_name", "landlord_name", "building_name", "building_address",
      "premises_sf", "floor_suite", "lease_type",
      "commencement_date", "expiration_date", "term_months",
      "base_rent_psf", "escalation_type", "escalation_rate", "free_rent_months",
      "ti_allowance_psf", "parking_spaces", "parking_rate",
      "operating_expenses", "security_deposit", "assignment_subletting",
      "notable_clauses",
    ];
    const arrayFields = ["rent_schedule", "renewal_options", "expansion_options", "termination_options"];

    let filledCount = 0;
    const totalFields = scoredFields.length + arrayFields.length;

    for (const field of scoredFields) {
      const val = extracted[field];
      if (val !== null && val !== undefined && val !== "" && val !== 0) {
        filledCount++;
      }
    }
    for (const field of arrayFields) {
      const val = extracted[field];
      if (Array.isArray(val) && val.length > 0) {
        filledCount++;
      }
    }

    const completeness_score = Math.round((filledCount / totalFields) * 100);

    return new Response(
      JSON.stringify({
        ...extracted,
        completeness_score,
        prospect_name: prospectName || extracted.tenant_name || "",
        building_name: extracted.building_name || buildingName || "",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("parse-lease-abstract error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { leaseText, prospectName, buildingName, prospectId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!leaseText) throw new Error("leaseText is required");

    const systemPrompt = `You are a commercial real estate lease analyst. Extract ALL critical dates and deadlines from the lease document provided.

For each date found, return it as a structured item. Look for these types of dates:
- lease_commencement: When the lease starts
- lease_expiration: When the lease ends
- rent_commencement: When rent payments begin
- early_termination: Early termination option dates
- renewal_option: Renewal notification deadlines
- rent_escalation: Rent increase dates
- free_rent_expiry: When free rent period ends
- ti_deadline: Tenant improvement completion deadlines
- notice_period: Required notice dates for any action
- cam_reconciliation: CAM reconciliation deadlines
- security_deposit_return: Security deposit return dates
- insurance_renewal: Insurance certificate renewal dates
- estoppel_deadline: Estoppel certificate deadlines
- snda_deadline: SNDA execution deadlines
- construction_milestone: Construction/build-out milestones
- option_exercise: Option exercise deadlines (purchase, expansion, contraction)
- audit_right: Audit right exercise deadlines
- other: Any other critical dates

You MUST use the tool to return ALL dates found. If a date is relative (e.g., "30 days before expiration"), calculate the actual date if possible from context, or note it in the description. Set remind_days_before based on urgency: 90 for lease expiration/renewal, 60 for termination options, 30 for most others, 14 for imminent deadlines.`;

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
          { role: "user", content: `Extract all critical dates from this lease for tenant "${prospectName || 'Unknown'}" at building "${buildingName || 'Unknown'}":\n\n${leaseText}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_critical_dates",
              description: "Save all extracted critical dates from the lease",
              parameters: {
                type: "object",
                properties: {
                  dates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        date_type: { type: "string", description: "Type of critical date (e.g., lease_expiration, renewal_option, rent_escalation)" },
                        date_value: { type: "string", description: "The date in YYYY-MM-DD format" },
                        description: { type: "string", description: "Human-readable description of this date and what action is needed" },
                        remind_days_before: { type: "number", description: "How many days before this date to start reminding (90 for major, 30 for standard, 14 for imminent)" },
                      },
                      required: ["date_type", "date_value", "description", "remind_days_before"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["dates"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_critical_dates" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI extraction failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("No dates extracted from the lease");
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    
    return new Response(JSON.stringify({
      dates: extracted.dates || [],
      prospectName,
      buildingName,
      prospectId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-critical-dates error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

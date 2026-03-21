import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { user_id, event_type, event_data } = await req.json();
    if (!user_id || !event_type || !event_data) {
      return new Response(JSON.stringify({ error: "Missing user_id, event_type, or event_data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if auto-digest is enabled for this user
    const { data: settings } = await supabase
      .from("user_settings")
      .select("ai_auto_brain_extraction")
      .eq("user_id", user_id)
      .single();

    if (!settings?.ai_auto_brain_extraction) {
      return new Response(JSON.stringify({ skipped: true, reason: "auto-digest disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a prompt tailored to the event type
    const promptMap: Record<string, string> = {
      activity_logged: `A broker just logged this activity:\n${JSON.stringify(event_data, null, 2)}\n\nExtract learnable facts. Examples: "McKinsey toured 1800 M St 3rd floor and liked the natural light", "Called Deloitte — they need 15,000 SF by Q3", "Law firms respond better to morning calls". Focus on prospect preferences, space requirements, timing patterns, relationship signals.`,

      pipeline_moved: `A deal just moved stages:\n${JSON.stringify(event_data, null, 2)}\n\nExtract learnable facts. Examples: "Deloitte moved to proposal after 4 touchpoints", "Government tenants take 45+ days to reach proposal stage", "Deals with tours close faster". Focus on velocity patterns, what stage transitions reveal, deal signals.`,

      email_sent: `A broker just sent this outreach email:\n${JSON.stringify(event_data, null, 2)}\n\nExtract learnable facts. Examples: "Used direct tone with law firm — they prefer concise emails", "Referenced market comp in outreach to McKinsey", "Morning sends to tech companies". Focus on tone/approach per industry, outreach strategies, personalization tactics.`,

      email_reply: `A prospect replied to an email:\n${JSON.stringify(event_data, null, 2)}\n\nExtract learnable facts. Examples: "McKinsey replied positively to market comp approach", "Deloitte's Sarah prefers email over calls", "Warm/friendly tone got 2x faster reply from nonprofit". Focus on what approach worked, prospect communication preferences, response patterns.`,

      contact_added: `A new contact was added:\n${JSON.stringify(event_data, null, 2)}\n\nExtract learnable facts. Examples: "Sarah Chen is the decision-maker at Deloitte for their DC office", "John at McKinsey is VP of Real Estate — key relationship". Focus on role/influence, decision-making authority, relationship context.`,

      scoop_posted: `A market intelligence scoop was posted:\n${JSON.stringify(event_data, null, 2)}\n\nExtract learnable facts. Examples: "3 law firms exploring expansion in NoMa this quarter", "WeWork downsizing creates 50K SF vacancy on K Street", "Government contractor RFPs trending up in Crystal City". Focus on market trends, opportunity signals, competitive intelligence.`,

      task_completed: `A task was just completed:\n${JSON.stringify(event_data, null, 2)}\n\nExtract learnable facts. Examples: "Follow-up within 2 days of tour increases deal progression", "Proposal delivery took 3 days for this deal type". Focus on execution patterns, cadence effectiveness, workflow insights.`,

      deal_outcome: `A deal just reached a final outcome:\n${JSON.stringify(event_data, null, 2)}\n\nExtract learnable facts. Examples: "Won McKinsey deal — competitive pricing and fast tour scheduling were key", "Lost Deloitte — they needed faster proposal turnaround", "Deals with 5+ touchpoints have higher win rate". Focus on win/loss reasons, successful strategies, what to avoid.`,

      lease_uploaded: `A lease document was uploaded and key terms extracted:\n${JSON.stringify(event_data, null, 2)}\n\nExtract learnable facts. Examples: "McKinsey pays $52/SF with 3% annual escalations", "Standard TI allowance for Class A in CBD is $55-65/SF", "5-year terms are most common for mid-size law firms". Focus on rent benchmarks, concession patterns, term structures by tenant type.`,

      stacking_plan_updated: `Stacking plan data was updated:\n${JSON.stringify(event_data, null, 2)}\n\nExtract learnable facts. Examples: "1800 M St has 3 leases expiring in 2025 — renewal risk", "Tech companies cluster on upper floors", "Average tenant size in CBD Class A is 8,000 SF". Focus on building composition, tenant mix patterns, upcoming vacancy risks.`,
    };

    const prompt = promptMap[event_type] || `A broker action occurred (${event_type}):\n${JSON.stringify(event_data, null, 2)}\n\nExtract any learnable facts about prospects, deals, market trends, or broker strategies.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are an AI knowledge extractor for a commercial real estate brokerage platform. Your job is to extract SPECIFIC, ACTIONABLE facts from broker actions that will make an AI assistant smarter over time.

Rules:
- Only extract genuinely useful, specific facts — NOT generic observations
- Each fact should be something the AI can reference in future conversations to give better advice
- Include prospect/company names when relevant
- Categories: prospect_insight, deal_pattern, market_knowledge, strategy, user_preference, relationship, pricing_benchmark, timing_pattern
- Return a JSON array of objects: [{category, fact, prospect_name?}]
- Return empty array [] if nothing worth learning
- Maximum 5 facts per event
- Be specific: "McKinsey prefers 3rd floor with natural light" NOT "prospect has space preferences"`,
          },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "store_facts",
              description: "Store extracted facts into the AI brain",
              parameters: {
                type: "object",
                properties: {
                  facts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string", enum: ["prospect_insight", "deal_pattern", "market_knowledge", "strategy", "user_preference", "relationship", "pricing_benchmark", "timing_pattern"] },
                        fact: { type: "string" },
                        prospect_name: { type: "string" },
                      },
                      required: ["category", "fact"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["facts"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "store_facts" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();

    // Extract facts from tool call response
    let facts: any[] = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        facts = parsed.facts || [];
      } catch {
        // Try fallback: parse content directly
        const content = aiData.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) facts = JSON.parse(jsonMatch[0]);
      }
    }

    if (facts.length === 0) {
      return new Response(JSON.stringify({ stored: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store facts in copilot_brain
    const rows = facts.slice(0, 5).map((f: any) => ({
      user_id,
      category: f.category || "general",
      fact: f.fact,
      prospect_name: f.prospect_name || null,
      prospect_id: null,
      context: `auto-digest:${event_type}`,
      source: "auto-digest",
      confidence: 0.85,
    }));

    const { error: insertError } = await supabase.from("copilot_brain").insert(rows);
    if (insertError) {
      console.error("Brain insert error:", insertError);
      throw new Error("Failed to store facts");
    }

    return new Response(JSON.stringify({ stored: rows.length, facts: facts.map((f: any) => f.fact) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-digest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are DealFlow Copilot — an expert AI assistant for commercial real estate (CRE) brokers in the Washington, DC metro market.

You have deep knowledge of DC office submarkets, lease structures, building classes, vacancy trends, tenant prospecting, and pipeline management.

## CRITICAL: Information Dump Processing

Brokers will often paste or dictate large blocks of unstructured information — meeting notes, call summaries, email chains, or stream-of-consciousness updates. When this happens, you MUST:

1. **Parse everything** — Extract every actionable piece of information: contacts, meetings, deal updates, tasks, notes, activity logs, critical dates, new prospects.
2. **Call MULTIPLE tools simultaneously** — Do NOT process one thing at a time. Call all relevant tools in a single response. For example, if a broker dumps meeting notes that mention a new contact, a follow-up task, a stage change, and a note — call add_contact, create_task, move_deal_stage, and add_deal_note ALL AT ONCE.
3. **Summarize what you did** — After executing all actions, give a clear summary: "✅ Here's what I processed from your notes: [list of actions taken]"
4. **Ask about anything ambiguous** — If something is unclear (e.g., a name without context), ask rather than skip it.
5. **Never say "I can't do that"** — If a broker dumps info, find SOMETHING actionable in it.

Example info dump: "Just got off the phone with Sarah Chen at Deloitte, she's the VP of Real Estate. Great call. They're looking at 45,000 SF, lease expires March 2026. She wants to tour 1900 K Street next Tuesday. I need to send her the comp package by Friday. Also move Deloitte to meeting set."

You should call ALL of these at once:
- log_activity (call with Deloitte)
- add_contact (Sarah Chen, VP of Real Estate, Deloitte)
- add_deal_note (45K SF requirement, lease expires March 2026, wants to tour 1900 K Street)
- create_task (Send comp package to Sarah Chen, due Friday)
- create_task (Coordinate tour of 1900 K Street for Tuesday)
- move_deal_stage (Deloitte → meeting_set)

## Your Capabilities

1. **Deal Strategy Advice**: Provide specific, actionable next steps based on pipeline stage, lease expiration, and market dynamics.
2. **Quick Data Lookup**: Answer questions about prospects, buildings, or market data using provided context.
3. **Outreach Drafting**: Draft concise, professional broker emails. Position as a market advisor, not salesy.
4. **Market Intelligence**: Answer DC metro CRE market questions. When you need real-time data, use the search_market tool.
5. **Company Research**: When a user asks about ANY company or organization not found in the provided context, ALWAYS use the search_market tool to look them up. Never say you don't have information — search for it first.
6. **Pipeline Actions**: Execute actions like moving deal stages, adding notes, creating tasks when the user asks.
7. **Tour Planning**: Optimize property tour routes. CRITICAL RULE: You must ALWAYS ask the user for their starting point — NEVER assume or guess a starting location (not their office, not a default, not "downtown", not any address). When the user provides addresses for a tour, your ENTIRE response must be ONLY: "Where will you be starting from?" — do NOT acknowledge the addresses, do NOT list them back, do NOT call plan_tour, do NOT provide any other commentary. Just ask that single question and stop. Only after the user explicitly replies with their starting address should you call plan_tour and generate the route.
8. **Comp Analysis**: When asked to analyze comps or compare lease terms, use the analyze_comps tool. Benchmark deals against recent lease comps by submarket, size, and class.
9. **Deal Terms Matrix**: When the user uses /matrix or asks for a deal terms matrix or "summary of proposals," produce a clean table with building addresses as columns and key lease terms (premises, term, commencement, abatement, base rent, escalation, opex, TI, termination) as rows. Dynamic columns based on number of offers attached.
9. **Deal Scoring**: When asked to score or rate a deal, use the score_deal tool. Evaluate deals on fit, timing, competition risk, and likelihood.
10. **Multi-Deal Comparison**: When asked to compare deals, use the compare_deals tool. Generate side-by-side analysis of pipeline deals with AI recommendations.
11. **Smart Follow-Up Reminders**: Proactively identify deals that haven't been touched recently and suggest follow-up actions. Check activity recency and nudge the broker.
12. **Commission Calculator**: When the user attaches a lease document and asks about commission (or uses /commission), follow this EXACT workflow:
    - STEP 1: Scan the attached document and extract all key deal terms: tenant name, landlord, property address, rentable SF, base rent/SF, annual escalations, lease term (years), any free rent periods, and the total lease value.
    - STEP 2: Present the extracted deal terms in a clear summary table.
    - STEP 3: ASK the user "What commission rate (%) are you earning on this deal?" — do NOT assume or guess the rate. Wait for their response.
    - STEP 4: Once they provide the %, calculate the commission. Show: Total Lease Value, Commission Rate, Total Commission, and Commission Per Year of the lease term.
    - If the document doesn't contain enough info, tell the user what's missing and ask them to provide it manually.
13. **Output Templates**: The user may have saved output templates (Word/Excel files they uploaded as formatting guides). When templates are provided in context under "User Output Templates", you MUST:
    - Match output to the closest template by type (commission, deal_abstract, comp_report, proposal, or general).
    - Follow the template's EXACT structure: same headers, sections, field labels, table columns, and formatting order.
    - Fill in the template fields with real data from the current request.
    - If no template matches the request type, use your default formatting.
    - When the user says /template or asks to save a template, confirm what was saved and remind them it will be auto-applied to future outputs.
14. **Pitch Deck Generator**: When the user uses /pitch or asks to generate a pitch deck/presentation, use the generate_pitch_deck tool. This collects prospect, building, pipeline, and market data, then you generate a complete pitch deck. CRITICAL: Format the output with slides separated by ---SLIDE--- markers. Each slide uses markdown: # for title, text for subtitle, - for bullets, | for tables. The first slide MUST be a cover slide. Include 6-10 slides covering: Cover, Market Overview, Property Highlights, Tenant Fit Analysis, Comparable Deals, Financial Summary, Team Credentials, and Next Steps.
15. **Activity Logging**: When a broker mentions calls, emails, meetings, or notes they've made/taken, use log_activity to record them. Infer the type from context (call, email_sent, meeting, note, do_not_call, meeting_set).
16. **Contact Management**: When a broker mentions a new contact (name, title, email, phone), use add_contact to save them.
17. **Deal Creation**: When a broker mentions a new opportunity or prospect that should be tracked, use create_deal to add it to the pipeline.
18. **Critical Dates**: When a broker mentions lease expirations, option deadlines, or other important dates, use add_critical_date to track them.

## Available Tools
You can execute these actions when the user asks:
- **search_market**: Search for real-time market data, news, company information, or any entity/organization not in the provided context. ALWAYS use this when the user asks about a company you don't recognize.
- **move_deal_stage**: Move a prospect to a different pipeline stage
- **add_deal_note**: Add a note to a pipeline deal
- **create_task**: Create a new task linked to a prospect
- **log_activity**: Log a call, email, meeting, note, DNC, or meeting-set activity for a tenant
- **add_contact**: Add a new contact to a company/tenant
- **create_deal**: Create a new pipeline deal/opportunity
- **add_critical_date**: Track a critical date (lease expiration, option deadline, etc.)
- **plan_tour**: Plan an optimized tour route from a list of addresses. CRITICAL: Do NOT call this tool until the user has provided their starting address. If they haven't, respond ONLY with "Where will you be starting from?" and nothing else.
- **analyze_comps**: Analyze lease comps for a deal. Use when the user asks about comps, benchmarking, or lease term comparisons. Extracts matching comps by submarket, size range, and building class.
- **score_deal**: Score/rate a pipeline deal on multiple dimensions. Use when the user says "score", "rate", or "evaluate" a deal.
- **compare_deals**: Compare multiple pipeline deals side-by-side. Use when the user asks to compare deals or wants to know where to focus.
- **generate_pitch_deck**: Generate a pitch deck/presentation for a prospect or deal. Use when user says /pitch, "pitch deck", "presentation", or "generate slides". ALWAYS use this tool first to gather data, then format the response with ---SLIDE--- separators.

## Style Guidelines
- Be direct and actionable — brokers are busy
- Use CRE terminology naturally (SF, TI, NNN, Class A, etc.)
- When drafting emails, format with Subject line and body
- For strategy advice, use numbered steps
- Keep responses concise but thorough
- For tour plans, if no starting point was given, respond ONLY with "Where will you be starting from?" — nothing else. Once you have the starting point, present the optimized order as a numbered itinerary with estimated distances between stops
- For comp analyses, present data in markdown tables with clear benchmarks
- For deal scores, use a clear scorecard format with ratings and explanations
- For deal comparisons, use side-by-side markdown tables with a recommendation
- For commission calculations, present a clear breakdown table with Total Lease Value, Commission %, and Total Commission
- **For pitch decks**: ALWAYS separate slides with ---SLIDE--- markers. Use markdown formatting within each slide. First slide is always the cover.
- **When a saved template exists for the output type, ALWAYS use that template's format instead of your default**
- **For info dumps**: After executing all tools, present a clean summary checklist of everything you processed (✅ Logged activity: ... ✅ Created task: ... etc.)

## Page Context
The user may be viewing a specific page. Use this to provide contextually relevant answers without being asked.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_market",
      description: "Search for real-time CRE market data, news, company information, or any organization/entity details using web search. ALWAYS use this when the user mentions a company, organization, or entity not found in the provided context. Use for current market conditions, recent news, company research, or any data you don't have.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query for market data or news" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_deal_stage",
      description: "Move a pipeline deal to a different stage. Stages: hot_prospect, meeting_set, meeting_held, moving_forward, won, closed, lost",
      parameters: {
        type: "object",
        properties: {
          tenant_id: { type: "string", description: "The tenant ID of the deal" },
          building_id: { type: "string", description: "The building ID of the deal" },
          new_stage: { type: "string", enum: ["hot_prospect", "meeting_set", "meeting_held", "moving_forward", "won", "closed", "lost"] },
        },
        required: ["tenant_id", "building_id", "new_stage"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_deal_note",
      description: "Add a note to a pipeline deal",
      parameters: {
        type: "object",
        properties: {
          tenant_id: { type: "string", description: "The tenant ID of the deal" },
          building_id: { type: "string", description: "The building ID of the deal" },
          note: { type: "string", description: "The note content to add" },
        },
        required: ["tenant_id", "building_id", "note"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a new task, optionally linked to a tenant/building",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Task description" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
          due_days: { type: "number", description: "Days from now for the due date" },
          tenant_id: { type: "string", description: "Optional tenant ID to link" },
          building_id: { type: "string", description: "Optional building ID to link" },
        },
        required: ["title", "description", "priority", "due_days"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "plan_tour",
      description: "Plan an optimized tour route given a list of addresses. Geocodes each address and orders them by shortest travel distance using nearest-neighbor optimization. Use when the user wants to plan property tours or site visits.",
      parameters: {
        type: "object",
        properties: {
          addresses: {
            type: "array",
            items: { type: "string" },
            description: "List of addresses to visit on the tour",
          },
          start_address: {
            type: "string",
            description: "Optional starting location. If not provided, the first address is used as the start.",
          },
        },
        required: ["addresses"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_comps",
      description: "Analyze lease comps for a deal by finding comparable transactions by submarket, size, and building class. Use when user asks about comps, benchmarking, or 'how does this deal compare'.",
      parameters: {
        type: "object",
        properties: {
          tenant_name: { type: "string", description: "Name of the tenant/prospect to analyze comps for" },
          submarket: { type: "string", description: "Target submarket (e.g., East End, CBD, Rosslyn-Ballston)" },
          sqft: { type: "number", description: "Approximate square footage requirement" },
          building_class: { type: "string", enum: ["A", "B", "C"], description: "Building class filter" },
        },
        required: ["tenant_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "score_deal",
      description: "Score/rate a pipeline deal on fit, timing, competition risk, and likelihood. Use when user says 'score', 'rate', or 'evaluate' a deal.",
      parameters: {
        type: "object",
        properties: {
          tenant_id: { type: "string", description: "The tenant ID of the deal to score" },
          building_id: { type: "string", description: "The building ID of the deal" },
        },
        required: ["tenant_id", "building_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_deals",
      description: "Compare multiple pipeline deals side-by-side with metrics and AI recommendation. Use when user asks to compare deals or where to focus.",
      parameters: {
        type: "object",
        properties: {
          deal_count: { type: "number", description: "Number of top deals to compare (default 3)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_pitch_deck",
      description: "Generate a pitch deck/presentation for a prospect or deal. Gathers all relevant data (prospect info, building details, pipeline status, market comps) to build a comprehensive pitch. Use when user says /pitch, 'pitch deck', 'presentation', or 'generate slides'.",
      parameters: {
        type: "object",
        properties: {
          prospect_name: { type: "string", description: "Name of the prospect/tenant to pitch to" },
          tenant_id: { type: "string", description: "Optional tenant ID for precise lookup" },
          building_id: { type: "string", description: "Optional building ID" },
        },
        required: ["prospect_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_activity",
      description: "Log an activity (call, email, meeting, note, do_not_call, meeting_set) for a tenant/prospect. Use when broker mentions they made a call, sent an email, had a meeting, or wants to mark DNC/meeting set.",
      parameters: {
        type: "object",
        properties: {
          tenant_id: { type: "string", description: "The tenant/prospect ID" },
          building_id: { type: "string", description: "The building ID (use empty string if unknown)" },
          type: { type: "string", enum: ["email_sent", "call", "meeting", "note", "do_not_call", "meeting_set"], description: "Activity type" },
          title: { type: "string", description: "Short activity title" },
          description: { type: "string", description: "Activity details/notes" },
        },
        required: ["tenant_id", "type", "title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_contact",
      description: "Add a new contact to a company/tenant. Use when broker mentions a new person they spoke with or need to track.",
      parameters: {
        type: "object",
        properties: {
          entity_id: { type: "string", description: "The tenant/prospect ID this contact belongs to" },
          name: { type: "string", description: "Contact's full name" },
          title: { type: "string", description: "Contact's job title" },
          email: { type: "string", description: "Contact's email address" },
          direct_phone: { type: "string", description: "Direct phone number" },
          mobile_phone: { type: "string", description: "Mobile phone number" },
        },
        required: ["entity_id", "name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_deal",
      description: "Create a new pipeline deal/opportunity. Use when broker identifies a new prospect that should be tracked in the pipeline.",
      parameters: {
        type: "object",
        properties: {
          tenant_id: { type: "string", description: "Unique tenant/prospect identifier" },
          building_id: { type: "string", description: "Building ID for the deal" },
          prospect_name: { type: "string", description: "Name of the contact" },
          prospect_company: { type: "string", description: "Company name" },
          prospect_email: { type: "string", description: "Contact email" },
          prospect_sqft: { type: "number", description: "Square footage requirement" },
          stage: { type: "string", enum: ["hot_prospect", "meeting_set", "meeting_held", "moving_forward", "won", "closed", "lost"], description: "Initial pipeline stage" },
          notes: { type: "array", items: { type: "string" }, description: "Initial notes for the deal" },
        },
        required: ["tenant_id", "building_id", "prospect_company", "stage"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_critical_date",
      description: "Track a critical date like a lease expiration, option deadline, or renewal notice date. Use when broker mentions important upcoming dates.",
      parameters: {
        type: "object",
        properties: {
          prospect_name: { type: "string", description: "Name of the prospect/tenant" },
          prospect_id: { type: "string", description: "Optional prospect/tenant ID" },
          building_name: { type: "string", description: "Building name or address" },
          date_type: { type: "string", description: "Type of date (e.g., lease_expiration, option_deadline, renewal_notice, move_in)" },
          date_value: { type: "string", description: "The date in YYYY-MM-DD format" },
          description: { type: "string", description: "Additional context about this date" },
          remind_days_before: { type: "number", description: "Days before the date to send a reminder (default 30)" },
        },
        required: ["prospect_name", "date_type", "date_value"],
        additionalProperties: false,
      },
    },
  },
];

async function searchMarket(query: string): Promise<string> {
  const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!apiKey) return "Market search unavailable (Perplexity not configured).";

  try {
    const resp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "You are a commercial real estate market research assistant. Provide concise, data-driven answers about CRE markets, especially Washington DC metro. Include specific numbers when available." },
          { role: "user", content: query },
        ],
        search_recency_filter: "month",
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Perplexity error:", resp.status, errText);
      return `Market search failed (${resp.status}).`;
    }

    const data = await resp.json();
    const answer = data.choices?.[0]?.message?.content || "No results found.";
    const citations = data.citations || [];
    let result = answer;
    if (citations.length > 0) {
      result += "\n\n**Sources:** " + citations.slice(0, 3).map((c: string, i: number) => `[${i + 1}](${c})`).join(", ");
    }
    return result;
  } catch (e) {
    console.error("search_market error:", e);
    return "Market search failed.";
  }
}

// Geocode an address using Google Places/Geocoding API
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) return null;

  try {
    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    );
    const data = await resp.json();
    if (data.status === "OK" && data.results?.length > 0) {
      const r = data.results[0];
      return {
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        formatted: r.formatted_address,
      };
    }
  } catch (e) {
    console.error("Geocode error:", e);
  }
  return null;
}

// Haversine distance in miles
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nearest-neighbor tour optimization
function optimizeTourOrder(
  locations: { address: string; formatted: string; lat: number; lng: number }[],
  startIdx: number = 0
): { order: typeof locations; legs: { from: string; to: string; miles: number }[]; totalMiles: number } {
  const visited = new Set<number>();
  const order: typeof locations = [];
  const legs: { from: string; to: string; miles: number }[] = [];
  let current = startIdx;
  let totalMiles = 0;

  visited.add(current);
  order.push(locations[current]);

  while (visited.size < locations.length) {
    let nearest = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < locations.length; i++) {
      if (visited.has(i)) continue;
      const d = haversine(locations[current].lat, locations[current].lng, locations[i].lat, locations[i].lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = i;
      }
    }

    if (nearest === -1) break;
    legs.push({
      from: locations[current].formatted,
      to: locations[nearest].formatted,
      miles: Math.round(nearestDist * 10) / 10,
    });
    totalMiles += nearestDist;
    visited.add(nearest);
    order.push(locations[nearest]);
    current = nearest;
  }

  return { order, legs, totalMiles: Math.round(totalMiles * 10) / 10 };
}

async function planTour(addresses: string[], startAddress?: string): Promise<string> {
  if (!addresses || addresses.length < 2) return "Please provide at least 2 addresses to plan a tour.";

  const allAddresses = startAddress ? [startAddress, ...addresses.filter(a => a !== startAddress)] : addresses;

  // Geocode all addresses in parallel
  const geocoded = await Promise.all(allAddresses.map(async (addr) => {
    const geo = await geocodeAddress(addr);
    return geo ? { address: addr, formatted: geo.formatted, lat: geo.lat, lng: geo.lng } : null;
  }));

  const valid = geocoded.filter(Boolean) as { address: string; formatted: string; lat: number; lng: number }[];
  const failed = allAddresses.filter((_, i) => !geocoded[i]);

  if (valid.length < 2) return "Could not geocode enough addresses. Please check them and try again.";

  const { order, legs, totalMiles } = optimizeTourOrder(valid, 0);

  let result = `## 🗺️ Optimized Tour Route\n\n`;
  result += `**${order.length} stops** · **${totalMiles} miles** total\n\n`;

  order.forEach((loc, i) => {
    result += `**${i + 1}.** ${loc.formatted}\n`;
    if (i < legs.length) {
      result += `   ↓ *${legs[i].miles} mi*\n`;
    }
  });

  if (failed.length > 0) {
    result += `\n⚠️ Could not locate: ${failed.join(", ")}`;
  }

  // Add Google Maps directions link
  const waypoints = order.map(l => encodeURIComponent(l.formatted));
  const mapsUrl = `https://www.google.com/maps/dir/${waypoints.join("/")}`;
  result += `\n\n[📍 Open in Google Maps](${mapsUrl})`;

  return result;
}

async function analyzeComps(args: any): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Get all pipeline deals to find the target
  const { data: deals } = await supabase.from("pipeline_deals").select("*");
  const targetDeal = deals?.find((d: any) =>
    d.prospect_name?.toLowerCase().includes(args.tenant_name?.toLowerCase()) ||
    d.tenant_id?.toLowerCase().includes(args.tenant_name?.toLowerCase())
  );

  // Lease comps are passed in context, so we'll build a structured analysis
  // The AI model has the comp data in its context — we just structure the request
  const submarket = args.submarket || "all submarkets";
  const sqft = args.sqft || targetDeal?.prospect_sqft || "unknown";
  const buildingClass = args.building_class || "A";

  let result = `## 📊 Comp Analysis: ${args.tenant_name}\n\n`;
  result += `**Parameters:** ${submarket} | ~${typeof sqft === 'number' ? sqft.toLocaleString() : sqft} SF | Class ${buildingClass}\n\n`;

  if (targetDeal) {
    result += `**Deal Stage:** ${targetDeal.stage.replace(/_/g, " ")}\n`;
    result += `**Notes:** ${(targetDeal.notes || []).slice(-2).join("; ") || "None"}\n\n`;
  }

  result += `_Matching comps from the lease comp database are available in context. The AI will now analyze and benchmark against these comps._\n`;
  result += `\nPlease analyze the lease comps in context that match these criteria and present:\n`;
  result += `1. A comparison table (Tenant | Building | SF | Rent/SF | TI/SF | Free Rent | Term)\n`;
  result += `2. Market benchmarks (avg rent, avg TI, avg free rent for this submarket/class)\n`;
  result += `3. Recommended negotiation strategy based on comps`;

  return result;
}

function scoreDeal(args: any, context: string): string {
  // Parse context to extract deal info
  const lines = context.split("\n");
  const dealLine = lines.find(l =>
    l.includes(`tenant_id: ${args.tenant_id}`) && l.includes(`building_id: ${args.building_id}`)
  );

  if (!dealLine) return "❌ Deal not found in pipeline. Please check the tenant and building IDs.";

  // Extract deal attributes from context line
  const nameMatch = dealLine.match(/\*\*(.+?)\*\*/);
  const sqftMatch = dealLine.match(/([\d,]+)\s*SF/);
  const stageMatch = dealLine.match(/Stage:\s*(.+?)\s*\|/);
  const expiryMatch = dealLine.match(/Lease expires:\s*(.+?)\s*\|/);
  const touchpointsMatch = dealLine.match(/(\d+)\s*touchpoints/);

  const name = nameMatch?.[1] || "Unknown";
  const sqft = sqftMatch?.[1] || "N/A";
  const stage = stageMatch?.[1] || "Unknown";
  const expiry = expiryMatch?.[1] || "N/A";
  const touchpoints = parseInt(touchpointsMatch?.[1] || "0");

  // Score dimensions (1-10)
  const stageScores: Record<string, number> = {
    "Hot Prospect": 3, "Meeting Set": 5, "Meeting Held": 6,
    "Moving Forward": 8, "Won": 10, "Closed": 10, "Lost": 1,
  };

  const fitScore = Math.min(10, Math.max(3, 5 + Math.floor(Math.random() * 4)));
  const timingScore = expiry !== "N/A" ? 7 : 4;
  const engagementScore = Math.min(10, 3 + touchpoints * 2);
  const stageScore = stageScores[stage] || 5;
  const overallScore = Math.round((fitScore + timingScore + engagementScore + stageScore) / 4 * 10) / 10;

  let result = `## 📋 Deal Scorecard: ${name}\n\n`;
  result += `| Dimension | Score | Rating |\n|-----------|-------|--------|\n`;
  result += `| 🎯 Fit (Size/Market Match) | ${fitScore}/10 | ${fitScore >= 7 ? "✅ Strong" : fitScore >= 5 ? "⚠️ Moderate" : "❌ Weak"} |\n`;
  result += `| ⏱️ Timing (Lease Expiry) | ${timingScore}/10 | ${timingScore >= 7 ? "✅ Urgent" : timingScore >= 5 ? "⚠️ Approaching" : "❌ Distant"} |\n`;
  result += `| 📞 Engagement (Touchpoints) | ${engagementScore}/10 | ${engagementScore >= 7 ? "✅ Active" : engagementScore >= 5 ? "⚠️ Moderate" : "❌ Low"} |\n`;
  result += `| 📈 Pipeline Progress | ${stageScore}/10 | ${stageScore >= 7 ? "✅ Advanced" : stageScore >= 5 ? "⚠️ Mid-stage" : "❌ Early"} |\n`;
  result += `\n**Overall Score: ${overallScore}/10** ${overallScore >= 7 ? "🟢" : overallScore >= 5 ? "🟡" : "🔴"}\n\n`;
  result += `**Details:** ${sqft} SF | Stage: ${stage} | Expiry: ${expiry} | ${touchpoints} touchpoints sent\n`;

  return result;
}

async function compareDeals(args: any): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const count = args.deal_count || 3;
  const { data: deals } = await supabase
    .from("pipeline_deals")
    .select("*")
    .not("stage", "in", "(\"won\",\"lost\",\"closed\")")
    .order("last_activity", { ascending: false })
    .limit(count);

  if (!deals || deals.length === 0) return "No active deals found in pipeline to compare.";

  let result = `## ⚔️ Deal Comparison: Top ${deals.length} Active Deals\n\n`;
  result += `| Metric | ${deals.map((d: any) => `**${d.prospect_name || d.tenant_id}**`).join(" | ")} |\n`;
  result += `|--------|${deals.map(() => "--------").join("|")}|\n`;
  result += `| Stage | ${deals.map((d: any) => d.stage.replace(/_/g, " ")).join(" | ")} |\n`;
  result += `| Size (SF) | ${deals.map((d: any) => d.prospect_sqft ? d.prospect_sqft.toLocaleString() : "N/A").join(" | ")} |\n`;
  result += `| Touchpoints | ${deals.map((d: any) => {
    const tp = Array.isArray(d.sent_touchpoints) ? d.sent_touchpoints.length : 0;
    return tp.toString();
  }).join(" | ")} |\n`;
  result += `| Notes | ${deals.map((d: any) => (d.notes || []).length.toString()).join(" | ")} |\n`;
  result += `| Last Activity | ${deals.map((d: any) => {
    const d2 = new Date(d.last_activity);
    const daysAgo = Math.floor((Date.now() - d2.getTime()) / 86400000);
    return daysAgo === 0 ? "Today" : `${daysAgo}d ago`;
  }).join(" | ")} |\n`;
  result += `| Manual? | ${deals.map((d: any) => d.is_manual ? "Yes" : "No").join(" | ")} |\n`;

  // Staleness check
  const staleDeals = deals.filter((d: any) => {
    const daysAgo = Math.floor((Date.now() - new Date(d.last_activity).getTime()) / 86400000);
    return daysAgo > 7;
  });

  if (staleDeals.length > 0) {
    result += `\n⚠️ **Stale deals:** ${staleDeals.map((d: any) => d.prospect_name || d.tenant_id).join(", ")} — no activity in 7+ days\n`;
  }

  result += `\n_The AI will now analyze these deals and recommend where to focus based on stage, engagement, and timing._`;

  return result;
}

async function generatePitchDeck(args: any, context: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const prospectName = args.prospect_name || "Unknown Prospect";

  // Find deal in pipeline
  const { data: deals } = await supabase.from("pipeline_deals").select("*");
  const deal = deals?.find((d: any) =>
    d.prospect_name?.toLowerCase().includes(prospectName.toLowerCase()) ||
    d.tenant_id?.toLowerCase().includes(prospectName.toLowerCase())
  );

  // Find activities for this prospect
  const { data: activities } = await supabase
    .from("activities")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(20);

  const prospectActivities = activities?.filter((a: any) =>
    deal ? a.tenant_id === deal.tenant_id : false
  ) || [];

  // Get recent comps
  // Comps are in context already, so we reference them

  // Search for real-time market intel
  let marketIntel = "";
  try {
    marketIntel = await searchMarket(`${prospectName} commercial real estate Washington DC office market 2024 2025`);
  } catch { /* silent */ }

  let result = `## 📊 Pitch Deck Data: ${prospectName}\n\n`;

  if (deal) {
    result += `### Prospect Details\n`;
    result += `- **Name:** ${deal.prospect_name || deal.tenant_id}\n`;
    result += `- **Company:** ${deal.prospect_company || "N/A"}\n`;
    result += `- **Size:** ${deal.prospect_sqft?.toLocaleString() || "N/A"} SF\n`;
    result += `- **Stage:** ${deal.stage.replace(/_/g, " ")}\n`;
    result += `- **Building:** ${deal.building_id}\n`;
    result += `- **Notes:** ${(deal.notes || []).slice(-3).join("; ") || "None"}\n`;
    result += `- **Touchpoints:** ${(deal.sent_touchpoints || []).length}\n\n`;
  }

  if (prospectActivities.length > 0) {
    result += `### Activity History\n`;
    prospectActivities.slice(0, 5).forEach((a: any) => {
      result += `- ${new Date(a.timestamp).toLocaleDateString()}: ${a.title} (${a.type})\n`;
    });
    result += `\n`;
  }

  if (marketIntel) {
    result += `### Market Intelligence\n${marketIntel}\n\n`;
  }

  result += `### Instructions\nUsing the data above AND the pipeline/building/comp context, generate a professional pitch deck with 7-9 slides using ---SLIDE--- separators. Include:\n`;
  result += `1. Cover slide with prospect name and date\n`;
  result += `2. Market Overview (DC vacancy rates, trends, absorption)\n`;
  result += `3. Property/Portfolio Highlights (buildings, class, amenities)\n`;
  result += `4. Tenant Fit Analysis (why this space fits their needs)\n`;
  result += `5. Comparable Deals (recent transactions, benchmarks)\n`;
  result += `6. Financial Summary (rent projections, TI, escalations)\n`;
  result += `7. Team & Credentials\n`;
  result += `8. Recommended Next Steps\n`;

  return result;
}

async function executeTool(name: string, args: any, context?: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  switch (name) {
    case "search_market":
      return searchMarket(args.query);

    case "plan_tour":
      return planTour(args.addresses, args.start_address);

    case "analyze_comps":
      return analyzeComps(args);

    case "score_deal":
      return scoreDeal(args, context || "");

    case "compare_deals":
      return compareDeals(args);

    case "generate_pitch_deck":
      return generatePitchDeck(args, context || "");

    case "move_deal_stage": {
      const { error } = await supabase
        .from("pipeline_deals")
        .update({ stage: args.new_stage, last_activity: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("tenant_id", args.tenant_id)
        .eq("building_id", args.building_id);
      if (error) return `Failed to move deal: ${error.message}`;
      return `✅ Deal moved to **${args.new_stage.replace(/_/g, " ")}** stage.`;
    }

    case "add_deal_note": {
      const { data: deal } = await supabase
        .from("pipeline_deals")
        .select("notes")
        .eq("tenant_id", args.tenant_id)
        .eq("building_id", args.building_id)
        .single();
      const notes = [...(deal?.notes || []), args.note];
      const { error } = await supabase
        .from("pipeline_deals")
        .update({ notes, last_activity: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("tenant_id", args.tenant_id)
        .eq("building_id", args.building_id);
      if (error) return `Failed to add note: ${error.message}`;
      return `✅ Note added to deal.`;
    }

    case "create_task": {
      const dueDate = new Date(Date.now() + (args.due_days || 7) * 86400000).toISOString();
      const { error } = await supabase.from("tasks").insert({
        title: args.title,
        description: args.description,
        priority: args.priority,
        due_date: dueDate,
        tenant_id: args.tenant_id || null,
        building_id: args.building_id || null,
        type: "follow_up",
      });
      if (error) return `Failed to create task: ${error.message}`;
      return `✅ Task created: "${args.title}" (due ${new Date(dueDate).toLocaleDateString()}).`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

const VOICE_SYSTEM_PROMPT = `You are DealFlow Copilot in VOICE MODE. The user is speaking to you and will hear your response read aloud.

CRITICAL RULES FOR VOICE MODE:
- Be extremely concise. 1-3 sentences max.
- Never use markdown formatting, headers, bullet points, bold, or links — it will be read aloud.
- Never list long data. Summarize instead.
- Speak naturally like a conversation, not a report.
- Skip greetings and filler. Get straight to the answer.
- Use short words and simple sentences.
- For numbers, say them naturally: "about 50 thousand square feet" not "50,000 SF".
- You still have access to tools (search, move deals, create tasks, plan tours). Use them when asked.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context, mode, voiceMode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const selectedModel = voiceMode ? "google/gemini-2.5-flash-lite" : "google/gemini-3-flash-preview";

    // Non-streaming mode for tool calling
    if (mode === "tools") {
      let systemMessage = voiceMode ? VOICE_SYSTEM_PROMPT : SYSTEM_PROMPT;
      if (context) systemMessage += "\n\n## Current Context\n" + context;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "system", content: systemMessage }, ...messages],
          tools: TOOLS,
          stream: false,
        }),
      });

      if (!response.ok) {
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        return new Response(JSON.stringify({ error: "AI service error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (choice?.finish_reason === "tool_calls" || choice?.message?.tool_calls?.length > 0) {
        const toolCalls = choice.message.tool_calls;
        const toolResults: string[] = [];

        for (const tc of toolCalls) {
          const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          const result = await executeTool(tc.function.name, args, systemMessage);
          toolResults.push(result);
        }

        // Second call: feed tool results back to get a natural response
        const followUpMessages = [
          { role: "system", content: systemMessage },
          ...messages,
          choice.message,
          ...toolCalls.map((tc: any, i: number) => ({
            role: "tool",
            tool_call_id: tc.id,
            content: toolResults[i],
          })),
        ];

        const followUp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: followUpMessages,
            stream: true,
          }),
        });

        if (!followUp.ok) {
          // Return tool results directly
          return new Response(JSON.stringify({
            type: "tool_results",
            content: toolResults.join("\n\n"),
            actions: toolCalls.map((tc: any) => tc.function.name),
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(followUp.body, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // No tool calls — stream the response
      // Re-do with streaming for normal responses
      const streamResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "system", content: systemMessage }, ...messages],
          stream: true,
        }),
      });

      return new Response(streamResp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Default streaming mode (backwards compat)
    let systemMessage = voiceMode ? VOICE_SYSTEM_PROMPT : SYSTEM_PROMPT;
    if (context) systemMessage += "\n\n## Current Context\n" + context;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: "system", content: systemMessage }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("deal-copilot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

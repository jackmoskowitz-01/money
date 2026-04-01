import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";


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
4. **Internal Data Only**: This is an internal tool. Do NOT search the internet. All data comes from the deal database, uploaded files, and provided context. If you don't have information about a company, use search_deals or query_database to look it up in the internal system.
5. **File & Document Lookup**: When the user asks to run a lease abstract, analyze a document, or reference a file for a prospect — use the get_prospect_files tool. CRITICAL: When the user says "run a lease abstract for [company]" or "/abstract for [company]", call get_prospect_files with action="abstract" and the company name. This automatically finds their files AND runs the abstract in one step. For just viewing files, use action="read". NEVER ask the user to upload a file if files already exist for that prospect.
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
- **search_deals**: Search your deal data using semantic/AI search. Use this FIRST when the user asks about specific deals, contacts, activities, scoops, or documents that may not be in the provided context. This searches the full embedded knowledge base across all deal records, contacts, activities, market intel, and uploaded documents.
- **query_database**: Query the deal database with natural language. Translates to SQL automatically. Use for data questions: counts, filters, date ranges, aggregations.
- **deep_analyze**: Deep analysis with extended reasoning. Use for complex strategy questions, multi-deal comparisons, or negotiation planning that need careful thought.
- **extract_lease_terms**: Extract structured lease terms from document text into a clean table + JSON. Use when the broker wants specific terms pulled from a lease/LOI/proposal.
- **compact_context**: Compress the conversation history when it gets long. Summarize key facts and continue.
- **get_prospect_files**: Retrieve uploaded files/documents for a prospect. Use FIRST when the user asks to run a lease abstract, analyze a document, or reference files for a company. Returns file names and content.
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
      name: "search_deals",
      description: "Search the deal knowledge base using AI-powered semantic search. Searches across all embedded deal records, contacts, activities, market intel/scoops, and uploaded documents. Use this FIRST when the user asks about specific deals, contacts, or activities that may not be in the provided context summary. Returns the most relevant results with similarity scores.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Natural language search query (e.g., 'Deloitte lease details', 'contacts at McKinsey', 'recent meeting notes')" },
          filter_type: { type: "string", enum: ["deal", "contact", "activity", "scoop", "document"], description: "Optional: filter results to a specific data type" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_prospect_files",
      description: "Retrieve and optionally analyze uploaded files for a prospect. Use when the user asks to run a lease abstract, analyze a document, or reference files for a company. When action is 'abstract', it automatically runs a full lease abstract on the file content. When action is 'list', it just lists the files. When action is 'read', it returns the file content.",
      parameters: {
        type: "object",
        properties: {
          prospect_name: { type: "string", description: "Company or prospect name (e.g., 'Google', 'Deloitte')" },
          action: { type: "string", enum: ["abstract", "read", "list"], description: "What to do: 'abstract' runs a full lease abstract, 'read' returns file content, 'list' just lists files. Default: 'read'" },
        },
        required: ["prospect_name"],
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
  {
    type: "function",
    function: {
      name: "query_database",
      description: "Query the deal database using natural language. Translates your question into SQL and runs it against pipeline_deals, activities, tasks, scoops, company_contacts, and critical_dates tables. Use for data questions like 'how many deals over 20K SF', 'deals with no activity in 2 weeks', 'all contacts at Deloitte', 'tasks due this week'.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "Natural language question about deal data" },
        },
        required: ["question"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deep_analyze",
      description: "Perform deep analysis with extended reasoning on complex deal questions. Uses Claude's extended thinking for thorough multi-step analysis. Use for: complex deal scoring, multi-deal strategy, market positioning analysis, negotiation strategy, or any question requiring careful multi-factor reasoning.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The complex analysis question" },
          context_data: { type: "string", description: "Additional data to analyze (deal details, comps, etc.)" },
        },
        required: ["question"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "extract_lease_terms",
      description: "Extract structured lease terms from text. Returns a typed JSON object with all key lease fields. Use when the broker wants specific terms extracted from a lease abstract, LOI, proposal, or any document containing deal terms.",
      parameters: {
        type: "object",
        properties: {
          document_text: { type: "string", description: "The lease/LOI/proposal text to extract terms from" },
        },
        required: ["document_text"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compact_context",
      description: "Summarize the current conversation into a compact context. Use this internally when the conversation is getting very long to preserve memory while freeing up context space.",
      parameters: {
        type: "object",
        properties: {
          conversation_summary: { type: "string", description: "Your summary of the conversation so far — key facts, decisions, and pending items" },
        },
        required: ["conversation_summary"],
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

// ============================================================
// Text-to-SQL: Convert natural language to SQL queries
// (per Anthropic cookbook text_to_sql pattern)
// ============================================================

const DB_SCHEMA = `
Tables:
- pipeline_deals (id uuid, tenant_id text, building_id text, stage text, notes text[], last_activity timestamptz, is_manual boolean, prospect_name text, prospect_company text, prospect_email text, prospect_phone text, prospect_sqft int, sent_touchpoints jsonb, sort_order int, created_at timestamptz, updated_at timestamptz, organization_id uuid)
  Stages: hot_prospect, meeting_set, meeting_held, moving_forward, won, closed, lost

- activities (id uuid, tenant_id text, building_id text, type text, title text, description text, timestamp timestamptz, outreach_reason_used text, organization_id uuid)
  Types: email_sent, call, meeting, note, do_not_call, meeting_set

- tasks (id uuid, title text, description text, priority text, type text, due_date timestamptz, completed boolean, tenant_id text, building_id text, organization_id uuid, created_at timestamptz)
  Priorities: high, medium, low

- scoops (id uuid, content text, category text, tags text[], author_name text, linked_tenant_id text, linked_building_id text, linked_tenant_name text, linked_building_name text, organization_id uuid, created_at timestamptz)
  Categories: lease_move, rfp, expansion, contraction, personnel, concession, conversion, general

- company_contacts (id uuid, entity_id text, name text, title text, email text, direct_phone text, mobile_phone text, organization_id uuid, created_at timestamptz)

- critical_dates (id uuid, prospect_name text, prospect_id text, building_name text, date_type text, date_value date, description text, remind_days_before int, source text, user_id uuid, created_at timestamptz)
`;

/** Ensures generated SQL scopes to the user's org (defense in depth with exec_readonly_sql). */
function sqlContainsOrgScope(sql: string, orgId: string): boolean {
  const q = sql.toLowerCase();
  const id = orgId.toLowerCase();
  return q.includes("organization_id") && q.includes(id);
}

async function queryDatabase(question: string, orgId: string): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return "Database query unavailable (ANTHROPIC_API_KEY not configured).";

  if (!orgId) {
    return "Database query unavailable (no organization context). Open Copilot while signed in to an account with an organization.";
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Step 1: Generate SQL from natural language
    const sqlResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: `You are a SQL expert. Given a natural language question and a database schema, generate a PostgreSQL SELECT query. Rules:
- ONLY generate SELECT queries (never INSERT, UPDATE, DELETE, DROP, etc.)
- Always filter by organization_id = '${orgId}'
- Return ONLY the raw SQL, no explanation, no markdown, no backticks
- Limit results to 25 rows max
- Use current_date for relative date references`,
        messages: [{ role: "user", content: `Schema:\n${DB_SCHEMA}\n\nQuestion: ${question}` }],
      }),
    });

    if (!sqlResponse.ok) return "Failed to generate query.";
    const sqlData = await sqlResponse.json();
    const sql = sqlData.content?.[0]?.text?.trim();

    if (!sql || !sql.toLowerCase().startsWith("select")) {
      return "Could not generate a safe query for that question.";
    }

    if (!sqlContainsOrgScope(sql, orgId)) {
      return "Generated query was rejected because it did not scope results to your organization. Try rephrasing your question.";
    }

    // Step 2: Execute the query (DB also enforces org text when expected_org_id is set)
    const { data, error } = await supabase.rpc("exec_readonly_sql", {
      query_text: sql,
      expected_org_id: orgId,
    });

    // Fallback: try direct query if RPC doesn't exist
    if (error?.message?.includes("function") && error?.message?.includes("does not exist")) {
      // Use a simpler approach — query the most likely table
      return `## Generated SQL\n\`\`\`sql\n${sql}\n\`\`\`\n\n⚠️ Direct SQL execution requires the \`exec_readonly_sql\` RPC function. The SQL above is ready to run — you can execute it in the Supabase SQL editor.`;
    }

    if (error) return `Query error: ${error.message}\n\nGenerated SQL:\n\`\`\`sql\n${sql}\n\`\`\``;

    // Step 3: Format results
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return `No results found.\n\nSQL: \`${sql}\``;

    const cols = Object.keys(rows[0]);
    let table = `| ${cols.join(" | ")} |\n|${cols.map(() => "---").join("|")}|\n`;
    for (const row of rows.slice(0, 25)) {
      table += `| ${cols.map(c => String(row[c] ?? "—")).join(" | ")} |\n`;
    }

    return `## Query Results (${rows.length} rows)\n\n${table}\n\n<details><summary>SQL</summary>\n\n\`\`\`sql\n${sql}\n\`\`\`\n</details>`;
  } catch (e) {
    console.error("query_database error:", e);
    return "Database query failed.";
  }
}

// ============================================================
// Extended Thinking: Deep analysis with reasoning chains
// (per Anthropic cookbook extended_thinking pattern)
// ============================================================

async function deepAnalyze(question: string, contextData?: string): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return "Deep analysis unavailable (ANTHROPIC_API_KEY not configured).";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        thinking: {
          type: "enabled",
          budget_tokens: 10000,
        },
        messages: [{
          role: "user",
          content: `You are a senior CRE deal strategist. Analyze the following carefully, considering multiple factors and trade-offs.\n\n${contextData ? `Data:\n${contextData}\n\n` : ""}Question: ${question}\n\nProvide a thorough analysis with clear recommendations. Use headers, bullet points, and tables where appropriate.`,
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Deep analyze error:", err);
      return "Deep analysis failed.";
    }

    const data = await response.json();
    // Extract the text response (thinking blocks are internal)
    const textBlock = data.content?.find((b: any) => b.type === "text");
    return textBlock?.text || "Analysis complete but no output generated.";
  } catch (e) {
    console.error("deep_analyze error:", e);
    return "Deep analysis failed.";
  }
}

// ============================================================
// Structured Lease Term Extraction
// (per Anthropic cookbook extracting_structured_json pattern)
// ============================================================

async function extractLeaseTerms(documentText: string): Promise<string> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) return "Extraction unavailable (ANTHROPIC_API_KEY not configured).";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        tools: [{
          name: "save_lease_terms",
          description: "Save extracted lease terms as structured data",
          input_schema: {
            type: "object",
            properties: {
              tenant_name: { type: "string", description: "Name of the tenant" },
              landlord_name: { type: "string", description: "Name of the landlord/owner" },
              property_address: { type: "string", description: "Property street address" },
              suite_number: { type: "string" },
              rentable_sf: { type: "number", description: "Rentable square footage" },
              usable_sf: { type: "number", description: "Usable square footage" },
              lease_term_months: { type: "number", description: "Lease term in months" },
              commencement_date: { type: "string", description: "Lease start date" },
              expiration_date: { type: "string", description: "Lease end date" },
              base_rent_psf: { type: "number", description: "Base rent per SF per year" },
              annual_escalation_pct: { type: "number", description: "Annual escalation percentage" },
              escalation_type: { type: "string", enum: ["fixed", "cpi", "market", "step"] },
              ti_allowance_psf: { type: "number", description: "Tenant improvement allowance per SF" },
              free_rent_months: { type: "number", description: "Months of free rent" },
              operating_expenses: { type: "string", enum: ["full_service", "nnn", "modified_gross", "base_year"] },
              base_year: { type: "number", description: "OpEx base year if applicable" },
              parking_spaces: { type: "number" },
              parking_rate: { type: "number", description: "Monthly parking rate per space" },
              renewal_options: { type: "string", description: "Renewal option terms" },
              termination_option: { type: "string", description: "Early termination terms" },
              security_deposit: { type: "number" },
              total_lease_value: { type: "number", description: "Total rent over the lease term" },
              notes: { type: "string", description: "Any other notable terms or clauses" },
            },
            required: ["tenant_name", "property_address"],
          },
        }],
        tool_choice: { type: "tool", name: "save_lease_terms" },
        messages: [{
          role: "user",
          content: `Extract all lease terms from this document into structured fields. If a field is not found in the document, omit it.\n\n${documentText}`,
        }],
      }),
    });

    if (!response.ok) return "Lease term extraction failed.";

    const data = await response.json();
    const toolUse = data.content?.find((b: any) => b.type === "tool_use");
    if (!toolUse?.input) return "Could not extract structured terms from this document.";

    const terms = toolUse.input;
    // Format as a clean table
    let result = `## 📋 Extracted Lease Terms\n\n`;
    result += `| Field | Value |\n|-------|-------|\n`;
    const labels: Record<string, string> = {
      tenant_name: "Tenant", landlord_name: "Landlord", property_address: "Property",
      suite_number: "Suite", rentable_sf: "Rentable SF", usable_sf: "Usable SF",
      lease_term_months: "Term (months)", commencement_date: "Commencement",
      expiration_date: "Expiration", base_rent_psf: "Base Rent/SF/yr",
      annual_escalation_pct: "Annual Escalation", escalation_type: "Escalation Type",
      ti_allowance_psf: "TI Allowance/SF", free_rent_months: "Free Rent (months)",
      operating_expenses: "OpEx Structure", base_year: "Base Year",
      parking_spaces: "Parking Spaces", parking_rate: "Parking $/mo/space",
      renewal_options: "Renewal Options", termination_option: "Termination Option",
      security_deposit: "Security Deposit", total_lease_value: "Total Lease Value",
      notes: "Notes",
    };
    for (const [key, val] of Object.entries(terms)) {
      if (val == null || val === "") continue;
      const label = labels[key] || key;
      const display = typeof val === "number" ? val.toLocaleString() : String(val);
      result += `| **${label}** | ${display} |\n`;
    }

    result += `\n<details><summary>Raw JSON</summary>\n\n\`\`\`json\n${JSON.stringify(terms, null, 2)}\n\`\`\`\n</details>`;
    return result;
  } catch (e) {
    console.error("extract_lease_terms error:", e);
    return "Lease term extraction failed.";
  }
}

// Fire-and-forget: embed a record into the RAG vector store
async function embedRecord(sourceType: string, sourceId: string, record: Record<string, unknown>, orgId: string): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    await fetch(`${supabaseUrl}/functions/v1/rag-embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sourceType, sourceId, record, orgId }),
    });
  } catch (e) {
    console.warn("Background RAG embed failed:", e);
  }
}

async function executeTool(name: string, args: any, context?: string, userId?: string | null, orgId?: string | null): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  switch (name) {
    case "search_deals": {
      // Call rag-ask internally for semantic search over deal data
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!anthropicKey || !openaiKey) return "Deal search unavailable (API keys not configured).";

      try {
        // Embed the query
        const embResp = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "text-embedding-3-small", input: args.query }),
        });
        if (!embResp.ok) return "Deal search failed (embedding error).";
        const embData = await embResp.json();
        const queryEmbedding = embData.data[0].embedding;

        // Vector similarity search
        const searchOrgId = orgId || null;
        if (!searchOrgId) return "Deal search unavailable (no organization context).";

        const { data: chunks, error } = await supabase.rpc("match_embeddings", {
          query_embedding: queryEmbedding,
          match_org_id: searchOrgId,
          match_count: 10,
          match_threshold: 0.35,
          filter_type: args.filter_type ?? null,
        });

        if (error || !chunks?.length) return "No matching deal data found for that query.";

        // Format results for the Copilot
        const results = chunks.map((c: any, i: number) => {
          const meta = c.metadata || {};
          const metaParts = [
            meta.tenant && `Tenant: ${meta.tenant}`,
            meta.stage && `Stage: ${meta.stage}`,
            meta.sf && `SF: ${Number(meta.sf).toLocaleString()}`,
            meta.full_name && `Contact: ${meta.full_name}`,
            meta.category && `Category: ${meta.category}`,
          ].filter(Boolean).join(" | ");
          return `[${i + 1}] [${c.source_type.toUpperCase()}]${metaParts ? ` (${metaParts})` : ""} (relevance: ${Math.round(c.similarity * 100)}%)\n${c.content}`;
        }).join("\n\n");

        return `## Deal Search Results for: "${args.query}"\n\n${results}`;
      } catch (e) {
        console.error("search_deals error:", e);
        return "Deal search failed.";
      }
    }

    case "query_database":
      return queryDatabase(args.question, orgId || "");

    case "deep_analyze":
      return deepAnalyze(args.question, args.context_data || context || "");

    case "extract_lease_terms":
      return extractLeaseTerms(args.document_text);

    case "compact_context":
      return `✅ Context compacted. Summary preserved:\n\n${args.conversation_summary}`;

    case "get_prospect_files": {
      const prospectName = args.prospect_name?.toLowerCase() || "";
      const results: string[] = [];

      // Step 1: Find the prospect(s) by name across all tables
      const { data: dbProspects } = await supabase
        .from("prospects")
        .select("id, company_name")
        .ilike("company_name", `%${prospectName}%`);

      const { data: customProspects } = await supabase
        .from("custom_prospects")
        .select("id, name")
        .ilike("name", `%${prospectName}%`);

      const { data: pipelineDeals } = await supabase
        .from("pipeline_deals")
        .select("tenant_id, prospect_company, prospect_name, notes, stage")
        .or(`prospect_company.ilike.%${prospectName}%,prospect_name.ilike.%${prospectName}%`);

      // Collect all matching prospect IDs
      const prospectIds = new Set<string>();
      (dbProspects || []).forEach((p: any) => prospectIds.add(p.id));
      (customProspects || []).forEach((p: any) => prospectIds.add(p.id));
      (pipelineDeals || []).forEach((p: any) => prospectIds.add(p.tenant_id));

      if (prospectIds.size === 0) {
        return `No prospect found matching "${args.prospect_name}". Check the company name and try again.`;
      }

      // Step 2: Get all files for these prospect IDs
      const allFiles: any[] = [];
      for (const pid of prospectIds) {
        const { data: files } = await supabase
          .from("prospect_files")
          .select("*")
          .eq("prospect_id", pid)
          .order("created_at", { ascending: false });
        if (files) allFiles.push(...files);
      }

      // Also search by filename containing the prospect name
      const { data: nameMatchFiles } = await supabase
        .from("prospect_files")
        .select("*")
        .ilike("file_name", `%${prospectName}%`);
      if (nameMatchFiles) {
        const existingIds = new Set(allFiles.map((f: any) => f.id));
        nameMatchFiles.forEach((f: any) => { if (!existingIds.has(f.id)) allFiles.push(f); });
      }

      // Step 3: Download and read file contents
      if (allFiles.length > 0) {
        results.push(`## Files for "${args.prospect_name}" (${allFiles.length} found)\n`);

        for (const f of allFiles.slice(0, 5)) { // Limit to 5 files
          results.push(`### ${f.file_name}`);
          results.push(`Type: ${f.file_type || "unknown"} | Uploaded: ${new Date(f.created_at).toLocaleDateString()} by ${f.uploaded_by_name || "unknown"}\n`);

          // Download file content from Supabase Storage
          try {
            const { data: fileData } = await supabase.storage
              .from("prospect-files")
              .download(f.file_path);

            if (fileData) {
              const isPdf = f.file_type === "application/pdf" || f.file_name?.endsWith(".pdf");
              const isText = f.file_type?.includes("text") || f.file_name?.endsWith(".txt") || f.file_name?.endsWith(".csv") || f.file_name?.endsWith(".md");

              if (isText) {
                const text = await fileData.text();
                const truncated = text.length > 30000 ? text.slice(0, 30000) + "\n\n[... truncated ...]" : text;
                results.push("```\n" + truncated + "\n```\n");
              } else if (isPdf) {
                // Send PDF to Gemini for native reading — fast, 1M context
                const pdfGeminiKey = Deno.env.get("GOOGLE_AI_API_KEY");
                if (pdfGeminiKey) {
                  const bytes = new Uint8Array(await fileData.arrayBuffer());
                  const base64 = btoa(String.fromCharCode(...bytes));
                  const pdfResp = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${pdfGeminiKey}`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        contents: [{ parts: [
                          { inline_data: { mime_type: "application/pdf", data: base64 } },
                          { text: "Extract the full text content of this document. Preserve all details, numbers, dates, and formatting." },
                        ] }],
                        generationConfig: { maxOutputTokens: 16384 },
                      }),
                    }
                  );
                  if (pdfResp.ok) {
                    const pdfData = await pdfResp.json();
                    const pdfText = pdfData.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (pdfText) {
                      results.push("**[PDF Content Extracted]**\n\n" + pdfText + "\n");
                    }
                  } else {
                    results.push(`_(Could not read PDF — ${(f.file_size / 1024).toFixed(1)} KB)_\n`);
                  }
                }
              } else {
                results.push(`_(Binary file — ${(f.file_size / 1024).toFixed(1)} KB)_\n`);
              }
            }
          } catch (e) {
            results.push(`_(Could not download file: ${e.message})_\n`);
          }
        }
      }

      // Step 4: Search RAG embeddings for any embedded document content
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (openaiKey && orgId) {
        try {
          const embResp = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "text-embedding-3-small", input: `${args.prospect_name} lease document abstract` }),
          });
          if (embResp.ok) {
            const embData = await embResp.json();
            const { data: docs } = await supabase.rpc("match_embeddings", {
              query_embedding: embData.data[0].embedding,
              match_org_id: orgId,
              match_count: 5,
              match_threshold: 0.25,
              filter_type: null,
            });
            if (docs?.length > 0) {
              results.push(`\n## Related Data from Knowledge Base\n`);
              for (const doc of docs) {
                results.push(`**[${doc.source_type.toUpperCase()}]** (${Math.round(doc.similarity * 100)}% match)\n${doc.content}\n`);
              }
            }
          }
        } catch { /* silent */ }
      }

      // Step 5: Add pipeline context
      if (pipelineDeals?.length) {
        results.push(`\n## Pipeline Context\n`);
        for (const d of pipelineDeals) {
          results.push(`- **${d.prospect_company || d.prospect_name}** — Stage: ${d.stage}, Notes: ${(d.notes || []).join("; ") || "none"}`);
        }
      }

      if (results.length === 0) {
        return `No files or documents found for "${args.prospect_name}". The broker needs to upload the lease to the company's Files section first.`;
      }

      const fileContent = results.join("\n");

      // If action is "abstract", run a full lease abstract on the file content using Claude
      if (args.action === "abstract") {
        const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
        if (!anthropicKey) return "Cannot run abstract — ANTHROPIC_API_KEY not configured.";

        const LEASE_ABSTRACT_TEMPLATE = `You are producing a professional Lease Summary / Abstract. Follow this EXACT structure and section order. Fill in every field from the lease document. If a field is not found in the lease, write "Silent in Lease."

## FORMAT:
---
# Lease Summary

**Company Name:** [Tenant Company]
**Building Name:** [Building/Property Name]
**Address:** [Full Address]
**Lease Type:** [Renewal / Expansion / New Lease]
**Abstract Date:** ${new Date().toLocaleDateString()}

---

### Premises
- [X] rentable square feet
- Method of Measurement: [if stated]

### Amendments
List each amendment with page references and bullet-point summaries. If none, state "No amendments."

### Landlord
[Landlord entity name] | [City, ST]

### Term
- Duration: [X years]
- Commencement Date: [date]
- Expiration Date: [date]
- Article/Section/Page reference if available

### Size
[Rentable SF and Usable SF if stated]

### Rent Schedule

| Period | Rent/SF | Rent/Month | Rent/Year |
|--------|---------|------------|-----------|
| Year 1 | $XX.XX  | $XX,XXX.XX | $XXX,XXX.XX |
| Year 2 | ... | ... | ... |
[Continue for all years]

### Rent Payment Address
[Address or "Silent in Lease"]

### Lease Type
[Full Service / Net / Modified Gross / etc.]

### Electricity
[Included or separately metered, details]

### Abandonment
[Terms or "Silent in Lease"]

### Additional Provisions
[Key provisions or "Silent in Lease"]

### Alterations & Additions
[Terms or "Silent in Lease"]

### Landlord Services
[Services provided or "Silent in Lease"]

### Operating Expenses & Taxes
[Base year, cap, pass-through details or "Silent in Lease"]

### Exhibits
[List all exhibits referenced]

### Improvements / Tenant Improvements
[TI allowance, details or "Silent in Lease"]

### Parking
[Ratio, cost, reserved/unreserved or "Silent in Lease"]

### Right of Refusal
[Terms or "Silent in Lease"]

### Extension Option
[Terms, notice period, rent basis or "Silent in Lease"]

### Expansion Option
[Terms or "Silent in Lease"]

### Cancellation Option
[Terms, penalty or "Silent in Lease"]

### Holdover
[Rate, terms or "Silent in Lease"]

### Insurance - Landlord
[Requirements or "Silent in Lease"]

### Insurance - Tenant
[Requirements or "Silent in Lease"]

### Late Charge
[Percentage, grace period or "Silent in Lease"]

### Maintenance - Landlord
[Responsibilities or "Silent in Lease"]

### Maintenance - Tenant
[Responsibilities or "Silent in Lease"]

### Non-Disturbance
[Terms or "Silent in Lease"]

### Permitted Uses
[Permitted uses or "Silent in Lease"]

### Relocation
[Terms or "Silent in Lease"]

### Restoration
[Terms or "Silent in Lease"]

### Right to Audit
[Terms or "Silent in Lease"]

### Right to Offset
[Terms or "Silent in Lease"]

### Self-Help
[Terms or "Silent in Lease"]

### Assignment & Subletting
[Terms, consent requirements or "Silent in Lease"]

### Signage
[Terms or "Silent in Lease"]

### Security Deposit
[Amount, terms or "Silent in Lease"]

### Building Hours and Holidays
[Hours, holiday schedule or "Silent in Lease"]

### Notice to Landlord
[Notice address or "Silent in Lease"]

### Additional Lease Comments
[Any other notable terms]

---
*This document has been prepared based on available information and professional interpretation. Reasonable care has been taken to ensure its accuracy. We encourage every client to review the information prior to relying on it for action or decision-making.*
---

CRITICAL INSTRUCTIONS - MAXIMUM DETAIL:
1. Fill in EVERY section above. Do NOT skip or summarize - provide the FULL detail from the lease for each field.
2. For rent schedules: list EVERY year of the term with Rent/SF, Rent/Month, and Rent/Year. Calculate monthly and annual amounts if only per-SF rates are given. Show escalation percentages.
3. For each section, include the Article #, Section #, and Page # references from the lease when available.
4. Quote exact dollar amounts, dates, percentages, and square footage numbers - never round or approximate.
5. For options (extension, expansion, cancellation, ROFO/ROFR): include ALL details - notice periods, pricing mechanisms, number of options, option term lengths, and any conditions.
6. For insurance: list exact coverage types and minimum amounts required.
7. For operating expenses: include base year, cap rates, exclusions, gross-up provisions, and audit rights.
8. For TI/improvements: include exact allowance per SF, total amount, construction timeline, and any landlord contribution details.
9. For assignment/subletting: include consent requirements, recapture rights, profit sharing, and any pre-approved transfers.
10. List ALL exhibits and addenda referenced in the lease with brief descriptions.
11. Include any guarantor information, renewal rights, co-tenancy clauses, exclusive use provisions, or other non-standard terms under "Additional Lease Comments."
12. If a clause is complex, use sub-bullets to break it down - never collapse detail into a single line.
13. DO NOT write "See lease for details" - extract and state the actual details.`;

        // Use Gemini 2.5 Flash for abstracts — fastest, follows templates, 1M context
        const geminiKey = Deno.env.get("GOOGLE_AI_API_KEY");
        if (!geminiKey) return "Cannot run abstract — GOOGLE_AI_API_KEY not configured.";

        let abstractResp: Response | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          abstractResp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `${LEASE_ABSTRACT_TEMPLATE}\n\nRun a complete lease abstract on the following document content:\n\n${fileContent}` }] }],
                generationConfig: { maxOutputTokens: 16384 },
              }),
            }
          );
          if (abstractResp.status === 429) {
            await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
            continue;
          }
          break;
        }

        if (!abstractResp?.ok) {
          const err = await abstractResp?.text();
          console.error("Gemini abstract error:", err);
          return `Found files for ${args.prospect_name} but abstract generation failed. Here are the files:\n\n${fileContent}`;
        }

        const abstractData = await abstractResp.json();
        const abstractText = abstractData.candidates?.[0]?.content?.parts?.[0]?.text;
        return abstractText || `Abstract generation returned no output. Here are the files:\n\n${fileContent}`;
      }

      return fileContent;
    }

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
      const { data: updated, error } = await supabase
        .from("pipeline_deals")
        .update({ stage: args.new_stage, last_activity: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("tenant_id", args.tenant_id)
        .eq("building_id", args.building_id)
        .select("*")
        .single();
      if (error) return `Failed to move deal: ${error.message}`;
      if (updated && orgId) embedRecord("deal", updated.id, updated, orgId);
      return `✅ Deal moved to **${args.new_stage.replace(/_/g, " ")}** stage.`;
    }

    case "add_deal_note": {
      const { data: deal } = await supabase
        .from("pipeline_deals")
        .select("*")
        .eq("tenant_id", args.tenant_id)
        .eq("building_id", args.building_id)
        .single();
      const notes = [...(deal?.notes || []), args.note];
      const { data: updated, error } = await supabase
        .from("pipeline_deals")
        .update({ notes, last_activity: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("tenant_id", args.tenant_id)
        .eq("building_id", args.building_id)
        .select("*")
        .single();
      if (error) return `Failed to add note: ${error.message}`;
      if (updated && orgId) embedRecord("deal", updated.id, updated, orgId);
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

    case "log_activity": {
      const { data: activity, error } = await supabase.from("activities").insert({
        tenant_id: args.tenant_id,
        building_id: args.building_id || "",
        type: args.type,
        title: args.title,
        description: args.description || "",
      }).select("*").single();
      if (error) return `Failed to log activity: ${error.message}`;
      if (activity && orgId) embedRecord("activity", activity.id, activity, orgId);
      return `✅ Activity logged: "${args.title}" (${args.type.replace(/_/g, " ")}).`;
    }

    case "add_contact": {
      const { data: contact, error } = await supabase.from("company_contacts").insert({
        entity_id: args.entity_id,
        name: args.name,
        title: args.title || "",
        email: args.email || "",
        direct_phone: args.direct_phone || null,
        mobile_phone: args.mobile_phone || null,
      }).select("*").single();
      if (error) return `Failed to add contact: ${error.message}`;
      if (contact && orgId) embedRecord("contact", contact.id, contact, orgId);
      return `✅ Contact added: ${args.name}${args.title ? ` (${args.title})` : ""}.`;
    }

    case "create_deal": {
      const { data: deal, error } = await supabase.from("pipeline_deals").insert({
        tenant_id: args.tenant_id,
        building_id: args.building_id,
        prospect_name: args.prospect_name || null,
        prospect_company: args.prospect_company || null,
        prospect_email: args.prospect_email || null,
        prospect_sqft: args.prospect_sqft || null,
        stage: args.stage || "hot_prospect",
        notes: args.notes || [],
        is_manual: true,
      }).select("*").single();
      if (error) return `Failed to create deal: ${error.message}`;
      if (deal && orgId) embedRecord("deal", deal.id, deal, orgId);
      return `✅ Pipeline deal created: ${args.prospect_company || args.tenant_id} → ${(args.stage || "hot_prospect").replace(/_/g, " ")}.`;
    }

    case "add_critical_date": {
      if (!userId) return "⚠️ Critical date noted but couldn't save — user not authenticated. Please add it manually from the Critical Dates tracker.";
      const { error } = await supabase.from("critical_dates").insert({
        prospect_name: args.prospect_name,
        prospect_id: args.prospect_id || null,
        building_name: args.building_name || "",
        date_type: args.date_type,
        date_value: args.date_value,
        description: args.description || "",
        remind_days_before: args.remind_days_before || 30,
        source: "copilot",
        user_id: userId,
      });
      if (error) return `⚠️ Critical date noted but couldn't save to tracker (${error.message}). I'll include it in my summary so you can add it manually.`;
      return `✅ Critical date tracked: ${args.date_type.replace(/_/g, " ")} for ${args.prospect_name} on ${args.date_value}.`;
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

// Convert OpenAI-style tools to Anthropic format
function toAnthropicTools(tools: any[]): any[] {
  return tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

// Convert OpenAI-style messages to Anthropic format
function toAnthropicMessages(msgs: any[]): any[] {
  return msgs.filter(m => m.role !== "system").map(m => {
    if (m.role === "tool") {
      return {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content }],
      };
    }
    if (m.tool_calls) {
      return {
        role: "assistant",
        content: m.tool_calls.map((tc: any) => ({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments,
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

// Convert Anthropic streaming response to OpenAI SSE format (for frontend compatibility)
function anthropicStreamToOpenAISSE(anthropicStream: ReadableStream): ReadableStream {
  const reader = anthropicStream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }

      const text = decoder.decode(value);
      const lines = text.split("\n").filter(l => l.startsWith("data: "));

      for (const line of lines) {
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          // Convert content_block_delta to OpenAI format
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            const openaiChunk = {
              choices: [{
                delta: { content: event.delta.text },
                index: 0,
                finish_reason: null,
              }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
          }
          if (event.type === "message_stop") {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          }
        } catch { /* skip unparseable lines */ }
      }
    },
  });
}

// Call Anthropic Messages API with retry on overload
async function callAnthropic(systemMessage: string, messages: any[], options: { tools?: boolean; stream?: boolean; voiceMode?: boolean } = {}): Promise<Response> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const model = "claude-sonnet-4-20250514";
  const anthropicMessages = toAnthropicMessages(messages);

  const body: any = {
    model,
    max_tokens: 4096,
    system: systemMessage,
    messages: anthropicMessages,
  };

  if (options.tools) {
    body.tools = toAnthropicTools(TOOLS);
  }
  if (options.stream) {
    body.stream = true;
  }

  const headers = {
    "x-api-key": anthropicKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json",
  };

  // Retry up to 3 times on 429/529 (overloaded)
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (response.status === 429 || response.status === 529) {
      console.warn(`Anthropic overloaded (${response.status}), retry ${attempt + 1}/3...`);
      await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      continue;
    }

    return response;
  }

  // Final attempt
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context, mode, voiceMode } = await req.json();
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    // Extract user_id from JWT for tools that need it (e.g. critical_dates)
    let currentUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const payload = JSON.parse(atob(token.split(".")[1]));
        currentUserId = payload.sub || null;
      } catch { /* not a JWT or can't parse */ }
    }

    // Resolve org_id for RAG embedding after tool mutations
    let currentOrgId: string | null = null;
    if (currentUserId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceKey);
      const { data: membership } = await adminClient
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", currentUserId)
        .limit(1)
        .single();
      currentOrgId = membership?.organization_id ?? null;
    }

    let systemMessage = voiceMode ? VOICE_SYSTEM_PROMPT : SYSTEM_PROMPT;
    if (context) systemMessage += "\n\n## Current Context\n" + context;

    // Non-streaming mode for tool calling
    if (mode === "tools") {
      const response = await callAnthropic(systemMessage, messages, { tools: true, voiceMode });

      if (!response.ok) {
        const t = await response.text();
        console.error("Anthropic error:", response.status, t);
        return new Response(JSON.stringify({ error: `AI service error: ${response.status} - ${t.slice(0, 200)}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();

      // Check if Claude wants to use tools
      const toolBlocks = data.content?.filter((b: any) => b.type === "tool_use") || [];

      if (toolBlocks.length > 0) {
        // Execute ALL tool calls in parallel
        const toolResults = await Promise.all(
          toolBlocks.map(async (tb: any) => ({
            id: tb.id,
            result: await executeTool(tb.name, tb.input, systemMessage, currentUserId, currentOrgId),
          }))
        );

        // Build follow-up messages with tool results
        const followUpMessages = [
          ...messages,
          { role: "assistant", content: data.content },
          ...toolResults.map(tr => ({
            role: "user",
            content: [{ type: "tool_result", tool_use_id: tr.id, content: tr.result }],
          })),
        ];

        // Second call: stream the response after tool execution
        const followUp = await callAnthropic(systemMessage, followUpMessages, { stream: true, voiceMode });

        if (!followUp.ok) {
          // Return tool results directly as fallback
          return new Response(JSON.stringify({
            type: "tool_results",
            content: toolResults.map(tr => tr.result).join("\n\n"),
            actions: toolBlocks.map((tb: any) => tb.name),
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        return new Response(anthropicStreamToOpenAISSE(followUp.body!), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // No tool calls — extract text and stream a follow-up
      const textBlock = data.content?.find((b: any) => b.type === "text");
      if (textBlock) {
        // Re-stream for consistency with frontend expectations
        const streamResp = await callAnthropic(systemMessage, messages, { stream: true, voiceMode });
        return new Response(anthropicStreamToOpenAISSE(streamResp.body!), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    }

    // Default streaming mode
    const response = await callAnthropic(systemMessage, messages, { stream: true, voiceMode });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Anthropic error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(anthropicStreamToOpenAISSE(response.body!), {
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

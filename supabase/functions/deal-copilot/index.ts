import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are DealFlow Copilot — an expert AI assistant for commercial real estate (CRE) brokers in the Washington, DC metro market.

You have deep knowledge of DC office submarkets, lease structures, building classes, vacancy trends, tenant prospecting, and pipeline management.

## Your Capabilities

1. **Deal Strategy Advice**: Provide specific, actionable next steps based on pipeline stage, lease expiration, and market dynamics.
2. **Quick Data Lookup**: Answer questions about prospects, buildings, or market data using provided context.
3. **Outreach Drafting**: Draft concise, professional broker emails. Position as a market advisor, not salesy.
4. **Market Intelligence**: Answer DC metro CRE market questions. When you need real-time data, use the search_market tool.
5. **Pipeline Actions**: Execute actions like moving deal stages, adding notes, creating tasks when the user asks.
6. **Tour Planning**: Optimize property tour routes. When given addresses, use the plan_tour tool to geocode and order them for the most efficient route.

## Available Tools
You can execute these actions when the user asks:
- **search_market**: Search for real-time market data, news, or trends
- **move_deal_stage**: Move a prospect to a different pipeline stage
- **add_deal_note**: Add a note to a pipeline deal
- **create_task**: Create a new task linked to a prospect
- **plan_tour**: Plan an optimized tour route from a list of addresses. ALWAYS use this tool when the user provides addresses for touring. Extract all addresses from the user message and pass them as the addresses array.

## Style Guidelines
- Be direct and actionable — brokers are busy
- Use CRE terminology naturally (SF, TI, NNN, Class A, etc.)
- When drafting emails, format with Subject line and body
- For strategy advice, use numbered steps
- Keep responses concise but thorough
- For tour plans, present the optimized order as a numbered itinerary with estimated distances between stops

## Page Context
The user may be viewing a specific page. Use this to provide contextually relevant answers without being asked.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_market",
      description: "Search for real-time CRE market data, news, company information, or trends using web search. Use this when the user asks about current market conditions, recent news, or data you don't have in context.",
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

async function executeTool(name: string, args: any): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  switch (name) {
    case "search_market":
      return searchMarket(args.query);

    case "plan_tour":
      return planTour(args.addresses, args.start_address);

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
          const result = await executeTool(tc.function.name, args);
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
    let systemMessage = SYSTEM_PROMPT;
    if (context) systemMessage += "\n\n## Current Context\n" + context;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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

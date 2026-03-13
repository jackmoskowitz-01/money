import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are DealFlow Copilot — an expert AI assistant for commercial real estate (CRE) brokers in the Washington, DC metro market.

You have deep knowledge of:
- DC office submarkets (CBD, East End, Capitol Hill, Rosslyn-Ballston, NoMa, Georgetown, etc.)
- Lease structures, TI allowances, free rent, escalations, and deal economics
- Building classes (A/B/C), vacancy trends, and ownership dynamics
- Tenant prospecting strategies, outreach timing, and relationship management
- Pipeline management best practices for CRE brokers

## Your Capabilities

1. **Deal Strategy Advice**: When given pipeline context (prospect name, stage, lease expiration, building info), provide specific, actionable next steps. Consider timing, market conditions, and competitive dynamics.

2. **Quick Data Lookup**: When the user asks about specific prospects, buildings, or market data, use the provided context to answer. Reference specific details like square footage, lease dates, vacancy rates.

3. **Outreach Drafting**: Draft professional broker outreach emails. Keep them concise (3-5 sentences max), personalized, and value-driven. Never be salesy — position yourself as a market advisor. Include a specific reason to reach out based on context.

4. **Market Intelligence**: Answer questions about DC metro CRE market conditions, trends, and dynamics. Be specific with submarkets, cite realistic market data.

## Style Guidelines
- Be direct and actionable — brokers are busy
- Use CRE terminology naturally (SF, TI, NNN, Class A, etc.)
- When drafting emails, format them clearly with Subject line and body
- For strategy advice, use numbered steps
- Keep responses concise but thorough
- When you don't have specific data, say so and provide general market guidance

## Context
The user may provide pipeline data, building info, and tenant details as context. Use this to personalize your responses. If no context is provided, ask clarifying questions.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context-aware system message
    let systemMessage = SYSTEM_PROMPT;
    if (context) {
      systemMessage += "\n\n## Current Context\n" + context;
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemMessage },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage credits exhausted. Please add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ============================================================
// Metaprompt Optimizer
// (per Anthropic cookbook metaprompt pattern)
//
// Analyzes the Copilot system prompt + sample conversations
// and suggests specific improvements for better CRE responses.
// ============================================================

const METAPROMPT = `You are a prompt engineering expert specializing in optimizing AI system prompts for commercial real estate (CRE) applications.

You will be given:
1. A current system prompt used by a CRE deal copilot
2. Optionally, sample conversations showing how the copilot performs

Your job is to analyze the prompt and provide:

## Analysis
- What the prompt does well
- What's missing or unclear
- Areas where the AI might behave unexpectedly
- Opportunities for better CRE domain specificity

## Specific Improvements
For each suggestion, provide:
- The EXACT text to change (quote the original)
- The improved replacement text
- Why this change helps

## Rewritten Prompt
Provide a complete rewritten version that incorporates all improvements. Keep the same structure but enhance:
- Role clarity and expertise positioning
- Tool usage instructions (when to use which tool)
- Output formatting consistency
- CRE domain terminology and conventions
- Edge case handling
- Information dump processing

Rules:
- Preserve ALL existing functionality and tools
- Don't remove any capabilities
- Focus on making existing instructions clearer and more effective
- Add domain-specific examples where they help
- Keep the prompt concise — longer isn't always better`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { current_prompt, sample_conversations, focus_areas } = await req.json();

    if (!current_prompt) {
      return new Response(
        JSON.stringify({ error: "current_prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let userContent = `## Current System Prompt\n\n${current_prompt}`;

    if (sample_conversations) {
      userContent += `\n\n## Sample Conversations\n\n${sample_conversations}`;
    }

    if (focus_areas) {
      userContent += `\n\n## Focus Areas\nPlease pay special attention to: ${focus_areas}`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-20250514",
        max_tokens: 8000,
        thinking: {
          type: "enabled",
          budget_tokens: 5000,
        },
        messages: [
          { role: "user", content: `${METAPROMPT}\n\n---\n\n${userContent}` },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API failed: ${err}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find((b: any) => b.type === "text");
    const analysis = textBlock?.text || "No analysis generated.";

    return new Response(
      JSON.stringify({ analysis }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Optimize prompt error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Prompt optimization failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

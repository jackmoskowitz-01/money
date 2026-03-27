import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { question, filterType, topK = 5, threshold = 0.45 } = await req.json();

    if (!question?.trim()) {
      return new Response(
        JSON.stringify({ error: "Question is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth: get user and their org
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get org_id
    const { data: membership } = await userClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership?.organization_id) {
      return new Response(
        JSON.stringify({ error: "No organization found for user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orgId = membership.organization_id;

    // Step 1: Embed the question via OpenAI
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: question,
      }),
    });

    if (!embeddingResponse.ok) {
      const err = await embeddingResponse.text();
      throw new Error(`OpenAI embedding failed: ${err}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Step 2: Similarity search via Supabase RPC
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: chunks, error: searchError } = await adminClient.rpc("match_embeddings", {
      query_embedding: queryEmbedding,
      match_org_id: orgId,
      match_count: topK,
      match_threshold: threshold,
      filter_type: filterType ?? null,
    });

    if (searchError) {
      throw new Error(`Retrieval failed: ${searchError.message}`);
    }

    // If nothing relevant found
    if (!chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({
          answer: "I couldn't find relevant deal data for that question. Try adding more context or make sure your deals and activities have been saved.",
          sources: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Build context from retrieved chunks
    const context = chunks
      .map((chunk: any, i: number) => {
        const label = chunk.source_type.toUpperCase();
        const meta = chunk.metadata || {};
        const metaParts = [
          meta.tenant && `Tenant: ${meta.tenant}`,
          meta.stage && `Stage: ${meta.stage}`,
          meta.sf && `SF: ${Number(meta.sf).toLocaleString()}`,
          meta.contact_role && `Role: ${meta.contact_role}`,
          meta.category && `Category: ${meta.category}`,
        ].filter(Boolean).join(" | ");

        return `[${i + 1}] [${label}]${metaParts ? ` (${metaParts})` : ""}\n${chunk.content}`;
      })
      .join("\n\n");

    // Step 4: Ask Claude
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 1000,
        system: `You are a deal intelligence assistant for a commercial real estate tenant representation brokerage.

Your job is to answer broker questions using ONLY the deal data provided in the context below.

Rules:
- Be specific. Reference deal names, tenant names, contacts, SF requirements, timelines when available.
- If the data supports a clear answer, give it directly.
- If the data is incomplete or ambiguous, say what you know and flag what's missing.
- Never make up information that isn't in the context.
- Keep answers concise — brokers are busy.`,
        messages: [
          {
            role: "user",
            content: `Deal data context:\n\n${context}\n\n---\n\nQuestion: ${question}`,
          },
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const err = await claudeResponse.text();
      throw new Error(`Claude API failed: ${err}`);
    }

    const claudeData = await claudeResponse.json();
    const answer = claudeData.content?.[0]?.type === "text"
      ? claudeData.content[0].text
      : "Unable to generate a response.";

    return new Response(
      JSON.stringify({
        answer,
        sources: chunks.map((c: any) => ({
          type: c.source_type,
          id: c.source_id,
          similarity: c.similarity,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("RAG ask error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Something went wrong" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

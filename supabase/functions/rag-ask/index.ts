import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ============================================================
// Re-ranking: Use Claude to select the most relevant chunks
// (per Anthropic cookbook RAG guide — improves MRR by ~15-20%)
// ============================================================

async function rerankChunks(
  question: string,
  chunks: any[],
  topK: number,
  anthropicKey: string
): Promise<any[]> {
  if (chunks.length <= topK) return chunks;

  const numbered = chunks
    .map((c: any, i: number) => `[${i}] [${c.source_type.toUpperCase()}] ${c.content}`)
    .join("\n\n");

  const rerankResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: `You are a relevance ranker for a commercial real estate brokerage. Given a broker's question and numbered document chunks, return ONLY a JSON array of the ${topK} most relevant chunk indices, ordered by relevance. Example: [3, 0, 7, 1, 5]. No explanation.`,
      messages: [
        {
          role: "user",
          content: `Question: ${question}\n\nChunks:\n${numbered}`,
        },
      ],
    }),
  });

  if (!rerankResponse.ok) {
    console.warn("Re-ranking failed, falling back to vector similarity order");
    return chunks.slice(0, topK);
  }

  const rerankData = await rerankResponse.json();
  const text = rerankData.content?.[0]?.text || "";

  try {
    const indices: number[] = JSON.parse(text);
    const reranked = indices
      .filter((i: number) => i >= 0 && i < chunks.length)
      .slice(0, topK)
      .map((i: number) => chunks[i]);
    return reranked.length > 0 ? reranked : chunks.slice(0, topK);
  } catch {
    console.warn("Failed to parse re-rank indices, falling back to vector order");
    return chunks.slice(0, topK);
  }
}

// ============================================================
// Main handler
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { question, filterType, topK = 5, threshold = 0.40, retrieveOnly = false } = await req.json();

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

    // Get org_id (use service role to bypass RLS on organization_members)
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: membership } = await adminClient
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

    // Step 2: Retrieve candidates — fetch 4x topK for re-ranking headroom
    // (adminClient already created above for org lookup)

    const retrieveCount = topK * 4;

    // Run vector search and full-text search in parallel (hybrid search)
    const [vectorResult, textResult] = await Promise.all([
      adminClient.rpc("match_embeddings", {
        query_embedding: queryEmbedding,
        match_org_id: orgId,
        match_count: retrieveCount,
        match_threshold: threshold,
        filter_type: filterType ?? null,
      }),
      adminClient
        .from("embeddings")
        .select("source_type, source_id, content, metadata, organization_id")
        .eq("organization_id", orgId)
        .textSearch("content", question.split(/\s+/).filter((w: string) => w.length > 2).join(" & "), { type: "plain" })
        .limit(retrieveCount)
        .then((res: any) => ({
          ...res,
          data: res.data?.map((r: any) => ({ ...r, similarity: 0.5 })) ?? [],
        })),
    ]);

    if (vectorResult.error) {
      throw new Error(`Vector retrieval failed: ${vectorResult.error.message}`);
    }

    // Merge and deduplicate results
    const seen = new Set<string>();
    const allChunks: any[] = [];

    for (const chunk of (vectorResult.data || [])) {
      const key = `${chunk.source_type}:${chunk.source_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        allChunks.push(chunk);
      }
    }
    for (const chunk of (textResult.data || [])) {
      const key = `${chunk.source_type}:${chunk.source_id}`;
      if (!seen.has(key)) {
        seen.add(key);
        allChunks.push(chunk);
      }
    }

    // If nothing relevant found
    if (allChunks.length === 0) {
      return new Response(
        JSON.stringify({
          answer: "I couldn't find relevant deal data for that question. Try adding more context or make sure your deals and activities have been saved.",
          sources: [],
          chunks: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If retrieveOnly mode, return raw chunks without calling Claude
    if (retrieveOnly) {
      return new Response(
        JSON.stringify({
          chunks: allChunks.slice(0, topK).map((c: any) => ({
            type: c.source_type,
            id: c.source_id,
            content: c.content,
            metadata: c.metadata,
            similarity: c.similarity,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Re-rank with Claude if we have more candidates than needed
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rankedChunks = await rerankChunks(question, allChunks, topK, anthropicKey);

    // Step 4: Build context from re-ranked chunks
    const context = rankedChunks
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

    // Step 5: Ask Claude with re-ranked context + citations + prompt caching
    const systemPrompt = `You are a deal intelligence assistant for a commercial real estate tenant representation brokerage.

Your job is to answer broker questions using ONLY the deal data provided in the context below.

Rules:
- Be specific. Reference deal names, tenant names, contacts, SF requirements, timelines when available.
- If the data supports a clear answer, give it directly.
- If the data is incomplete or ambiguous, say what you know and flag what's missing.
- Never make up information that isn't in the context.
- Keep answers concise — brokers are busy.
- CITATIONS: When referencing data from the context, cite the source using [N] notation matching the chunk number. For example: "Deloitte is at the meeting_set stage [1] with 45,000 SF requirement [1]." This helps brokers verify your answers.`;

    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
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
        sources: rankedChunks.map((c: any) => ({
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

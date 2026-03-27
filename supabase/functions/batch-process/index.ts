import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ============================================================
// Batch Processing: Run bulk AI operations at lower cost
// (per Anthropic cookbook batch_processing pattern)
//
// Supported operations:
// - score_all_deals: Score every active deal
// - generate_follow_ups: Generate follow-up suggestions for stale deals
// - enrich_all_prospects: Generate enrichment summaries for all prospects
// - backfill_embeddings: Re-embed all records into RAG vector store
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { operation, options = {} } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership } = await userClient
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const orgId = membership.organization_id;

    switch (operation) {
      case "score_all_deals": {
        if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

        const { data: deals } = await supabase
          .from("pipeline_deals")
          .select("*")
          .eq("organization_id", orgId)
          .not("stage", "in", '("won","lost","closed")');

        if (!deals?.length) return jsonResponse({ results: [], message: "No active deals to score." });

        const results = [];
        // Process in batches of 5 to avoid rate limits
        for (let i = 0; i < deals.length; i += 5) {
          const batch = deals.slice(i, i + 5);
          const batchResults = await Promise.all(batch.map(async (deal: any) => {
            const resp = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": anthropicKey,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "claude-haiku-4-5-20241022",
                max_tokens: 300,
                system: "You are a CRE deal scorer. Score this deal 1-10 on fit, timing, engagement, and overall. Return JSON: {fit, timing, engagement, overall, recommendation}",
                messages: [{
                  role: "user",
                  content: `Deal: ${deal.prospect_name || deal.prospect_company || deal.tenant_id}\nStage: ${deal.stage}\nSF: ${deal.prospect_sqft || "unknown"}\nNotes: ${(deal.notes || []).slice(-3).join("; ")}\nLast Activity: ${deal.last_activity}\nTouchpoints: ${(deal.sent_touchpoints || []).length}`,
                }],
              }),
            });
            const data = await resp.json();
            const text = data.content?.[0]?.text || "{}";
            try {
              return { deal: deal.prospect_name || deal.tenant_id, ...JSON.parse(text) };
            } catch {
              return { deal: deal.prospect_name || deal.tenant_id, error: "Failed to parse score" };
            }
          }));
          results.push(...batchResults);
        }

        return jsonResponse({ results, count: results.length });
      }

      case "generate_follow_ups": {
        if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

        const staleDays = options.stale_days || 7;
        const cutoff = new Date(Date.now() - staleDays * 86400000).toISOString();

        const { data: staleDeals } = await supabase
          .from("pipeline_deals")
          .select("*")
          .eq("organization_id", orgId)
          .not("stage", "in", '("won","lost","closed")')
          .lt("last_activity", cutoff);

        if (!staleDeals?.length) return jsonResponse({ results: [], message: "No stale deals found." });

        const results = await Promise.all(staleDeals.map(async (deal: any) => {
          const resp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20241022",
              max_tokens: 200,
              system: "You are a CRE broker assistant. Suggest a specific follow-up action for this stale deal. Be concise — one sentence with the action and reason.",
              messages: [{
                role: "user",
                content: `Deal: ${deal.prospect_name || deal.tenant_id}\nCompany: ${deal.prospect_company}\nStage: ${deal.stage}\nSF: ${deal.prospect_sqft || "unknown"}\nLast Activity: ${deal.last_activity}\nDays Stale: ${Math.floor((Date.now() - new Date(deal.last_activity).getTime()) / 86400000)}`,
              }],
            }),
          });
          const data = await resp.json();
          return {
            deal: deal.prospect_name || deal.tenant_id,
            days_stale: Math.floor((Date.now() - new Date(deal.last_activity).getTime()) / 86400000),
            suggestion: data.content?.[0]?.text || "Follow up with this prospect.",
          };
        }));

        return jsonResponse({ results, count: results.length });
      }

      case "backfill_embeddings": {
        // Re-embed all records into the RAG vector store
        const tables = [
          { table: "pipeline_deals", type: "deal" },
          { table: "activities", type: "activity" },
          { table: "scoops", type: "scoop" },
          { table: "company_contacts", type: "contact" },
        ];

        let total = 0;
        const errors: string[] = [];

        for (const { table, type } of tables) {
          const { data: records } = await supabase
            .from(table)
            .select("*")
            .eq("organization_id", orgId);

          if (!records?.length) continue;

          for (const record of records) {
            try {
              await fetch(`${supabaseUrl}/functions/v1/rag-embed`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({
                  sourceType: type,
                  sourceId: record.id,
                  record,
                  orgId,
                }),
              });
              total++;
            } catch (e) {
              errors.push(`${type}:${record.id}: ${e.message}`);
            }
          }
        }

        return jsonResponse({
          message: `Backfill complete: ${total} records embedded.`,
          total,
          errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown operation: ${operation}. Supported: score_all_deals, generate_follow_ups, backfill_embeddings` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("Batch process error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Batch processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

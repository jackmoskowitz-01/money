import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ============================================================
// RAG Backfill — Embeds all existing data for an organization
// Requires super admin or org membership
// POST /functions/v1/rag-backfill
// Body: { organizationId?: string }  (super admin can specify any org)
// ============================================================

const BATCH_SIZE = 20; // OpenAI rate limit friendly
const EMBED_MODEL = "text-embedding-3-small";

// Table configs: which tables to backfill and how to map them
const TABLE_CONFIGS: {
  table: string;
  sourceType: string;
  idField: string;
  hasOrgId: boolean;
}[] = [
  { table: "pipeline_deals", sourceType: "deal", idField: "id", hasOrgId: true },
  { table: "activities", sourceType: "activity", idField: "id", hasOrgId: true },
  { table: "scoops", sourceType: "scoop", idField: "id", hasOrgId: true },
  { table: "company_contacts", sourceType: "contact", idField: "id", hasOrgId: true },
  { table: "email_threads", sourceType: "email", idField: "id", hasOrgId: true },
  { table: "tasks", sourceType: "task", idField: "id", hasOrgId: true },
  { table: "critical_dates", sourceType: "critical_date", idField: "id", hasOrgId: true },
  { table: "custom_prospects", sourceType: "prospect", idField: "id", hasOrgId: true },
  { table: "stacking_plans", sourceType: "stacking_plan", idField: "id", hasOrgId: true },
  { table: "prospect_lists", sourceType: "prospect_list", idField: "id", hasOrgId: true },
  { table: "copilot_brain", sourceType: "brain_fact", idField: "id", hasOrgId: true },
];

// Simplified chunkers (same logic as rag-embed but inline for independence)
function chunkRecord(sourceType: string, r: Record<string, unknown>): string {
  const lines: string[] = [];

  switch (sourceType) {
    case "deal":
      if (r.prospect_name || r.prospect_company) lines.push(`Deal: ${r.prospect_name || r.prospect_company}`);
      if (r.prospect_company) lines.push(`Company: ${r.prospect_company}`);
      if (r.stage) lines.push(`Stage: ${r.stage}`);
      if (r.prospect_sqft) lines.push(`Space: ${Number(r.prospect_sqft).toLocaleString()} SF`);
      if (r.prospect_email) lines.push(`Email: ${r.prospect_email}`);
      if (r.prospect_phone) lines.push(`Phone: ${r.prospect_phone}`);
      if (Array.isArray(r.notes) && r.notes.length) lines.push(`Notes: ${r.notes.join('; ')}`);
      if (r.last_activity) lines.push(`Last Activity: ${r.last_activity}`);
      break;

    case "activity":
      if (r.type) lines.push(`Activity: ${r.type}`);
      if (r.title) lines.push(`Title: ${r.title}`);
      if (r.description) lines.push(`Description: ${r.description}`);
      if (r.tenant_id) lines.push(`Prospect: ${r.tenant_id}`);
      if (r.timestamp) lines.push(`Date: ${r.timestamp}`);
      break;

    case "scoop":
      if (r.category) lines.push(`Scoop: ${r.category}`);
      if (r.content) lines.push(`Intel: ${r.content}`);
      if (r.linked_tenant_name) lines.push(`Tenant: ${r.linked_tenant_name}`);
      if (r.linked_building_name) lines.push(`Building: ${r.linked_building_name}`);
      if (Array.isArray(r.tags) && r.tags.length) lines.push(`Tags: ${r.tags.join(', ')}`);
      break;

    case "contact":
      if (r.name) lines.push(`Contact: ${r.name}`);
      if (r.title) lines.push(`Title: ${r.title}`);
      if (r.email) lines.push(`Email: ${r.email}`);
      if (r.direct_phone) lines.push(`Phone: ${r.direct_phone}`);
      if (r.entity_id) lines.push(`Entity: ${r.entity_id}`);
      break;

    case "email":
      if (r.prospect_name) lines.push(`Email to: ${r.prospect_name}`);
      if (r.subject) lines.push(`Subject: ${r.subject}`);
      if (r.body_preview) lines.push(`Preview: ${String(r.body_preview).substring(0, 300)}`);
      if (r.template_used) lines.push(`Template: ${r.template_used}`);
      if (r.outreach_reason) lines.push(`Reason: ${r.outreach_reason}`);
      if (r.sent_at) lines.push(`Sent: ${r.sent_at}`);
      if (r.reply_detected) lines.push(`Reply: Yes, Sentiment: ${r.reply_sentiment || 'unknown'}`);
      if (r.thread_status) lines.push(`Status: ${r.thread_status}`);
      break;

    case "task":
      if (r.title) lines.push(`Task: ${r.title}`);
      if (r.description) lines.push(`Description: ${r.description}`);
      if (r.type) lines.push(`Type: ${r.type}`);
      if (r.priority) lines.push(`Priority: ${r.priority}`);
      if (r.due_date) lines.push(`Due: ${r.due_date}`);
      lines.push(`Status: ${r.completed ? 'Completed' : 'Open'}`);
      if (r.assigned_to_name) lines.push(`Assigned to: ${r.assigned_to_name}`);
      break;

    case "critical_date":
      if (r.prospect_name) lines.push(`Prospect: ${r.prospect_name}`);
      if (r.building_name) lines.push(`Building: ${r.building_name}`);
      if (r.date_type) lines.push(`Type: ${String(r.date_type).replace(/_/g, ' ')}`);
      if (r.date_value) lines.push(`Date: ${r.date_value}`);
      if (r.description) lines.push(`Description: ${r.description}`);
      break;

    case "prospect":
      if (r.name) lines.push(`Prospect: ${r.name}`);
      if (r.address) lines.push(`Address: ${r.address}`);
      if (r.website) lines.push(`Website: ${r.website}`);
      const enrich = r.enrichment as Record<string, unknown> | null;
      if (enrich) {
        if (enrich.industry) lines.push(`Industry: ${enrich.industry}`);
        if (enrich.employeeCount) lines.push(`Employees: ${enrich.employeeCount}`);
        const space = enrich.spaceDetails as Record<string, unknown> | null;
        if (space?.currentSqft) lines.push(`Current Space: ${space.currentSqft}`);
        const signals = enrich.creSignals as string[] | null;
        if (signals?.length) lines.push(`Signals: ${signals.join('; ')}`);
      }
      break;

    case "stacking_plan":
      if (r.tenant_name) lines.push(`Tenant: ${r.tenant_name}`);
      if (r.building_id) lines.push(`Building: ${r.building_id}`);
      if (r.floor) lines.push(`Floor: ${r.floor}`);
      if (r.sqft) lines.push(`Size: ${Number(r.sqft).toLocaleString()} SF`);
      if (r.lease_expiration) lines.push(`Lease Exp: ${r.lease_expiration}`);
      break;

    case "prospect_list":
      if (r.name) lines.push(`List: ${r.name}`);
      if (r.industry) lines.push(`Industry: ${r.industry}`);
      break;

    case "brain_fact":
      if (r.fact) lines.push(`Fact: ${r.fact}`);
      if (r.category) lines.push(`Category: ${r.category}`);
      if (r.context) lines.push(`Context: ${r.context}`);
      if (r.prospect_name) lines.push(`Prospect: ${r.prospect_name}`);
      break;

    default:
      if (r.content) lines.push(String(r.content));
  }

  return lines.join('\n');
}

function extractMetadata(sourceType: string, r: Record<string, unknown>): Record<string, unknown> {
  switch (sourceType) {
    case "deal": return { tenant: r.prospect_name || r.prospect_company, stage: r.stage, sf: r.prospect_sqft };
    case "activity": return { activity_type: r.type, tenant_id: r.tenant_id };
    case "scoop": return { category: r.category, tenant: r.linked_tenant_name };
    case "contact": return { full_name: r.name, company: r.entity_id };
    case "email": return { prospect: r.prospect_name, status: r.thread_status };
    case "task": return { title: r.title, priority: r.priority, completed: r.completed };
    case "critical_date": return { prospect: r.prospect_name, date_type: r.date_type };
    case "prospect": return { name: r.name, address: r.address };
    case "stacking_plan": return { tenant: r.tenant_name, sf: r.sqft };
    default: return {};
  }
}

async function embedBatch(
  openaiKey: string,
  texts: string[]
): Promise<number[][]> {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI batch embedding failed: ${err}`);
  }

  const data = await resp.json();
  return data.data.map((d: any) => d.embedding);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine org_id
    let orgId = body.organizationId;

    if (!orgId) {
      const { data: membership } = await userClient
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      orgId = membership?.organization_id;
    }

    if (!orgId) {
      return new Response(JSON.stringify({ error: "No organization found" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    let totalEmbedded = 0;
    let totalSkipped = 0;
    const results: Record<string, number> = {};

    for (const config of TABLE_CONFIGS) {
      let query = adminClient.from(config.table).select("*");

      if (config.hasOrgId) {
        query = query.eq("organization_id", orgId);
      }

      const { data: rows, error } = await query.limit(1000);

      if (error) {
        console.error(`Error fetching ${config.table}:`, error.message);
        results[config.table] = 0;
        continue;
      }

      if (!rows || rows.length === 0) {
        results[config.table] = 0;
        continue;
      }

      // Process in batches
      let tableCount = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const texts: string[] = [];
        const validRows: any[] = [];

        for (const row of batch) {
          const text = chunkRecord(config.sourceType, row);
          if (text.trim()) {
            texts.push(text);
            validRows.push(row);
          } else {
            totalSkipped++;
          }
        }

        if (texts.length === 0) continue;

        // Get embeddings in batch
        const embeddings = await embedBatch(openaiKey, texts);

        // Upsert all
        const upsertRows = validRows.map((row, idx) => ({
          organization_id: orgId,
          source_type: config.sourceType,
          source_id: String(row[config.idField]),
          content: texts[idx],
          embedding: embeddings[idx],
          metadata: extractMetadata(config.sourceType, row),
        }));

        const { error: upsertError } = await adminClient
          .from("embeddings")
          .upsert(upsertRows, {
            onConflict: "organization_id,source_type,source_id",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`Upsert error for ${config.table}:`, upsertError.message);
        } else {
          tableCount += validRows.length;
          totalEmbedded += validRows.length;
        }

        // Small delay to respect OpenAI rate limits
        if (i + BATCH_SIZE < rows.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      results[config.table] = tableCount;
    }

    return new Response(
      JSON.stringify({
        success: true,
        organization_id: orgId,
        total_embedded: totalEmbedded,
        total_skipped: totalSkipped,
        by_table: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("RAG backfill error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Backfill failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

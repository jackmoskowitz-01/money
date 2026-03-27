import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ============================================================
// Chunkers — convert DealFlow records to embeddable text
// ============================================================

type ChunkResult = { content: string; metadata: Record<string, unknown> };

// Contextual prefix: provides document-level context for better embedding quality
// (per Anthropic cookbook contextual-embeddings pattern — 35% fewer retrieval failures)
function contextPrefix(sourceType: string, record: Record<string, unknown>): string {
  switch (sourceType) {
    case "deal": {
      const name = record.prospect_company || record.prospect_name || "Unknown";
      const sf = record.prospect_sqft ? `${Number(record.prospect_sqft).toLocaleString()} SF` : "unknown size";
      const stage = record.stage ? String(record.stage).replace(/_/g, " ") : "unknown stage";
      return `[CRE Pipeline Deal] This is a deal record for a commercial real estate tenant rep brokerage tracking prospect ${name}, a ${sf} requirement currently in the ${stage} pipeline stage.`;
    }
    case "contact": {
      const name = record.name || "Unknown";
      const company = record.entity_id || "unknown company";
      return `[CRE Contact] This is a contact record for ${name} associated with ${company} in a commercial real estate tenant rep brokerage.`;
    }
    case "activity": {
      const type = record.type ? String(record.type).replace(/_/g, " ") : "general";
      const tenant = record.tenant_id || "unknown prospect";
      return `[CRE Activity] This is a ${type} activity record for prospect ${tenant} in a commercial real estate tenant rep brokerage pipeline.`;
    }
    case "scoop": {
      const category = record.category || "general";
      const tenant = record.linked_tenant_name || "";
      return `[CRE Market Intel] This is a ${category} scoop/intelligence item${tenant ? ` related to ${tenant}` : ""} in a commercial real estate brokerage.`;
    }
    case "email": {
      const prospect = record.prospect_name || "unknown";
      return `[CRE Email] This is an outreach email record to ${prospect} in a commercial real estate tenant rep brokerage.`;
    }
    case "task": {
      const title = record.title || "untitled";
      return `[CRE Task] This is a task "${title}" in a commercial real estate tenant rep brokerage pipeline.`;
    }
    case "critical_date": {
      const prospect = record.prospect_name || "unknown";
      const dateType = record.date_type ? String(record.date_type).replace(/_/g, " ") : "unknown";
      return `[CRE Critical Date] This is a ${dateType} date for ${prospect} in a commercial real estate brokerage.`;
    }
    case "lease_abstract": {
      const tenant = record.tenant_name || "unknown";
      const building = record.building_name || "unknown";
      return `[CRE Lease Abstract] This is a lease abstract for ${tenant} at ${building} in a commercial real estate brokerage.`;
    }
    case "prospect": {
      const name = record.name || "unknown";
      return `[CRE Prospect] This is a custom prospect record for ${name} in a commercial real estate tenant rep brokerage.`;
    }
    case "document": {
      const title = record.title || record.filename || "untitled";
      return `[CRE Document] This is an excerpt from "${title}", a document uploaded to a commercial real estate tenant rep brokerage system.`;
    }
    default:
      return `[CRE Record] This is a ${sourceType} record in a commercial real estate tenant rep brokerage.`;
  }
}

function chunkDeal(r: Record<string, unknown>): ChunkResult {
  const lines: string[] = [];
  if (r.prospect_name || r.prospect_company) lines.push(`Deal: ${r.prospect_name || r.prospect_company}`);
  if (r.prospect_company) lines.push(`Company: ${r.prospect_company}`);
  if (r.stage) lines.push(`Stage: ${r.stage}`);
  if (r.prospect_sqft) lines.push(`Space Requirement: ${Number(r.prospect_sqft).toLocaleString()} SF`);
  if (r.prospect_email) lines.push(`Contact Email: ${r.prospect_email}`);
  if (r.prospect_phone) lines.push(`Contact Phone: ${r.prospect_phone}`);
  if (r.building_id && r.building_id !== 'manual') lines.push(`Building: ${r.building_id}`);
  if (Array.isArray(r.notes) && r.notes.length > 0) lines.push(`Notes: ${r.notes.join('; ')}`);
  if (r.is_manual) lines.push(`Source: Manually added prospect`);
  if (r.last_activity) lines.push(`Last Activity: ${r.last_activity}`);
  return {
    content: lines.join('\n'),
    metadata: { tenant: r.prospect_name || r.prospect_company, stage: r.stage, sf: r.prospect_sqft, company: r.prospect_company },
  };
}

function chunkContact(r: Record<string, unknown>): ChunkResult {
  const lines: string[] = [];
  if (r.name) lines.push(`Contact: ${r.name}`);
  if (r.title) lines.push(`Title: ${r.title}`);
  if (r.email) lines.push(`Email: ${r.email}`);
  if (r.direct_phone) lines.push(`Direct Phone: ${r.direct_phone}`);
  if (r.mobile_phone) lines.push(`Mobile: ${r.mobile_phone}`);
  if (r.entity_id) lines.push(`Company/Entity: ${r.entity_id}`);
  return { content: lines.join('\n'), metadata: { full_name: r.name, company: r.entity_id, contact_role: r.title } };
}

function chunkActivity(r: Record<string, unknown>): ChunkResult {
  const lines: string[] = [];
  if (r.type) lines.push(`Activity Type: ${String(r.type).charAt(0).toUpperCase() + String(r.type).slice(1)}`);
  if (r.title) lines.push(`Title: ${r.title}`);
  if (r.description) lines.push(`Description: ${r.description}`);
  if (r.tenant_id) lines.push(`Prospect: ${r.tenant_id}`);
  if (r.timestamp) lines.push(`Date: ${r.timestamp}`);
  if (r.outreach_reason_used) lines.push(`Outreach Reason: ${r.outreach_reason_used}`);
  return { content: lines.join('\n'), metadata: { activity_type: r.type, tenant_id: r.tenant_id, date: r.timestamp } };
}

function chunkScoop(r: Record<string, unknown>): ChunkResult {
  const lines: string[] = [];
  if (r.category) lines.push(`Scoop Category: ${r.category}`);
  if (r.content) lines.push(`Intel: ${r.content}`);
  if (r.linked_tenant_name) lines.push(`Tenant: ${r.linked_tenant_name}`);
  if (r.linked_building_name) lines.push(`Building: ${r.linked_building_name}`);
  if (Array.isArray(r.tags) && r.tags.length > 0) lines.push(`Tags: ${r.tags.join(', ')}`);
  return { content: lines.join('\n'), metadata: { category: r.category, tenant: r.linked_tenant_name, building: r.linked_building_name } };
}

function chunkEmail(r: Record<string, unknown>): ChunkResult {
  const lines: string[] = [];
  if (r.prospect_name) lines.push(`Email to: ${r.prospect_name}`);
  if (r.prospect_email) lines.push(`Email: ${r.prospect_email}`);
  if (r.subject) lines.push(`Subject: ${r.subject}`);
  if (r.body_preview) lines.push(`Preview: ${r.body_preview}`);
  if (r.template_used) lines.push(`Template: ${r.template_used}`);
  if (r.tone_used) lines.push(`Tone: ${r.tone_used}`);
  if (r.outreach_reason) lines.push(`Reason: ${r.outreach_reason}`);
  if (r.industry) lines.push(`Industry: ${r.industry}`);
  if (r.sent_at) lines.push(`Sent: ${r.sent_at}`);
  if (r.reply_detected) {
    lines.push(`Reply: Yes`);
    if (r.reply_sentiment) lines.push(`Sentiment: ${r.reply_sentiment}`);
    if (r.reply_content) lines.push(`Reply Content: ${String(r.reply_content).substring(0, 300)}`);
  }
  if (r.thread_status) lines.push(`Status: ${r.thread_status}`);
  return { content: lines.join('\n'), metadata: { prospect: r.prospect_name, industry: r.industry, status: r.thread_status, template: r.template_used } };
}

function chunkTask(r: Record<string, unknown>): ChunkResult {
  const lines: string[] = [];
  if (r.title) lines.push(`Task: ${r.title}`);
  if (r.description) lines.push(`Description: ${r.description}`);
  if (r.type) lines.push(`Type: ${r.type}`);
  if (r.priority) lines.push(`Priority: ${r.priority}`);
  if (r.due_date) lines.push(`Due: ${r.due_date}`);
  if (r.completed !== undefined) lines.push(`Status: ${r.completed ? 'Completed' : 'Open'}`);
  if (r.assigned_to_name) lines.push(`Assigned to: ${r.assigned_to_name}`);
  if (r.tenant_id) lines.push(`Prospect: ${r.tenant_id}`);
  return { content: lines.join('\n'), metadata: { title: r.title, priority: r.priority, type: r.type, completed: r.completed } };
}

function chunkCriticalDate(r: Record<string, unknown>): ChunkResult {
  const lines: string[] = [];
  if (r.prospect_name) lines.push(`Prospect: ${r.prospect_name}`);
  if (r.building_name) lines.push(`Building: ${r.building_name}`);
  if (r.date_type) lines.push(`Date Type: ${String(r.date_type).replace(/_/g, ' ')}`);
  if (r.date_value) lines.push(`Date: ${r.date_value}`);
  if (r.description) lines.push(`Description: ${r.description}`);
  if (r.remind_days_before) lines.push(`Reminder: ${r.remind_days_before} days before`);
  if (r.source) lines.push(`Source: ${r.source}`);
  return { content: lines.join('\n'), metadata: { prospect: r.prospect_name, date_type: r.date_type, date: r.date_value } };
}

function chunkLeaseAbstract(r: Record<string, unknown>): ChunkResult {
  const lines: string[] = [];
  if (r.tenant_name) lines.push(`Tenant: ${r.tenant_name}`);
  if (r.landlord_name) lines.push(`Landlord: ${r.landlord_name}`);
  if (r.building_name) lines.push(`Building: ${r.building_name}`);
  if (r.building_address) lines.push(`Address: ${r.building_address}`);
  if (r.premises_sf) lines.push(`Premises: ${Number(r.premises_sf).toLocaleString()} SF`);
  if (r.floor_suite) lines.push(`Floor/Suite: ${r.floor_suite}`);
  if (r.lease_type) lines.push(`Lease Type: ${r.lease_type}`);
  if (r.commencement_date) lines.push(`Commencement: ${r.commencement_date}`);
  if (r.expiration_date) lines.push(`Expiration: ${r.expiration_date}`);
  if (r.term_months) lines.push(`Term: ${r.term_months} months`);
  if (r.base_rent_psf) lines.push(`Base Rent: $${r.base_rent_psf}/SF`);
  if (r.escalation_type) lines.push(`Escalation: ${r.escalation_type}${r.escalation_rate ? ` (${r.escalation_rate}%)` : ''}`);
  if (r.free_rent_months) lines.push(`Free Rent: ${r.free_rent_months} months`);
  if (r.ti_allowance_psf) lines.push(`TI Allowance: $${r.ti_allowance_psf}/SF`);
  if (r.operating_expenses) lines.push(`OpEx: ${r.operating_expenses}`);
  if (r.security_deposit) lines.push(`Security Deposit: ${r.security_deposit}`);
  if (r.notable_clauses) lines.push(`Notable Clauses: ${r.notable_clauses}`);
  return { content: lines.join('\n'), metadata: { tenant: r.tenant_name, building: r.building_name, sf: r.premises_sf, rent: r.base_rent_psf } };
}

function chunkStackingPlan(r: Record<string, unknown>): ChunkResult {
  const lines: string[] = [];
  if (r.tenant_name) lines.push(`Tenant: ${r.tenant_name}`);
  if (r.building_id) lines.push(`Building: ${r.building_id}`);
  if (r.floor) lines.push(`Floor: ${r.floor}`);
  if (r.sqft) lines.push(`Size: ${Number(r.sqft).toLocaleString()} SF`);
  if (r.industry) lines.push(`Industry: ${r.industry}`);
  if (r.lease_expiration) lines.push(`Lease Expiration: ${r.lease_expiration}`);
  if (r.notes) lines.push(`Notes: ${r.notes}`);
  return { content: lines.join('\n'), metadata: { tenant: r.tenant_name, building: r.building_id, sf: r.sqft, expiration: r.lease_expiration } };
}

function chunkProspectList(r: Record<string, unknown>): ChunkResult {
  const lines: string[] = [];
  if (r.name) lines.push(`Prospect List: ${r.name}`);
  if (r.industry) lines.push(`Industry Focus: ${r.industry}`);
  return { content: lines.join('\n'), metadata: { name: r.name, industry: r.industry } };
}

function chunkBrainFact(r: Record<string, unknown>): ChunkResult {
  const lines: string[] = [];
  if (r.fact) lines.push(`Fact: ${r.fact}`);
  if (r.category) lines.push(`Category: ${r.category}`);
  if (r.context) lines.push(`Context: ${r.context}`);
  if (r.prospect_name) lines.push(`Prospect: ${r.prospect_name}`);
  if (r.source) lines.push(`Source: ${r.source}`);
  return { content: lines.join('\n'), metadata: { category: r.category, prospect: r.prospect_name, confidence: r.confidence } };
}

function chunkProspect(r: Record<string, unknown>): ChunkResult {
  const lines: string[] = [];
  if (r.name) lines.push(`Prospect: ${r.name}`);
  if (r.address) lines.push(`Address: ${r.address}`);
  if (r.website) lines.push(`Website: ${r.website}`);
  const enrichment = r.enrichment as Record<string, unknown> | null;
  if (enrichment) {
    if (enrichment.industry) lines.push(`Industry: ${enrichment.industry}`);
    if (enrichment.employeeCount) lines.push(`Employees: ${enrichment.employeeCount}`);
    const space = enrichment.spaceDetails as Record<string, unknown> | null;
    if (space?.currentSqft) lines.push(`Current Space: ${space.currentSqft}`);
    const contacts = enrichment.keyContacts as Array<Record<string, unknown>> | null;
    if (contacts?.length) lines.push(`Key Contacts: ${contacts.map(c => `${c.name} (${c.title})`).join(', ')}`);
    const signals = enrichment.creSignals as string[] | null;
    if (signals?.length) lines.push(`CRE Signals: ${signals.join('; ')}`);
  }
  return { content: lines.join('\n'), metadata: { name: r.name, industry: enrichment?.industry, address: r.address } };
}

// Chunker dispatcher
const CHUNKERS: Record<string, (r: Record<string, unknown>) => ChunkResult> = {
  deal: chunkDeal,
  contact: chunkContact,
  activity: chunkActivity,
  scoop: chunkScoop,
  email: chunkEmail,
  task: chunkTask,
  critical_date: chunkCriticalDate,
  lease_abstract: chunkLeaseAbstract,
  stacking_plan: chunkStackingPlan,
  prospect_list: chunkProspectList,
  brain_fact: chunkBrainFact,
  prospect: chunkProspect,
};

// Document chunker — splits long text into overlapping chunks
function chunkDocument(record: Record<string, unknown>): ChunkResult[] {
  const text = String(record.content || record.text || "");
  const title = String(record.title || record.filename || "document");
  if (!text.trim()) return [];

  const CHUNK_SIZE = 1500;
  const OVERLAP = 200;
  const chunks: ChunkResult[] = [];

  for (let start = 0; start < text.length; start += CHUNK_SIZE - OVERLAP) {
    const slice = text.slice(start, start + CHUNK_SIZE).trim();
    if (!slice) continue;
    chunks.push({
      content: `Document: ${title}\n\n${slice}`,
      metadata: { title, chunk_index: chunks.length, total_chunks: -1 },
    });
  }

  for (const c of chunks) {
    c.metadata.total_chunks = chunks.length;
  }

  return chunks;
}

// ============================================================
// Edge Function Handler
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sourceType, sourceId, record, orgId: providedOrgId } = await req.json();

    if (!sourceType || !sourceId || !record) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: sourceType, sourceId, record" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth: get user and their org (or use provided orgId for server-to-server calls)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    let orgId = providedOrgId;

    if (!orgId) {
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

      const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const svcClient = createClient(supabaseUrl, svcKey);
      const { data: membership } = await svcClient
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
      orgId = membership.organization_id;
    }

    // Chunk the record — documents produce multiple chunks, others produce one
    let chunks: { content: string; metadata: Record<string, unknown>; chunkSourceId: string }[] = [];

    if (sourceType === "document") {
      const docChunks = chunkDocument(record);
      if (docChunks.length === 0) {
        return new Response(
          JSON.stringify({ success: true, skipped: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      chunks = docChunks.map((c, i) => ({ ...c, chunkSourceId: `${sourceId}-chunk-${i}` }));
    } else {
      const chunker = CHUNKERS[sourceType];
      if (!chunker) {
        return new Response(
          JSON.stringify({ error: `Unknown sourceType: ${sourceType}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const chunkResult = chunker(record);
      if (!chunkResult.content.trim()) {
        return new Response(
          JSON.stringify({ success: true, skipped: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      chunks = [{ ...chunkResult, chunkSourceId: sourceId }];
    }

    // Generate embeddings via OpenAI
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepend contextual prefixes and batch-embed all chunks
    const prefix = contextPrefix(sourceType, record);
    const embeddableTexts = chunks.map(c => `${prefix}\n\n${c.content}`);

    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: embeddableTexts,
      }),
    });

    if (!embeddingResponse.ok) {
      const err = await embeddingResponse.text();
      throw new Error(`OpenAI embedding failed: ${err}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embeddings = embeddingData.data.map((d: any) => d.embedding);

    // Upsert into Supabase using service role
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const rows = chunks.map((c, i) => ({
      organization_id: orgId,
      source_type: sourceType,
      source_id: c.chunkSourceId,
      content: c.content,
      embedding: embeddings[i],
      metadata: c.metadata,
    }));

    const { error: upsertError } = await adminClient
      .from("embeddings")
      .upsert(rows, {
        onConflict: "organization_id,source_type,source_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      throw new Error(`Embedding upsert failed: ${upsertError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, chunks: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("RAG embed error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Embedding failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

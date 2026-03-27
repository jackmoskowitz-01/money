import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ============================================================
// Chunkers — convert DealFlow records to embeddable text
// ============================================================

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
    case "document": {
      const title = record.title || record.filename || "untitled";
      return `[CRE Document] This is an excerpt from "${title}", a document uploaded to a commercial real estate tenant rep brokerage system.`;
    }
    default:
      return `[CRE Record] This is a ${sourceType} record in a commercial real estate tenant rep brokerage.`;
  }
}

function chunkDeal(record: Record<string, unknown>): { content: string; metadata: Record<string, unknown> } {
  const lines: string[] = [];

  if (record.prospect_name || record.prospect_company) {
    lines.push(`Deal: ${record.prospect_name || record.prospect_company}`);
  }
  if (record.prospect_company) lines.push(`Company: ${record.prospect_company}`);
  if (record.stage) lines.push(`Stage: ${record.stage}`);
  if (record.prospect_sqft) lines.push(`Space Requirement: ${Number(record.prospect_sqft).toLocaleString()} SF`);
  if (record.prospect_email) lines.push(`Contact Email: ${record.prospect_email}`);
  if (record.prospect_phone) lines.push(`Contact Phone: ${record.prospect_phone}`);
  if (record.building_id && record.building_id !== 'manual') lines.push(`Building: ${record.building_id}`);
  if (Array.isArray(record.notes) && record.notes.length > 0) {
    lines.push(`Notes: ${record.notes.join('; ')}`);
  }
  if (record.is_manual) lines.push(`Source: Manually added prospect`);

  return {
    content: lines.join('\n'),
    metadata: {
      tenant: record.prospect_name || record.prospect_company,
      stage: record.stage,
      sf: record.prospect_sqft,
      company: record.prospect_company,
    },
  };
}

function chunkContact(record: Record<string, unknown>): { content: string; metadata: Record<string, unknown> } {
  const lines: string[] = [];

  if (record.name) lines.push(`Contact: ${record.name}`);
  if (record.title) lines.push(`Title: ${record.title}`);
  if (record.email) lines.push(`Email: ${record.email}`);
  if (record.direct_phone) lines.push(`Direct Phone: ${record.direct_phone}`);
  if (record.mobile_phone) lines.push(`Mobile: ${record.mobile_phone}`);
  if (record.entity_id) lines.push(`Company/Entity: ${record.entity_id}`);

  return {
    content: lines.join('\n'),
    metadata: {
      full_name: record.name,
      company: record.entity_id,
      contact_role: record.title,
    },
  };
}

function chunkActivity(record: Record<string, unknown>): { content: string; metadata: Record<string, unknown> } {
  const lines: string[] = [];

  if (record.type) lines.push(`Activity Type: ${String(record.type).charAt(0).toUpperCase() + String(record.type).slice(1)}`);
  if (record.title) lines.push(`Title: ${record.title}`);
  if (record.description) lines.push(`Description: ${record.description}`);
  if (record.tenant_id) lines.push(`Prospect: ${record.tenant_id}`);
  if (record.timestamp) lines.push(`Date: ${record.timestamp}`);
  if (record.outreach_reason_used) lines.push(`Outreach Reason: ${record.outreach_reason_used}`);

  return {
    content: lines.join('\n'),
    metadata: {
      activity_type: record.type,
      tenant_id: record.tenant_id,
      date: record.timestamp,
    },
  };
}

function chunkScoop(record: Record<string, unknown>): { content: string; metadata: Record<string, unknown> } {
  const lines: string[] = [];

  if (record.category) lines.push(`Scoop Category: ${record.category}`);
  if (record.content) lines.push(`Intel: ${record.content}`);
  if (record.linked_tenant_name) lines.push(`Tenant: ${record.linked_tenant_name}`);
  if (record.linked_building_name) lines.push(`Building: ${record.linked_building_name}`);
  if (Array.isArray(record.tags) && record.tags.length > 0) {
    lines.push(`Tags: ${record.tags.join(', ')}`);
  }

  return {
    content: lines.join('\n'),
    metadata: {
      category: record.category,
      tenant: record.linked_tenant_name,
      building: record.linked_building_name,
    },
  };
}

function chunkDocument(record: Record<string, unknown>): { content: string; metadata: Record<string, unknown> }[] {
  const text = String(record.content || record.text || "");
  const title = String(record.title || record.filename || "document");
  if (!text.trim()) return [];

  // Split into overlapping chunks of ~1500 chars with 200 char overlap
  const CHUNK_SIZE = 1500;
  const OVERLAP = 200;
  const chunks: { content: string; metadata: Record<string, unknown> }[] = [];

  for (let start = 0; start < text.length; start += CHUNK_SIZE - OVERLAP) {
    const slice = text.slice(start, start + CHUNK_SIZE).trim();
    if (!slice) continue;
    chunks.push({
      content: `Document: ${title}\n\n${slice}`,
      metadata: {
        title,
        chunk_index: chunks.length,
        total_chunks: -1, // filled below
      },
    });
  }

  // Fill total_chunks
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
      chunks = docChunks.map((c, i) => ({
        ...c,
        chunkSourceId: `${sourceId}-chunk-${i}`,
      }));
    } else {
      let chunkResult: { content: string; metadata: Record<string, unknown> };
      switch (sourceType) {
        case "deal":
          chunkResult = chunkDeal(record);
          break;
        case "contact":
          chunkResult = chunkContact(record);
          break;
        case "activity":
          chunkResult = chunkActivity(record);
          break;
        case "scoop":
          chunkResult = chunkScoop(record);
          break;
        default:
          return new Response(
            JSON.stringify({ error: `Unknown sourceType: ${sourceType}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
      }
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

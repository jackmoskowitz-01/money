import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ============================================================
// Chunkers — convert DealFlow records to embeddable text
// ============================================================

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

// ============================================================
// Edge Function Handler
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sourceType, sourceId, record } = await req.json();

    if (!sourceType || !sourceId || !record) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: sourceType, sourceId, record" }),
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

    // Chunk the record
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

    // Generate embedding via OpenAI
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
        input: chunkResult.content,
      }),
    });

    if (!embeddingResponse.ok) {
      const err = await embeddingResponse.text();
      throw new Error(`OpenAI embedding failed: ${err}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    // Upsert into Supabase using service role
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: upsertError } = await adminClient
      .from("embeddings")
      .upsert(
        {
          organization_id: orgId,
          source_type: sourceType,
          source_id: sourceId,
          content: chunkResult.content,
          embedding: embedding,
          metadata: chunkResult.metadata,
        },
        {
          onConflict: "organization_id,source_type,source_id",
          ignoreDuplicates: false,
        }
      );

    if (upsertError) {
      throw new Error(`Embedding upsert failed: ${upsertError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
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

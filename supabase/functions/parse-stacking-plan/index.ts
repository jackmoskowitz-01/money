import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const buildingName = formData.get("buildingName") as string || "";

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileName = file.name;
    const fileType = file.type;

    const isText =
      fileType === "text/plain" ||
      fileType === "text/csv" ||
      fileType === "application/json" ||
      fileName.endsWith(".txt") ||
      fileName.endsWith(".csv") ||
      fileName.endsWith(".md");

    const contentParts: any[] = [];

    const systemPrompt = `You are a stacking plan parser for commercial real estate. Extract tenant occupancy data from the uploaded document (which may be a stacking plan, rent roll, lease schedule, or similar).

For each tenant found, extract:
- tenant_name: Company/tenant name
- industry: Industry or business type (guess from name if not stated)
- sqft: Square footage occupied (number, 0 if unknown)
- floor: Floor number or range (e.g. "3" or "3-5")
- lease_expiration: Lease expiration date (e.g. "6/2027" or "N/A")
- notes: Any relevant notes

Building context: ${buildingName}

Return ONLY a valid JSON array of objects. No markdown, no explanation. Example:
[
  {"tenant_name": "Deloitte", "industry": "Consulting", "sqft": 45000, "floor": "8-10", "lease_expiration": "3/2028", "notes": "Full floor tenant"},
  {"tenant_name": "WeWork", "industry": "Coworking", "sqft": 12000, "floor": "2", "lease_expiration": "12/2025", "notes": ""}
]`;

    if (isText) {
      const text = new TextDecoder().decode(bytes);
      const truncated = text.length > 50000 ? text.slice(0, 50000) : text;
      contentParts.push({ type: "text", text: `Document content:\n${truncated}` });
    } else {
      const base64 = btoa(String.fromCharCode(...bytes));
      contentParts.push({
        type: "file",
        file: {
          filename: fileName,
          file_data: `data:${fileType || "application/octet-stream"};base64,${base64}`,
        },
      });
      contentParts.push({
        type: "text",
        text: "Extract all tenant/occupancy data from this stacking plan document.",
      });
    }

    const resp = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contentParts },
        ],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`AI request failed: ${err}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "Could not parse tenants from document", raw: content }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenants = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ tenants }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Parse stacking plan error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

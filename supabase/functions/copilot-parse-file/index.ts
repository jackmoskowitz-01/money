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
    const file = formData.get("file") as File | null;
    const question = formData.get("question") as string || "Summarize this document and highlight key CRE-relevant terms (rent, SF, TI, lease term, dates, parties).";
    const context = formData.get("context") as string || "";

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Read file content
    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileName = file.name;
    const fileType = file.type;
    let textContent = "";

    // Extract text based on file type
    if (fileType === "text/plain" || fileType === "text/csv" || fileName.endsWith(".txt") || fileName.endsWith(".csv") || fileName.endsWith(".md")) {
      textContent = new TextDecoder().decode(bytes);
    } else if (fileType === "application/json" || fileName.endsWith(".json")) {
      textContent = new TextDecoder().decode(bytes);
    } else {
      // For PDFs and other binary formats, encode as base64 and use multimodal
      const base64 = btoa(String.fromCharCode(...bytes));

      // Use Gemini's multimodal capability for PDFs
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a CRE document analyst. Extract and analyze commercial real estate documents (leases, LOIs, proposals, abstracts). Focus on: parties, property address, square footage, rent/SF, TI allowance, free rent, lease term, commencement date, escalations, options, and any notable clauses. Format your response with clear headers and bullet points.${context ? "\n\nAdditional context:\n" + context : ""}`,
            },
            {
              role: "user",
              content: [
                {
                  type: "file",
                  file: {
                    filename: fileName,
                    file_data: `data:${fileType || "application/octet-stream"};base64,${base64}`,
                  },
                },
                {
                  type: "text",
                  text: question,
                },
              ],
            },
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Usage credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI error:", response.status, t);
        return new Response(JSON.stringify({ error: "Failed to analyze document" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // For text-based files, use regular chat
    if (textContent.length > 100000) {
      textContent = textContent.slice(0, 100000) + "\n\n[... truncated at 100K characters ...]";
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a CRE document analyst. Extract and analyze commercial real estate documents. Focus on key deal terms: parties, property, SF, rent, TI, free rent, lease term, dates, escalations, options, and notable clauses.${context ? "\n\nAdditional context:\n" + context : ""}`,
          },
          {
            role: "user",
            content: `Here is the content of "${fileName}":\n\n${textContent}\n\n${question}`,
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Failed to analyze document" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("parse-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

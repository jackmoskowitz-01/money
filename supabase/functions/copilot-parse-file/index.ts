import { corsHeaders } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll("file") as File[];
    const question = formData.get("question") as string || "Summarize this document and highlight key CRE-relevant terms (rent, SF, TI, lease term, dates, parties).";
    const context = formData.get("context") as string || "";

    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!geminiKey) throw new Error("GOOGLE_AI_API_KEY is not configured");

    // Build Gemini content parts from files
    const parts: any[] = [];

    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fileName = file.name;
      const fileType = file.type;

      const isText = fileType === "text/plain" || fileType === "text/csv" || fileType === "application/json" ||
        fileName.endsWith(".txt") || fileName.endsWith(".csv") || fileName.endsWith(".md") || fileName.endsWith(".json");

      if (isText) {
        const text = new TextDecoder().decode(bytes);
        const truncated = text.length > 200000 ? text.slice(0, 200000) + "\n\n[... truncated ...]" : text;
        parts.push({ text: `--- File: ${fileName} ---\n${truncated}` });
      } else {
        // PDF, images, etc — Gemini handles all of these natively via inline_data
        const base64 = btoa(String.fromCharCode(...bytes));
        const mimeType = fileType || (fileName.endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
        parts.push({
          inline_data: { mime_type: mimeType, data: base64 },
        });
      }
    }

    // Add the question
    const systemPrompt = `You are a CRE document analyst. Extract and analyze commercial real estate documents (leases, LOIs, proposals, abstracts, offer comparisons). Focus on: parties, property address, square footage, rent/SF, TI allowance, free rent, lease term, commencement date, escalations, options, and any notable clauses. When multiple documents are provided, analyze them together and cross-reference data between them. Format your response with clear headers and bullet points.${context ? "\n\nAdditional context:\n" + context : ""}`;

    parts.push({ text: `${systemPrompt}\n\n${question}` });

    // Call Gemini 2.5 Flash — fast, 1M context, native PDF support
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { maxOutputTokens: 16384 },
          }),
        }
      );

      if (response.status === 429) {
        console.warn(`Gemini rate limited, retry ${attempt + 1}/3...`);
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      break;
    }

    if (!response || !response.ok) {
      const err = await response?.text() || "Unknown error";
      console.error("Gemini error:", response?.status, err);
      return new Response(JSON.stringify({ error: "Failed to analyze document. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert Gemini SSE stream to OpenAI-compatible SSE format (for frontend)
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const sseStream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        for (const line of decoder.decode(value).split("\n").filter(l => l.startsWith("data: "))) {
          const data = line.slice(6).trim();
          if (!data) continue;
          try {
            const event = JSON.parse(data);
            const text = event.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                choices: [{ delta: { content: text }, index: 0, finish_reason: null }],
              })}\n\n`));
            }
            if (event.candidates?.[0]?.finishReason === "STOP") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            }
          } catch { /* skip */ }
        }
      },
    });

    return new Response(sseStream, {
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

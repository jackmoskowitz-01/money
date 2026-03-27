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

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    // Build content parts for Anthropic
    const contentParts: any[] = [];
    let allTextContent = "";

    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fileName = file.name;
      const fileType = file.type;

      const isText = fileType === "text/plain" || fileType === "text/csv" || fileType === "application/json" ||
        fileName.endsWith(".txt") || fileName.endsWith(".csv") || fileName.endsWith(".md") || fileName.endsWith(".json");

      if (isText) {
        const text = new TextDecoder().decode(bytes);
        const truncated = text.length > 80000 ? text.slice(0, 80000) + "\n\n[... truncated ...]" : text;
        allTextContent += `\n\n--- File: ${fileName} ---\n${truncated}`;
      } else if (fileType === "application/pdf") {
        // Anthropic supports PDF via base64
        const base64 = btoa(String.fromCharCode(...bytes));
        contentParts.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        });
      } else if (fileType?.startsWith("image/")) {
        const base64 = btoa(String.fromCharCode(...bytes));
        contentParts.push({
          type: "image",
          source: { type: "base64", media_type: fileType, data: base64 },
        });
      } else {
        // Unsupported binary — try to read as text
        try {
          const text = new TextDecoder().decode(bytes);
          allTextContent += `\n\n--- File: ${fileName} ---\n${text.slice(0, 40000)}`;
        } catch {
          allTextContent += `\n\n--- File: ${fileName} (binary, could not read) ---`;
        }
      }
    }

    if (allTextContent) {
      contentParts.push({ type: "text", text: allTextContent });
    }
    contentParts.push({ type: "text", text: question });

    const systemPrompt = `You are a CRE document analyst. Extract and analyze commercial real estate documents (leases, LOIs, proposals, abstracts, offer comparisons). Focus on: parties, property address, square footage, rent/SF, TI allowance, free rent, lease term, commencement date, escalations, options, and any notable clauses. When multiple documents are provided, analyze them together and cross-reference data between them. Format your response with clear headers and bullet points.${context ? "\n\nAdditional context:\n" + context : ""}`;

    // Call Anthropic with retry on overload
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-opus-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: contentParts }],
          stream: true,
        }),
      });

      if (response.status === 429 || response.status === 529) {
        console.warn(`Anthropic overloaded (${response.status}), retry ${attempt + 1}/3...`);
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      break;
    }

    if (!response || !response.ok) {
      if (response?.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response?.text() || "Unknown error";
      console.error("Anthropic error:", response?.status, t);
      return new Response(JSON.stringify({ error: "Failed to analyze document. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert Anthropic SSE stream to OpenAI-compatible SSE format
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
        const text = decoder.decode(value);
        for (const line of text.split("\n").filter(l => l.startsWith("data: "))) {
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const event = JSON.parse(data);
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                choices: [{ delta: { content: event.delta.text }, index: 0, finish_reason: null }],
              })}\n\n`));
            }
            if (event.type === "message_stop") {
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

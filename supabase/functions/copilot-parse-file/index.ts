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

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    // Sort files by type
    let allTextContent = "";
    const imagePartsOpenAI: any[] = [];
    const pdfPartsClaude: any[] = [];
    let hasPDFs = false;

    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fileName = file.name;
      const fileType = file.type;

      const isText = fileType === "text/plain" || fileType === "text/csv" || fileType === "application/json" ||
        fileName.endsWith(".txt") || fileName.endsWith(".csv") || fileName.endsWith(".md") || fileName.endsWith(".json");

      if (isText) {
        const text = new TextDecoder().decode(bytes);
        const truncated = text.length > 100000 ? text.slice(0, 100000) + "\n\n[... truncated ...]" : text;
        allTextContent += `\n\n--- File: ${fileName} ---\n${truncated}`;
      } else if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
        hasPDFs = true;
        const base64 = btoa(String.fromCharCode(...bytes));
        pdfPartsClaude.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        });
      } else if (fileType?.startsWith("image/")) {
        const base64 = btoa(String.fromCharCode(...bytes));
        imagePartsOpenAI.push({
          type: "image_url",
          image_url: { url: `data:${fileType};base64,${base64}` },
        });
      } else {
        // Try reading as text
        try {
          const text = new TextDecoder().decode(bytes);
          if (text.length > 100 && !text.includes('\x00')) {
            allTextContent += `\n\n--- File: ${fileName} ---\n${text.slice(0, 100000)}`;
          }
        } catch { /* skip unreadable */ }
      }
    }

    const systemPrompt = `You are a CRE document analyst. Extract and analyze commercial real estate documents (leases, LOIs, proposals, abstracts, offer comparisons). Focus on: parties, property address, square footage, rent/SF, TI allowance, free rent, lease term, commencement date, escalations, options, and any notable clauses. When multiple documents are provided, analyze them together and cross-reference data between them. Format your response with clear headers and bullet points.${context ? "\n\nAdditional context:\n" + context : ""}`;

    // Route: PDFs go to Claude (native PDF support), everything else to GPT-4o
    if (hasPDFs && anthropicKey) {
      // Build Claude message with PDF documents + any text
      const contentParts: any[] = [...pdfPartsClaude];
      if (allTextContent) contentParts.push({ type: "text", text: allTextContent });
      contentParts.push({ type: "text", text: question });

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
            model: "claude-sonnet-4-20250514",
            max_tokens: 8192,
            system: systemPrompt,
            messages: [{ role: "user", content: contentParts }],
            stream: true,
          }),
        });
        if (response.status === 429 || response.status === 529) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
          continue;
        }
        break;
      }

      if (!response?.ok) {
        const err = await response?.text();
        console.error("Claude PDF error:", response?.status, err);
        return new Response(JSON.stringify({ error: "Failed to analyze PDF. Please try again." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Convert Claude SSE to OpenAI SSE format
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const sseStream = new ReadableStream({
        async pull(controller) {
          const { done, value } = await reader.read();
          if (done) { controller.enqueue(encoder.encode("data: [DONE]\n\n")); controller.close(); return; }
          for (const line of decoder.decode(value).split("\n").filter(l => l.startsWith("data: "))) {
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const event = JSON.parse(data);
              if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: event.delta.text }, index: 0, finish_reason: null }] })}\n\n`));
              }
              if (event.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch { /* skip */ }
          }
        },
      });

      return new Response(sseStream, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
    }

    // Non-PDF path: use GPT-4o
    if (!openaiKey) throw new Error("OPENAI_API_KEY is not configured");

    const contentParts: any[] = [...imagePartsOpenAI];
    if (allTextContent) contentParts.push({ type: "text", text: allTextContent });
    contentParts.push({ type: "text", text: question });

    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 8192,
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: contentParts.length > 1 ? contentParts : `${allTextContent}\n\n${question}` },
          ],
        }),
      });
      if (response.status === 429) { await new Promise(r => setTimeout(r, (attempt + 1) * 2000)); continue; }
      break;
    }

    if (!response?.ok) {
      const t = await response?.text() || "Unknown error";
      console.error("GPT-4o error:", response?.status, t);
      return new Response(JSON.stringify({ error: "Failed to analyze document." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("parse-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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
    if (!openaiKey) throw new Error("OPENAI_API_KEY is not configured");

    // Build message content from files
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
        const truncated = text.length > 100000 ? text.slice(0, 100000) + "\n\n[... truncated ...]" : text;
        allTextContent += `\n\n--- File: ${fileName} ---\n${truncated}`;
      } else if (fileType?.startsWith("image/")) {
        const base64 = btoa(String.fromCharCode(...bytes));
        contentParts.push({
          type: "image_url",
          image_url: { url: `data:${fileType};base64,${base64}` },
        });
      } else {
        // PDF or other binary — try to read as text
        try {
          const text = new TextDecoder().decode(bytes);
          if (text.length > 100 && !text.includes('\x00')) {
            allTextContent += `\n\n--- File: ${fileName} ---\n${text.slice(0, 100000)}`;
          } else {
            allTextContent += `\n\n--- File: ${fileName} (binary file, ${(bytes.length / 1024).toFixed(1)} KB) ---`;
          }
        } catch {
          allTextContent += `\n\n--- File: ${fileName} (could not read) ---`;
        }
      }
    }

    if (allTextContent) {
      contentParts.push({ type: "text", text: allTextContent });
    }
    contentParts.push({ type: "text", text: question });

    const systemPrompt = `You are a CRE document analyst. Extract and analyze commercial real estate documents (leases, LOIs, proposals, abstracts, offer comparisons). Focus on: parties, property address, square footage, rent/SF, TI allowance, free rent, lease term, commencement date, escalations, options, and any notable clauses. When multiple documents are provided, analyze them together and cross-reference data between them. Format your response with clear headers and bullet points.${context ? "\n\nAdditional context:\n" + context : ""}`;

    // Use GPT-4o — fast, great at following templates, handles long docs well
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
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

      if (response.status === 429) {
        console.warn(`OpenAI rate limited, retry ${attempt + 1}/3...`);
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
      console.error("GPT-4o error:", response?.status, t);
      return new Response(JSON.stringify({ error: "Failed to analyze document. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GPT-4o already streams in OpenAI SSE format — pass through directly
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

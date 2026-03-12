import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY is not configured");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const today = new Date().toISOString().split("T")[0];

    // Check for industry-specific request
    let industry: string | null = null;
    try {
      const body = await req.json();
      industry = body?.industry || null;
    } catch { /* no body or invalid JSON */ }

    // Build prompts based on whether an industry filter is active
    const industryPrompts: Record<string, { system: string; user: string }> = {
      Defense: {
        system: "You are an elite intelligence analyst tracking defense industry news that creates commercial real estate opportunities in the Washington DC metro area. Search defense publications (Defense One, Defense News, Breaking Defense, Military Times), government contracting sites (GovWin, SAM.gov announcements, FedScoop), mainstream business news (Bloomberg, WSJ, Reuters), and CRE publications. Return ONLY factual, sourced news with specific details.",
        user: `Find the most important recent defense and national security news that could drive commercial real estate demand in the DC metro area. Search for ALL of these:

1. DEFENSE SPENDING: New defense authorization/appropriations bills, Pentagon budget changes, supplemental funding, NDAA provisions
2. CONTRACT AWARDS: Major defense contracts awarded to DC-area companies (Lockheed Martin, Northrop Grumman, Raytheon, Booz Allen, Leidos, SAIC, General Dynamics, L3Harris, BAE Systems, ManTech, CACI, Peraton)
3. COMPANY GROWTH: Defense/intel contractors expanding, hiring surges, new program wins, M&A activity, new office openings
4. GOVERNMENT PROGRAMS: New military/intel programs, DARPA initiatives, Space Force growth, cyber command expansion, AI/ML defense programs
5. BASE REALIGNMENT: BRAC-related moves, military base expansions near DC, Pentagon reorganizations
6. CLEARED SPACE: SCIF demand, cleared facility construction, intel community space needs
7. POLICY SHIFTS: Administration defense policy changes, NATO commitments, Indo-Pacific strategy impacts on DC contractors

Focus on how each item creates potential office space demand — new contracts mean headcount growth, which means space needs. Include company names, contract values, employee counts, locations.`
      },
      Healthcare: {
        system: "You are an elite analyst tracking healthcare industry news that creates commercial real estate opportunities in the Washington DC metro area. Search healthcare publications (Modern Healthcare, Fierce Healthcare, STAT News, Healthcare Dive), NIH/HHS announcements, and business news. Return ONLY factual, sourced news with specific details.",
        user: `Find recent healthcare and life sciences news that could drive commercial real estate demand in the DC metro area:

1. FUNDING & GRANTS: NIH funding decisions, HHS grants, biotech venture funding for DC-area companies
2. COMPANY MOVES: Healthcare companies, biotech firms, health IT companies expanding/relocating in DC area
3. POLICY & REGULATION: ACA changes, FDA policy shifts, Medicare/Medicaid changes affecting healthcare organizations headquartered in DC
4. ASSOCIATIONS: Healthcare associations (AMA, AHA, PhRMA, BIO) expanding, relocating, or hosting major events
5. LIFE SCIENCES: Lab space demand, biotech corridor growth, NIH campus developments
6. DIGITAL HEALTH: Health IT companies (telehealth, EHR vendors) growing in DC metro area
7. HOSPITAL SYSTEMS: Major health systems (MedStar, Inova, Johns Hopkins) expanding administrative/office footprint

Include company names, square footages, locations, funding amounts, employee growth numbers.`
      },
      Government: {
        system: "You are an elite analyst tracking federal government and government services news that creates commercial real estate opportunities in the Washington DC metro area. Search government sources (GSA, FedScoop, GovExec, Federal News Network, NextGov), and business news. Return ONLY factual, sourced news with specific details.",
        user: `Find recent federal government news that impacts commercial real estate in DC:

1. GSA ACTIONS: Lease awards, lease expirations, new space requirements, consolidation plans, DOGE space reduction mandates
2. AGENCY MOVES: Federal agencies relocating, expanding, or consolidating offices
3. GOVERNMENT SERVICES: Federal IT contractors, consulting firms winning major task orders
4. RETURN TO OFFICE: Federal RTO mandates, telework policy changes, space utilization data
5. BUDGET: Federal budget impacts on agency space needs, continuing resolutions, government shutdowns
6. CONTRACTING: Major government contract awards that will drive office demand (IT, consulting, professional services)
7. WORKFORCE: Federal hiring freezes or surges, agency reorganizations, new office establishments

Include agency names, addresses, square footages, contract values, employee counts.`
      },
      Lobbying: {
        system: "You are an elite analyst tracking lobbying, public affairs, and political news that creates commercial real estate opportunities in the Washington DC metro area. Search political publications (Politico, The Hill, Roll Call, OpenSecrets, LDA filings), and business news. Return ONLY factual, sourced news with specific details.",
        user: `Find recent lobbying, public affairs, and political news that could drive CRE demand in DC:

1. K STREET MOVES: Lobbying firms expanding, merging, relocating, or opening new offices
2. POLITICAL SHIFTS: New administration policies creating lobbying demand (trade, tech regulation, energy, healthcare)
3. INDUSTRY COALITIONS: New trade associations or coalitions forming in DC, existing ones expanding
4. CAMPAIGN & PAC: Political organizations setting up or expanding DC offices
5. REGULATORY: Major regulatory actions (FTC, SEC, EPA, FCC) that drive companies to increase DC lobbying presence
6. PUBLIC AFFAIRS: PR/communications firms growing, mergers, new DC office openings
7. FOREIGN LOBBYING: FARA registrations, foreign governments/companies expanding DC presence

Include firm names, K Street addresses, revenue figures, new hires, square footage changes.`
      },
      "Nonprofit/Association": {
        system: "You are an elite analyst tracking nonprofit, association, and NGO news that creates commercial real estate opportunities in the Washington DC metro area. Search nonprofit publications (Chronicle of Philanthropy, NonProfit Times, ASAE), association news, and business publications. Return ONLY factual, sourced news with specific details.",
        user: `Find recent nonprofit and association news that could drive CRE demand in DC:

1. ASSOCIATION MOVES: Trade associations, professional societies relocating or expanding in DC (there are 3,000+ associations in DC metro)
2. FUNDING & GRANTS: Major foundation grants, government funding for nonprofits, endowment changes
3. MERGERS & CONSOLIDATIONS: Associations merging, nonprofits consolidating office space
4. LEASE EVENTS: Known association lease expirations, relocations from traditional corridors (K Street, Connecticut Ave, Mass Ave)
5. MEMBERSHIP GROWTH: Associations with growing membership/revenue that may need more space
6. NEW ORGANIZATIONS: New nonprofits, think tanks, or advocacy groups establishing DC presence
7. EVENTS & CONFERENCES: Major association conferences in DC driving temporary/permanent space needs

Include organization names, current addresses, square footages, budgets, membership numbers.`
      },
    };

    let systemPrompt: string;
    let userPrompt: string;

    if (industry && industryPrompts[industry]) {
      const ip = industryPrompts[industry];
      systemPrompt = ip.system;
      userPrompt = ip.user;
    } else {
      systemPrompt = "You are an elite commercial real estate news researcher covering the Washington DC metro area. Search broadly across major CRE publications (Bisnow, CoStar, Commercial Observer, GlobeSt, WTOP, Washington Business Journal, CRE Daily), government/GSA announcements, and mainstream business news (Bloomberg, WSJ, Reuters). Return ONLY factual, sourced news with specific details.";
      userPrompt = `Find the most important and recent Washington DC commercial real estate news. Search across ALL of these categories:

1. MAJOR DEALS: Office leases signed, building sales/acquisitions, land deals
2. TENANT MOVES: Companies relocating to/from/within DC, new HQ announcements, office consolidations
3. GOVERNMENT/GSA: Federal agency space decisions, DOGE-related space cuts, GSA lease actions, return-to-office mandates
4. MARKET TRENDS: Vacancy rate changes, rent trends, sublease availability, conversion projects (office-to-residential)
5. DEVELOPMENT: New construction, renovations, repositioning projects
6. CAPITAL MARKETS: CMBS distress, loan maturities, refinancing, foreclosures
7. COMPANY NEWS: Major employers expanding/contracting in DC (law firms, consulting, tech, nonprofits, lobbying firms)

Focus on the DC metro area including CBD, East End, NoMa, Capitol Hill, Southwest, Georgetown, Tysons, Arlington, Bethesda, Crystal City/National Landing.

Provide as many specific details as possible — company names, exact addresses, square footages, deal terms, asking rents, vacancy percentages. Include the most significant national CRE news that impacts DC.`;
    }

    // Step 1: Use Perplexity to search for real news
    const perplexityResp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        search_recency_filter: "week",
      }),
    });

    if (!perplexityResp.ok) {
      const errText = await perplexityResp.text();
      console.error("Perplexity API error:", perplexityResp.status, errText);
      throw new Error(`Perplexity search failed: ${perplexityResp.status}`);
    }

    const perplexityData = await perplexityResp.json();
    const rawContent = perplexityData.choices?.[0]?.message?.content || "";
    const citations = perplexityData.citations || [];

    console.log("Perplexity returned content length:", rawContent.length, "citations:", citations.length);

    // Step 2: Use Lovable AI to structure the raw search results into news items
    const structureResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a data structuring assistant. Convert raw news content into a JSON array of structured news items. Today's date is ${today}.${industry ? ` These are ${industry} industry news items being analyzed for commercial real estate outreach opportunities.` : ""}

IMPORTANT: Return ONLY a valid JSON array. No markdown, no code blocks, no extra text.

Each item must have:
- id: unique string (${industry ? `"ind-${industry.toLowerCase().replace(/[^a-z]/g, "")}-1"` : '"n1"'}, etc.)
- title: compelling headline (max 80 chars)
- summary: 2-3 sentence description with specific details from the source.${industry ? " Include a brief note on why this creates a CRE opportunity (e.g., 'This contract win likely means 200+ new hires needing office space in Northern Virginia')." : ""}
- source: the actual publication name if mentioned, otherwise "Market Intelligence"
- date: the date mentioned in the article, or today's date, in YYYY-MM-DD format
- category: one of "lease", "sale", "expansion", "vacancy", "market", "contraction"
- url: source URL if available from citations, otherwise null
- companyMentions: array of company/organization names mentioned in this news item
${industry ? `- industryTag: "${industry}"` : ""}

Extract 10-15 distinct news items from the content. Prioritize the most significant and actionable items first. Each should be a separate piece of intelligence — do not combine multiple stories into one item.`,
          },
          {
            role: "user",
            content: `Here is raw ${industry ? `${industry} industry` : "DC CRE market"} news content:\n\n${rawContent}\n\nCitations/Sources:\n${citations.map((c: string, i: number) => `[${i + 1}] ${c}`).join("\n")}\n\nStructure this into a JSON array of news items.`,
          },
        ],
      }),
    });

    if (!structureResp.ok) {
      if (structureResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await structureResp.text();
      console.error("Structure AI error:", structureResp.status, t);
      throw new Error("Failed to structure news");
    }

    const structureData = await structureResp.json();
    const content = structureData.choices?.[0]?.message?.content || "[]";

    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    let newsItems;
    try {
      newsItems = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse structured news:", cleaned);
      return new Response(JSON.stringify({ error: "Failed to parse news data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ news: newsItems, citations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-market-news error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

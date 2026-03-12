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
        system: "You are an elite intelligence analyst covering the defense and national security industry. Search defense publications (Defense One, Defense News, Breaking Defense, Military Times, Jane's), government contracting sites (GovWin, SAM.gov, FedScoop), and mainstream business news (Bloomberg, WSJ, Reuters). Return ONLY factual, sourced news with specific details.",
        user: `Find the most important and recent defense and national security news. Search for ALL of these:

1. DEFENSE SPENDING: New defense authorization/appropriations bills, Pentagon budget changes, supplemental funding, NDAA provisions, major budget debates
2. CONTRACT AWARDS: Major defense contracts awarded — who won, how much, what program (Lockheed Martin, Northrop Grumman, Raytheon, Booz Allen, Leidos, SAIC, General Dynamics, L3Harris, BAE Systems, ManTech, CACI, Peraton, Palantir, Anduril, Shield AI)
3. FUNDING & INVESTMENT: Defense tech startups raising capital, VC funding rounds, private equity deals in defense sector, SPACs, IPOs
4. M&A ACTIVITY: Mergers, acquisitions, divestitures among defense contractors and tech companies
5. GOVERNMENT PROGRAMS: New military/intel programs, DARPA initiatives, Space Force growth, cyber command expansion, AI/ML defense programs, classified program hints
6. GEOPOLITICAL: Major geopolitical events driving defense spending — conflicts, NATO decisions, Indo-Pacific strategy, arms deals, sanctions
7. WORKFORCE & LEADERSHIP: CEO changes, major hires, layoffs, hiring surges at defense companies, Pentagon leadership changes
8. TECHNOLOGY: New weapons systems, autonomous systems, hypersonics, directed energy, space capabilities, cyber tools

Include company names, contract values, funding amounts, deal sizes, and key people involved.`
      },
      Healthcare: {
        system: "You are an elite analyst covering the healthcare and life sciences industry. Search healthcare publications (Modern Healthcare, Fierce Healthcare, STAT News, Healthcare Dive, Endpoints News, BioPharma Dive), NIH/HHS announcements, and business news (Bloomberg, WSJ). Return ONLY factual, sourced news with specific details.",
        user: `Find the most important recent healthcare and life sciences news:

1. FUNDING & INVESTMENT: Biotech/pharma venture funding rounds, IPOs, major NIH grants, HHS funding decisions, Series A/B/C rounds
2. M&A & DEALS: Pharma mergers, acquisitions, licensing deals, partnerships, major drug deals
3. FDA & REGULATORY: Drug approvals, rejections, breakthrough designations, FDA policy changes, clinical trial results
4. POLICY & LEGISLATION: ACA changes, Medicare/Medicaid reform, drug pricing legislation, healthcare bills in Congress
5. COMPANY NEWS: Major healthcare companies expanding, restructuring, layoffs, leadership changes, earnings surprises
6. DIGITAL HEALTH & HEALTH IT: Telehealth companies, EHR vendors, AI in healthcare, digital therapeutics funding
7. HOSPITAL SYSTEMS & PAYERS: Health system mergers, insurance company moves, hospital expansions, financial performance
8. LIFE SCIENCES: Lab space developments, biotech corridor growth, clinical research organizations, contract manufacturers

Include company names, funding amounts, deal values, drug names, and key details.`
      },
      Government: {
        system: "You are an elite analyst covering federal government, policy, and government services news. Search government sources (GSA, FedScoop, GovExec, Federal News Network, NextGov, Government Accountability Office), and mainstream news. Return ONLY factual, sourced news with specific details.",
        user: `Find the most important recent federal government and government services news:

1. BUDGET & SPENDING: Federal budget proposals, continuing resolutions, shutdown risks, agency funding levels, supplemental appropriations
2. POLICY & EXECUTIVE ORDERS: Major executive orders, policy shifts, regulatory changes, agency reorganizations
3. GOVERNMENT CONTRACTING: Major contract awards (IT, consulting, professional services), task orders, GWAC/BPA awards, protest decisions
4. AGENCY NEWS: Federal agency expansions, consolidations, new offices, DOGE efficiency mandates, workforce changes
5. TECHNOLOGY & MODERNIZATION: Federal IT modernization, cloud adoption, cybersecurity mandates, AI executive orders, FedRAMP
6. WORKFORCE: Federal hiring freezes or surges, RTO mandates, telework policy, union negotiations, pay changes
7. GSA & REAL ESTATE: Lease actions, space consolidation, disposal of federal properties, co-working initiatives

Include agency names, contract values, policy details, and company names involved.`
      },
      Lobbying: {
        system: "You are an elite analyst covering lobbying, public affairs, and political influence. Search political publications (Politico, The Hill, Roll Call, OpenSecrets, LDA filings, Axios), and business news. Return ONLY factual, sourced news with specific details.",
        user: `Find the most important recent lobbying, public affairs, and political news:

1. LOBBYING ACTIVITY: Major lobbying campaigns, new registrations, big-spending industries, top lobbying firms by revenue
2. POLITICAL SHIFTS: Administration policy changes creating new lobbying demand (trade, tech regulation, energy, crypto, AI, healthcare)
3. REGULATORY BATTLES: Major regulatory actions (FTC, SEC, EPA, FCC, DOJ) driving corporate lobbying spend
4. FIRM NEWS: Lobbying firm mergers, leadership changes, major new client wins, revenue milestones, new firm launches
5. INDUSTRY COALITIONS: New trade associations or coalitions forming, major advocacy campaigns
6. CAMPAIGN & ELECTIONS: PAC spending, campaign finance news, election impacts on lobbying landscape
7. FOREIGN INFLUENCE: FARA registrations, foreign government lobbying, international trade lobbying

Include firm names, client names, spending amounts, revenue figures, and key policy issues.`
      },
      "Nonprofit/Association": {
        system: "You are an elite analyst covering the nonprofit, association, and NGO sector. Search nonprofit publications (Chronicle of Philanthropy, NonProfit Times, ASAE, Association Forum, Inside Philanthropy), and mainstream business news. Return ONLY factual, sourced news with specific details.",
        user: `Find the most important recent nonprofit, association, and foundation news:

1. MAJOR GRANTS & GIVING: Large foundation grants, mega-donations, corporate giving announcements, endowment performance
2. ORGANIZATION NEWS: Major nonprofits and associations — leadership changes, restructuring, strategic pivots, financial challenges
3. FUNDING & REVENUE: Association membership trends, dues changes, conference revenue, fundraising results
4. MERGERS & CONSOLIDATIONS: Associations merging, nonprofits closing or consolidating
5. POLICY & ADVOCACY: Major advocacy campaigns, nonprofit sector policy (tax reform, charitable deduction changes)
6. NEW ORGANIZATIONS: New think tanks, advocacy groups, foundations launching, especially in DC
7. SECTOR TRENDS: Philanthropic trends, ESG/impact investing, volunteer trends, technology adoption in nonprofits

Include organization names, grant amounts, revenue figures, membership numbers, and key people.`
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
            content: `You are a data structuring assistant. Convert raw news content into a JSON array of structured news items. Today's date is ${today}.${industry ? ` These are ${industry} industry news items — major industry developments, funding, deals, and policy changes.` : ""}

IMPORTANT: Return ONLY a valid JSON array. No markdown, no code blocks, no extra text.

Each item must have:
- id: unique string (${industry ? `"ind-${industry.toLowerCase().replace(/[^a-z]/g, "")}-1"` : '"n1"'}, etc.)
- title: compelling headline (max 80 chars)
- summary: 2-3 sentence description with specific details from the source.${industry ? " Focus on the significance of this news — deal size, funding amount, policy impact, or strategic importance." : ""}
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
      if (structureResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

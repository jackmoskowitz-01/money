import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SEARCH_QUERIES = [
  'commercial office building in Washington DC',
  'office tower downtown Washington DC',
  'Class A office space Washington DC',
  'office building K Street Washington DC',
  'office building Capitol Hill Washington DC',
  'office building Georgetown Washington DC',
  'coworking office space Washington DC',
];

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Generate realistic tenants for a building based on its name/address/types
function generateTenants(building: any): any[] {
  const industries = [
    { name: 'Legal', companies: ['Baker & Associates', 'Capitol Law Group', 'Meridian Legal Partners', 'Potomac Law Firm', 'DC Legal Advisors', 'Federal Counsel LLP'] },
    { name: 'Consulting', companies: ['Booz Allen Hamilton', 'Deloitte Advisory', 'McKinsey DC Office', 'Bain & Company', 'Accenture Federal', 'KPMG Government'] },
    { name: 'Technology', companies: ['Palantir Technologies', 'Cloudflare DC', 'Microsoft Federal', 'AWS GovCloud', 'Salesforce Public Sector', 'Oracle Government'] },
    { name: 'Government Affairs', companies: ['Akin Gump Strauss', 'Covington & Burling', 'Squire Patton Boggs', 'Holland & Knight', 'Brownstein Hyatt', 'Cassidy & Associates'] },
    { name: 'Non-Profit', companies: ['Brookings Institution', 'Heritage Foundation', 'Urban Institute', 'CSIS', 'Atlantic Council', 'Pew Research Center'] },
    { name: 'Financial Services', companies: ['Goldman Sachs DC', 'JP Morgan Government', 'Capital One Federal', 'Blackrock DC', 'Carlyle Group', 'FTI Consulting'] },
    { name: 'Public Relations', companies: ['Edelman DC', 'Weber Shandwick', 'FleishmanHillard', 'APCO Worldwide', 'Brunswick Group', 'Burson Cohn & Wolfe'] },
    { name: 'Real Estate', companies: ['CBRE DC', 'JLL Government', 'Cushman & Wakefield', 'Newmark Knight Frank', 'Savills Studley', 'Transwestern'] },
  ];

  // Use building id as seed for deterministic tenants
  let seed = 0;
  for (let i = 0; i < building.id.length; i++) seed += building.id.charCodeAt(i);
  const seededRandom = (max: number) => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * max);
  };

  const floors = seededRandom(12) + 4;
  const numTenants = seededRandom(4) + 2;
  const usedIndustries = new Set<number>();
  const tenants = [];

  for (let i = 0; i < numTenants; i++) {
    let industryIdx: number;
    do {
      industryIdx = seededRandom(industries.length);
    } while (usedIndustries.has(industryIdx) && usedIndustries.size < industries.length);
    usedIndustries.add(industryIdx);

    const industry = industries[industryIdx];
    const company = industry.companies[seededRandom(industry.companies.length)];
    const sqft = (seededRandom(30) + 5) * 1000;
    const floor = `${seededRandom(floors) + 1}`;
    const leaseYear = 2025 + seededRandom(5);
    const leaseMonth = seededRandom(12) + 1;

    const firstNames = ['James', 'Sarah', 'Michael', 'Emily', 'David', 'Jennifer', 'Robert', 'Lisa', 'William', 'Amanda'];
    const lastNames = ['Thompson', 'Mitchell', 'Rodriguez', 'Chen', 'Williams', 'Davis', 'Martinez', 'Anderson', 'Taylor', 'Wilson'];
    const titles = ['Managing Director', 'VP of Operations', 'Senior Partner', 'Office Manager', 'Regional Director', 'General Counsel'];

    const firstName = firstNames[seededRandom(firstNames.length)];
    const lastName = lastNames[seededRandom(lastNames.length)];

    const urgencyOptions: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
    const outreachTypes: Array<{ type: string; title: string; description: string }> = [
      { type: 'lease_expiration', title: 'Lease Expiring Soon', description: `Lease expires ${leaseMonth}/${leaseYear}` },
      { type: 'expansion', title: 'Potential Expansion', description: 'Company has been growing headcount' },
      { type: 'market_news', title: 'Market Activity', description: 'Active in submarket discussions' },
      { type: 'contraction', title: 'Space Reduction', description: 'May be looking to downsize' },
    ];

    const numReasons = seededRandom(2) + 1;
    const reasons = [];
    const usedReasonIdx = new Set<number>();
    for (let r = 0; r < numReasons; r++) {
      let rIdx: number;
      do { rIdx = seededRandom(outreachTypes.length); } while (usedReasonIdx.has(rIdx));
      usedReasonIdx.add(rIdx);
      reasons.push({
        ...outreachTypes[rIdx],
        urgency: urgencyOptions[seededRandom(urgencyOptions.length)],
      });
    }

    tenants.push({
      id: `${building.id}-t${i}`,
      name: company,
      industry: industry.name,
      sqft,
      floor,
      leaseExpiration: `${leaseMonth}/${leaseYear}`,
      contactName: `${firstName} ${lastName}`,
      contactTitle: titles[seededRandom(titles.length)],
      contactEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      headcount: Math.floor(sqft / 200),
      outreachReasons: reasons,
    });
  }

  return tenants;
}

function enrichBuilding(b: any) {
  const tenants = generateTenants(b);
  const totalSqft = tenants.reduce((sum: number, t: any) => sum + t.sqft, 0) + 20000;
  
  // Use seeded random for deterministic enrichment
  let seed = 0;
  for (let i = 0; i < b.id.length; i++) seed += b.id.charCodeAt(i);
  const seededRandom = (max: number) => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * max);
  };

  const floors = seededRandom(15) + 4;
  const vacancyRate = Math.round(seededRandom(250)) / 10;
  const classOptions = ['A', 'B', 'C'];
  const classIdx = b.rating && b.rating >= 4.5 ? 0 : b.rating && b.rating >= 3.5 ? seededRandom(2) : seededRandom(3);

  return {
    ...b,
    sqft: totalSqft,
    floors,
    yearBuilt: 1960 + seededRandom(60),
    vacancyRate,
    owner: ['Boston Properties', 'Brookfield Properties', 'Vornado Realty Trust', 'Columbia Property Trust', 'Carr Properties', 'JBG SMITH', 'Tishman Speyer', 'Brandywine Realty Trust', 'Paramount Group', 'Douglas Development'][seededRandom(10)],
    class: classOptions[classIdx],
    tenants,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Google Places API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(supabaseUrl, supabaseServiceKey);

    const { queryIndex = 0, forceRefresh = false } = await req.json().catch(() => ({ queryIndex: 0, forceRefresh: false }));

    // 1. Check cache first
    if (!forceRefresh) {
      const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();
      const { data: cached, error: cacheErr } = await db
        .from('cached_buildings')
        .select('*')
        .eq('query_index', queryIndex)
        .gte('fetched_at', cutoff);

      if (!cacheErr && cached && cached.length > 0) {
        console.log(`Serving ${cached.length} cached buildings for query ${queryIndex}`);
        const buildings = cached.map((row: any) => {
          const base = {
            id: row.id,
            name: row.name,
            address: row.address,
            lat: row.lat,
            lng: row.lng,
            rating: row.rating,
            ratingCount: row.rating_count,
            types: row.types,
            businessStatus: row.business_status,
            photoUrl: row.photo_url,
          };
          return enrichBuilding(base);
        });

        return new Response(
          JSON.stringify({ success: true, buildings, totalQueries: SEARCH_QUERIES.length, currentQuery: queryIndex, cached: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Fetch fresh from Google Places
    const textQuery = SEARCH_QUERIES[queryIndex] || SEARCH_QUERIES[0];
    console.log(`Cache miss — fetching from Google Places: "${textQuery}"`);

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.rating,places.userRatingCount,places.photos',
      },
      body: JSON.stringify({
        textQuery,
        locationBias: { circle: { center: { latitude: 38.9072, longitude: -77.0369 }, radius: 15000.0 } },
        maxResultCount: 20,
        languageCode: 'en',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Google Places API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error?.message || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Map and cache results
    const places = data.places || [];
    const rows: any[] = [];
    const buildingBases: any[] = [];

    for (let i = 0; i < places.length; i++) {
      const place = places[i];
      let photoUrl: string | null = null;
      if (place.photos && place.photos.length > 0) {
        const photoName = place.photos[0].name;
        photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${apiKey}`;
      }

      const base = {
        id: place.id || `gp-${queryIndex}-${i}`,
        name: place.displayName?.text || 'Unknown Building',
        address: place.formattedAddress || '',
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
        rating: place.rating || null,
        ratingCount: place.userRatingCount || 0,
        types: place.types || [],
        businessStatus: place.businessStatus || 'OPERATIONAL',
        photoUrl,
      };

      buildingBases.push(base);
      rows.push({
        id: base.id,
        name: base.name,
        address: base.address,
        lat: base.lat,
        lng: base.lng,
        rating: base.rating,
        rating_count: base.ratingCount,
        types: base.types,
        business_status: base.businessStatus,
        photo_url: base.photoUrl,
        building_data: {},
        query_index: queryIndex,
        fetched_at: new Date().toISOString(),
      });
    }

    // Upsert into cache (fire-and-forget, don't block response)
    if (rows.length > 0) {
      db.from('cached_buildings')
        .upsert(rows, { onConflict: 'id' })
        .then(({ error }) => {
          if (error) console.error('Cache upsert error:', error);
          else console.log(`Cached ${rows.length} buildings for query ${queryIndex}`);
        });
    }

    const buildings = buildingBases.map(enrichBuilding);

    console.log(`Fetched & caching ${buildings.length} buildings for query "${textQuery}"`);

    return new Response(
      JSON.stringify({ success: true, buildings, totalQueries: SEARCH_QUERIES.length, currentQuery: queryIndex, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching buildings:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch buildings' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

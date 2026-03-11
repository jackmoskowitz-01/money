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

  const floors = Math.floor(Math.random() * 12) + 4;
  const numTenants = Math.floor(Math.random() * 4) + 2;
  const usedIndustries = new Set<number>();
  const tenants = [];

  for (let i = 0; i < numTenants; i++) {
    let industryIdx: number;
    do {
      industryIdx = Math.floor(Math.random() * industries.length);
    } while (usedIndustries.has(industryIdx) && usedIndustries.size < industries.length);
    usedIndustries.add(industryIdx);

    const industry = industries[industryIdx];
    const company = industry.companies[Math.floor(Math.random() * industry.companies.length)];
    const sqft = (Math.floor(Math.random() * 30) + 5) * 1000;
    const floor = `${Math.floor(Math.random() * floors) + 1}`;
    const leaseYear = 2025 + Math.floor(Math.random() * 5);
    const leaseMonth = Math.floor(Math.random() * 12) + 1;

    const firstNames = ['James', 'Sarah', 'Michael', 'Emily', 'David', 'Jennifer', 'Robert', 'Lisa', 'William', 'Amanda'];
    const lastNames = ['Thompson', 'Mitchell', 'Rodriguez', 'Chen', 'Williams', 'Davis', 'Martinez', 'Anderson', 'Taylor', 'Wilson'];
    const titles = ['Managing Director', 'VP of Operations', 'Senior Partner', 'Office Manager', 'Regional Director', 'General Counsel'];

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    const urgencyOptions: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
    const outreachTypes: Array<{ type: string; title: string; description: string }> = [
      { type: 'lease_expiration', title: 'Lease Expiring Soon', description: `Lease expires ${leaseMonth}/${leaseYear}` },
      { type: 'expansion', title: 'Potential Expansion', description: 'Company has been growing headcount' },
      { type: 'market_news', title: 'Market Activity', description: 'Active in submarket discussions' },
      { type: 'contraction', title: 'Space Reduction', description: 'May be looking to downsize' },
    ];

    const numReasons = Math.floor(Math.random() * 2) + 1;
    const reasons = [];
    const usedReasonIdx = new Set<number>();
    for (let r = 0; r < numReasons; r++) {
      let rIdx: number;
      do { rIdx = Math.floor(Math.random() * outreachTypes.length); } while (usedReasonIdx.has(rIdx));
      usedReasonIdx.add(rIdx);
      reasons.push({
        ...outreachTypes[rIdx],
        urgency: urgencyOptions[Math.floor(Math.random() * urgencyOptions.length)],
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
      contactTitle: titles[Math.floor(Math.random() * titles.length)],
      contactEmail: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      headcount: Math.floor(sqft / 200),
      outreachReasons: reasons,
    });
  }

  return tenants;
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

    const { queryIndex = 0 } = await req.json().catch(() => ({ queryIndex: 0 }));

    const textQuery = SEARCH_QUERIES[queryIndex] || SEARCH_QUERIES[0];
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';

    const body = {
      textQuery,
      locationBias: {
        circle: {
          center: { latitude: 38.9072, longitude: -77.0369 },
          radius: 15000.0,
        },
      },
      maxResultCount: 20,
      languageCode: 'en',
    };

    console.log(`Fetching DC buildings with query: "${textQuery}"`);

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.rating,places.userRatingCount',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Google Places API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error?.message || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const buildings = (data.places || []).map((place: any, index: number) => {
      const b = {
        id: place.id || `gp-${queryIndex}-${index}`,
        name: place.displayName?.text || 'Unknown Building',
        address: place.formattedAddress || '',
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
        rating: place.rating || null,
        ratingCount: place.userRatingCount || 0,
        types: place.types || [],
        businessStatus: place.businessStatus || 'OPERATIONAL',
      };

      const tenants = generateTenants(b);
      const totalSqft = tenants.reduce((sum: number, t: any) => sum + t.sqft, 0) + Math.floor(Math.random() * 50000) + 20000;
      const floors = Math.floor(Math.random() * 15) + 4;
      const vacancyRate = Math.round(Math.random() * 25 * 10) / 10;
      const classOptions = ['A', 'B', 'C'];
      const buildingClass = classOptions[Math.floor(Math.random() * (place.rating && place.rating >= 4.5 ? 1 : place.rating && place.rating >= 3.5 ? 2 : 3))];

      return {
        ...b,
        sqft: totalSqft,
        floors,
        yearBuilt: 1960 + Math.floor(Math.random() * 60),
        vacancyRate,
        owner: ['Boston Properties', 'Brookfield Properties', 'Vornado Realty Trust', 'Columbia Property Trust', 'Carr Properties', 'JBG SMITH', 'Tishman Speyer', 'Brandywine Realty Trust', 'Paramount Group', 'Douglas Development'][Math.floor(Math.random() * 10)],
        class: buildingClass,
        tenants,
      };
    });

    console.log(`Found ${buildings.length} buildings for query "${textQuery}"`);

    return new Response(
      JSON.stringify({
        success: true,
        buildings,
        totalQueries: SEARCH_QUERIES.length,
        currentQuery: queryIndex,
      }),
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

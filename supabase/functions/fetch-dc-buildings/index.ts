const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    const { pageToken } = await req.json().catch(() => ({ pageToken: null }));

    // Use the Places API (New) - Text Search
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
    
    const body: Record<string, unknown> = {
      textQuery: 'office building in Washington DC',
      locationBias: {
        circle: {
          center: { latitude: 38.9072, longitude: -77.0369 },
          radius: 15000.0, // 15km radius covers all of DC
        },
      },
      maxResultCount: 20,
      languageCode: 'en',
    };

    if (pageToken) {
      body.pageToken = pageToken;
    }

    console.log('Fetching DC office buildings...');

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.rating,places.userRatingCount,nextPageToken',
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

    // Transform to our Building format
    const buildings = (data.places || []).map((place: any, index: number) => ({
      id: place.id || `gp-${index}`,
      name: place.displayName?.text || 'Unknown Building',
      address: place.formattedAddress || '',
      lat: place.location?.latitude || 0,
      lng: place.location?.longitude || 0,
      rating: place.rating || null,
      ratingCount: place.userRatingCount || 0,
      types: place.types || [],
      businessStatus: place.businessStatus || 'OPERATIONAL',
    }));

    console.log(`Found ${buildings.length} buildings`);

    return new Response(
      JSON.stringify({
        success: true,
        buildings,
        nextPageToken: data.nextPageToken || null,
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

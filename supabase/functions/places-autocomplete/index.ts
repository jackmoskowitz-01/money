const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { query } = await req.json();
    if (!query || query.length < 2) {
      return new Response(JSON.stringify({ predictions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Google Places API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use Places API (New) - Autocomplete endpoint
    const resp = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        input: query,
        includedPrimaryTypes: ['establishment'],
      }),
    });
    const data = await resp.json();

    if (data.error) {
      console.error('Places API error:', data.error.message);
      return new Response(JSON.stringify({ predictions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const predictions = (data.suggestions || []).slice(0, 5).map((s: any) => {
      const p = s.placePrediction;
      return {
        placeId: p?.placeId || '',
        description: p?.text?.text || '',
        mainText: p?.structuredFormat?.mainText?.text || '',
        secondaryText: p?.structuredFormat?.secondaryText?.text || '',
      };
    });

    return new Response(JSON.stringify({ predictions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('places-autocomplete error:', e);
    return new Response(JSON.stringify({ error: 'Failed to fetch suggestions' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

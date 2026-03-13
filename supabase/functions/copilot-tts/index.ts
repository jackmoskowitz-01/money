import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voiceId } = await req.json();
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("No text provided");
    }

    // Clean markdown from text for better speech
    const cleanText = text
      .replace(/#{1,6}\s/g, "")           // headers
      .replace(/\*\*([^*]+)\*\*/g, "$1")  // bold
      .replace(/\*([^*]+)\*/g, "$1")      // italic
      .replace(/`([^`]+)`/g, "$1")        // inline code
      .replace(/```[\s\S]*?```/g, "")     // code blocks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
      .replace(/[✅⚠️📎📍🗺️]/g, "")     // emojis
      .replace(/\n{2,}/g, ". ")           // double newlines to pauses
      .replace(/\n/g, " ")               // single newlines
      .replace(/\s{2,}/g, " ")           // multiple spaces
      .trim();

    if (cleanText.length === 0) {
      throw new Error("No speakable text after cleanup");
    }

    // Use streaming TTS for lower latency
    const selectedVoice = voiceId || "JBFqnCBsd6RMkjVDRZzb"; // George voice - professional male

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: cleanText.slice(0, 5000), // ElevenLabs limit
          model_id: "eleven_turbo_v2_5",  // Low latency model
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: 1.05, // Slightly faster for conversational feel
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs TTS error:", response.status, errText);
      throw new Error(`TTS failed (${response.status})`);
    }

    // Stream audio back to client
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (e) {
    console.error("copilot-tts error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

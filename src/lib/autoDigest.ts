import { supabase } from '@/integrations/supabase/client';

/**
 * Fire-and-forget: sends an event to the auto-digest edge function
 * which uses AI to extract learnable facts and stores them in copilot_brain.
 * 
 * This runs silently in the background — never blocks UI or shows errors.
 */
export function digestEvent(
  eventType: string,
  eventData: Record<string, any>,
) {
  // Run async, never await — pure background fire-and-forget
  (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auto-digest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            user_id: session.user.id,
            event_type: eventType,
            event_data: eventData,
          }),
        },
      );
    } catch {
      // Silent — never interrupt user flow
    }
  })();
}

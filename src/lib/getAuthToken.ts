import { supabase } from '@/integrations/supabase/client';

/**
 * Get the user's session access token for edge function calls.
 * Falls back to the publishable key if no session exists.
 */
export async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

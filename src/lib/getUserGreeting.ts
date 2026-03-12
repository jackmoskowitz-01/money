import { supabase } from '@/integrations/supabase/client';

let cachedGreeting: string | null = null;

export const getUserGreeting = async (): Promise<string> => {
  if (cachedGreeting !== null) return cachedGreeting;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'Hi';
    const { data } = await supabase
      .from('user_settings')
      .select('email_greeting')
      .eq('user_id', user.id)
      .single();
    cachedGreeting = data?.email_greeting || 'Hi';
    // Clear cache after 5 minutes so setting changes take effect
    setTimeout(() => { cachedGreeting = null; }, 5 * 60 * 1000);
    return cachedGreeting;
  } catch {
    return 'Hi';
  }
};

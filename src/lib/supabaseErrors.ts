import { toast } from 'sonner';
import { logger } from './logger';
import type { PostgrestError } from '@supabase/supabase-js';

export function handleSupabaseError(
  error: PostgrestError | null,
  context?: string
): boolean {
  if (!error) return false;

  const message = context
    ? `${context}: ${error.message}`
    : error.message;

  logger.error('Supabase error:', {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
  toast.error(message);
  return true;
}

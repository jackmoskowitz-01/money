import { useState, useCallback } from 'react';
import { getAuthToken } from '@/lib/getAuthToken';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface UseAskDealflowReturn {
  ask: (question: string, filterType?: string) => Promise<void>;
  answer: string | null;
  sources: { type: string; id: string; similarity: number }[];
  loading: boolean;
  error: string | null;
  reset: () => void;
}

export function useAskDealflow(): UseAskDealflowReturn {
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<{ type: string; id: string; similarity: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (question: string, filterType?: string) => {
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);

    try {
      const token = await getAuthToken();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/rag-ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ question, filterType }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }

      setAnswer(data.answer);
      setSources(data.sources ?? []);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAnswer(null);
    setSources([]);
    setError(null);
    setLoading(false);
  }, []);

  return { ask, answer, sources, loading, error, reset };
}

// ============================================================
// Embed helper — call after saving a deal/contact/activity/scoop
// Fire-and-forget: don't block UI on embedding
// ============================================================

export async function embedAfterSave(
  sourceType: 'deal' | 'contact' | 'activity' | 'scoop' | 'document',
  sourceId: string,
  record: Record<string, unknown>
): Promise<void> {
  try {
    const token = await getAuthToken();
    await fetch(`${SUPABASE_URL}/functions/v1/rag-embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ sourceType, sourceId, record }),
    });
  } catch {
    console.warn('Background embedding failed — will retry on next save');
  }
}

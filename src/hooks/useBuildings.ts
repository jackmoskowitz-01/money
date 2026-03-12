import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildings as mockBuildings, type Building } from '@/data/mockData';

const LS_KEY = 'dealflow_live_buildings';
const LS_TS_KEY = 'dealflow_live_buildings_ts';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const loadCached = (): Building[] => {
  try {
    const ts = localStorage.getItem(LS_TS_KEY);
    if (ts && Date.now() - Number(ts) < CACHE_TTL) {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch {}
  return [];
};

/**
 * Returns all buildings merged from mock data + live edge function data.
 * Deduplicates by name (case-insensitive). Live data overwrites mock.
 */
export const useBuildings = () => {
  const [liveBuildings, setLiveBuildings] = useState<Building[]>(loadCached);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  const fetchLive = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);

    try {
      const all: Building[] = [];
      const seenNames = new Set<string>();

      for (let i = 0; i < 7; i++) {
        const { data, error } = await supabase.functions.invoke('fetch-dc-buildings', {
          body: { queryIndex: i },
        });
        if (error || !data?.success) continue;
        for (const b of (data.buildings || [])) {
          const key = b.name?.toLowerCase();
          if (key && !seenNames.has(key) && b.lat && b.lng) {
            seenNames.add(key);
            all.push(b as Building);
          }
        }
      }

      setLiveBuildings(all);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(all));
        localStorage.setItem(LS_TS_KEY, String(Date.now()));
      } catch {}
    } catch (err) {
      console.error('Failed to fetch live buildings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (liveBuildings.length === 0) fetchLive();
  }, [fetchLive, liveBuildings.length]);

  // Merge: live buildings take priority, then mock
  const buildings = (() => {
    const map = new Map<string, Building>();
    // Mock first
    mockBuildings.forEach(b => map.set(b.name.toLowerCase(), b));
    // Live overwrites
    liveBuildings.forEach(b => map.set(b.name.toLowerCase(), b));
    return Array.from(map.values());
  })();

  return { buildings, loading, refetch: fetchLive };
};

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { brokers as baseBrokers, type Broker } from '@/data/activityData';

/**
 * Returns the brokers list with br1 replaced by the signed-in user's identity.
 */
export const useBrokers = (): Broker[] => {
  const { profile } = useAuth();

  return useMemo(() => {
    if (!profile) return baseBrokers;

    return baseBrokers.map(b => {
      if (b.id !== 'br1') return b;
      return {
        ...b,
        name: profile.full_name || b.name,
        initials: profile.avatar_initials || b.initials,
      };
    });
  }, [profile]);
};

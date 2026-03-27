import { useAuth } from '@/contexts/AuthContext';

/**
 * Returns the current user's organization_id for use in inserts.
 * RLS handles reads, but inserts need the org_id explicitly.
 */
export function useOrganizationId(): string | null {
  const { organization } = useAuth();
  return organization?.organization_id ?? null;
}

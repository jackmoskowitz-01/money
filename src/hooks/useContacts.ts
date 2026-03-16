import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getContactsAsync, type CompanyContact } from '@/data/companyContacts';

/**
 * Hook to load contacts for an entity with realtime updates.
 * Returns contacts array and a refresh function.
 */
export function useContacts(entityId: string | undefined) {
  const [contacts, setContacts] = useState<CompanyContact[]>([]);

  const reload = useCallback(async () => {
    if (!entityId) { setContacts([]); return; }
    const data = await getContactsAsync(entityId);
    setContacts(data);
  }, [entityId]);

  useEffect(() => {
    reload();
    if (!entityId) return;
    const channel = supabase
      .channel(`contacts-hook-${entityId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'company_contacts',
        filter: `entity_id=eq.${entityId}`,
      }, () => { reload(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [entityId, reload]);

  return { contacts, reload };
}

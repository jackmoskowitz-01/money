// Company contacts — Supabase-backed multi-contact support per tenant

import { supabase } from '@/integrations/supabase/client';

export type CompanyContact = {
  id: string;
  name: string;
  email: string;
  title: string;
  mobilePhone?: string;
  directPhone?: string;
  addedAt: string;
};

type DbContact = {
  id: string;
  entity_id: string;
  name: string;
  email: string;
  title: string;
  mobile_phone: string | null;
  direct_phone: string | null;
  created_at: string;
};

const toContact = (row: DbContact): CompanyContact => ({
  id: row.id,
  name: row.name,
  email: row.email,
  title: row.title,
  mobilePhone: row.mobile_phone ?? undefined,
  directPhone: row.direct_phone ?? undefined,
  addedAt: row.created_at,
});

/** Get contacts for a specific tenant (by tenantId or prospectId) — async */
export const getContactsAsync = async (entityId: string): Promise<CompanyContact[]> => {
  const { data, error } = await supabase
    .from('company_contacts')
    .select('*')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getContacts error:', error); return []; }
  return (data as DbContact[]).map(toContact);
};

// In-memory cache for sync access — populated by subscriptions and async loads
const contactsCache = new Map<string, CompanyContact[]>();

/** Synchronous access using cache — returns cached contacts or empty if not yet loaded */
export const getContacts = (entityId: string): CompanyContact[] => {
  return contactsCache.get(entityId) || [];
};

/** Pre-load contacts into cache for sync access */
export const preloadContacts = async (entityId: string): Promise<CompanyContact[]> => {
  const contacts = await getContactsAsync(entityId);
  contactsCache.set(entityId, contacts);
  return contacts;
};

/** Subscribe to realtime changes for an entity and keep cache fresh */
export const subscribeContacts = (entityId: string) => {
  // Initial load
  preloadContacts(entityId);
  
  const channel = supabase
    .channel(`contacts-cache-${entityId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'company_contacts',
      filter: `entity_id=eq.${entityId}`,
    }, () => { preloadContacts(entityId); })
    .subscribe();
  
  return () => { supabase.removeChannel(channel); };
};

/** Add a contact to an entity */
export const addContact = async (entityId: string, contact: Omit<CompanyContact, 'id' | 'addedAt'>): Promise<CompanyContact> => {
  const { data, error } = await supabase
    .from('company_contacts')
    .insert({
      entity_id: entityId,
      name: contact.name,
      email: contact.email,
      title: contact.title,
      mobile_phone: contact.mobilePhone ?? null,
      direct_phone: contact.directPhone ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toContact(data as DbContact);
};

/** Remove a contact */
export const removeContact = async (_entityId: string, contactId: string) => {
  const { error } = await supabase.from('company_contacts').delete().eq('id', contactId);
  if (error) throw error;
};

/** Update a contact */
export const updateContact = async (_entityId: string, contactId: string, updates: Partial<Omit<CompanyContact, 'id' | 'addedAt'>>) => {
  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.email !== undefined) updateData.email = updates.email;
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.mobilePhone !== undefined) updateData.mobile_phone = updates.mobilePhone;
  if (updates.directPhone !== undefined) updateData.direct_phone = updates.directPhone;

  const { error } = await supabase.from('company_contacts').update(updateData).eq('id', contactId);
  if (error) throw error;
};

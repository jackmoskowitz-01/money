import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationId } from '@/hooks/useOrganization';

export type ProspectListEntry = {
  id: string;
  tenantId: string;
  buildingId: string;
  tenantName: string;
  addedAt: string;
};

export type ProspectList = {
  id: string;
  name: string;
  industry?: string;
  createdAt: string;
  entries: ProspectListEntry[];
};

export function useProspectLists() {
  const { user } = useAuth();
  const [lists, setLists] = useState<ProspectList[]>([]);
  const [loading, setLoading] = useState(true);
  const orgId = useOrganizationId();

  const fetchLists = useCallback(async () => {
    if (!user) { setLists([]); setLoading(false); return; }

    const { data: listRows } = await supabase
      .from('prospect_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!listRows || listRows.length === 0) {
      setLists([]);
      setLoading(false);
      return;
    }

    const listIds = listRows.map(l => l.id);
    const { data: itemRows } = await supabase
      .from('prospect_list_items')
      .select('*')
      .in('list_id', listIds);

    const itemsByList = new Map<string, ProspectListEntry[]>();
    (itemRows || []).forEach((item: any) => {
      const arr = itemsByList.get(item.list_id) || [];
      arr.push({
        id: item.id,
        tenantId: item.tenant_id,
        buildingId: item.building_id,
        tenantName: item.tenant_name,
        addedAt: item.added_at,
      });
      itemsByList.set(item.list_id, arr);
    });

    setLists(listRows.map((l: any) => ({
      id: l.id,
      name: l.name,
      industry: l.industry || undefined,
      createdAt: l.created_at,
      entries: itemsByList.get(l.id) || [],
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const createList = useCallback(async (name: string, industry?: string): Promise<ProspectList | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('prospect_lists')
      .insert({ user_id: user.id, name, industry: industry || '', ...(orgId ? { organization_id: orgId } : {}) })
      .select()
      .single();
    if (error || !data) return null;
    const newList: ProspectList = { id: data.id, name: data.name, industry: data.industry || undefined, createdAt: data.created_at, entries: [] };
    setLists(prev => [newList, ...prev]);
    return newList;
  }, [user]);

  const addProspects = useCallback(async (
    listId: string,
    prospects: { tenantId: string; buildingId: string; tenantName: string }[]
  ): Promise<number> => {
    const existing = lists.find(l => l.id === listId);
    if (!existing) return 0;

    const newItems = prospects.filter(p => !existing.entries.some(e => e.tenantId === p.tenantId));
    if (newItems.length === 0) return 0;

    const rows = newItems.map(p => ({
      list_id: listId,
      tenant_id: p.tenantId,
      building_id: p.buildingId,
      tenant_name: p.tenantName,
    }));

    const { data, error } = await supabase
      .from('prospect_list_items')
      .insert(rows)
      .select();

    if (error || !data) return 0;

    const addedEntries: ProspectListEntry[] = data.map((d: any) => ({
      id: d.id,
      tenantId: d.tenant_id,
      buildingId: d.building_id,
      tenantName: d.tenant_name,
      addedAt: d.added_at,
    }));

    setLists(prev => prev.map(l =>
      l.id === listId ? { ...l, entries: [...l.entries, ...addedEntries] } : l
    ));
    return addedEntries.length;
  }, [lists]);

  const removeProspect = useCallback(async (listId: string, tenantId: string) => {
    const list = lists.find(l => l.id === listId);
    const item = list?.entries.find(e => e.tenantId === tenantId);
    if (!item) return;

    await supabase.from('prospect_list_items').delete().eq('id', item.id);
    setLists(prev => prev.map(l =>
      l.id === listId ? { ...l, entries: l.entries.filter(e => e.tenantId !== tenantId) } : l
    ));
  }, [lists]);

  const deleteList = useCallback(async (listId: string) => {
    await supabase.from('prospect_lists').delete().eq('id', listId);
    setLists(prev => prev.filter(l => l.id !== listId));
  }, []);

  return { lists, loading, createList, addProspects, removeProspect, deleteList, refresh: fetchLists };
}

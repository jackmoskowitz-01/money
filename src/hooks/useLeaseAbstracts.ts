import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getAuthToken } from '@/lib/getAuthToken';
import { embedAfterSave } from '@/hooks/useAskDealflow';

export interface RentScheduleEntry {
  year: number;
  annual_rent_psf: number;
  monthly_rent: number;
}

export interface OptionEntry {
  type: string;
  notice_period: string;
  terms: string;
}

export interface LeaseAbstract {
  id: string;
  user_id: string;
  prospect_id: string | null;
  prospect_name: string;
  building_name: string;
  building_address: string;
  tenant_name: string;
  landlord_name: string;
  premises_sf: number | null;
  floor_suite: string;
  lease_type: string;
  commencement_date: string | null;
  expiration_date: string | null;
  term_months: number | null;
  base_rent_psf: number | null;
  rent_schedule: RentScheduleEntry[];
  escalation_type: string;
  escalation_rate: number | null;
  free_rent_months: number;
  ti_allowance_psf: number | null;
  parking_spaces: number | null;
  parking_rate: number | null;
  renewal_options: OptionEntry[];
  expansion_options: OptionEntry[];
  termination_options: OptionEntry[];
  operating_expenses: string;
  security_deposit: string;
  assignment_subletting: string;
  notable_clauses: string;
  source_filename: string;
  raw_abstract: string;
  completeness_score: number;
  created_at: string;
  updated_at: string;
}

const PARSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-lease-abstract`;

export function useLeaseAbstracts() {
  const { user } = useAuth();
  const [abstracts, setAbstracts] = useState<LeaseAbstract[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAbstracts = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('lease_abstracts' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAbstracts(data as unknown as LeaseAbstract[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAbstracts();
  }, [fetchAbstracts]);

  const saveAbstract = useCallback(async (abstract: Partial<LeaseAbstract>) => {
    if (!user) return null;
    const row = {
      ...abstract,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('lease_abstracts' as any)
      .insert(row as any)
      .select()
      .single();

    if (error) {
      console.error('Failed to save lease abstract:', error);
      toast.error('Failed to save lease abstract');
      return null;
    }

    await fetchAbstracts();
    // Fire-and-forget: embed for RAG
    if (data) {
      embedAfterSave('lease_abstract', (data as any).id, data as Record<string, unknown>);
    }
    return data as unknown as LeaseAbstract;
  }, [user, fetchAbstracts]);

  const updateAbstract = useCallback(async (id: string, updates: Partial<LeaseAbstract>) => {
    const { error } = await supabase
      .from('lease_abstracts' as any)
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) {
      console.error('Failed to update lease abstract:', error);
      toast.error('Failed to update lease abstract');
      return false;
    }

    await fetchAbstracts();
    return true;
  }, [fetchAbstracts]);

  const deleteAbstract = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('lease_abstracts' as any)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete lease abstract:', error);
      toast.error('Failed to delete lease abstract');
      return false;
    }

    setAbstracts(prev => prev.filter(a => a.id !== id));
    return true;
  }, []);

  const parseAndSave = useCallback(async (
    abstractText: string,
    options?: {
      prospectName?: string;
      buildingName?: string;
      prospectId?: string;
      sourceFilename?: string;
    }
  ): Promise<LeaseAbstract | null> => {
    if (!user) return null;

    try {
      const resp = await fetch(PARSE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          abstractText,
          prospectName: options?.prospectName || '',
          buildingName: options?.buildingName || '',
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to parse lease abstract');
      }

      const parsed = await resp.json();

      const record = await saveAbstract({
        prospect_id: options?.prospectId || null,
        prospect_name: parsed.prospect_name || options?.prospectName || '',
        building_name: parsed.building_name || options?.buildingName || '',
        building_address: parsed.building_address || '',
        tenant_name: parsed.tenant_name || '',
        landlord_name: parsed.landlord_name || '',
        premises_sf: parsed.premises_sf || null,
        floor_suite: parsed.floor_suite || '',
        lease_type: parsed.lease_type || '',
        commencement_date: parsed.commencement_date || null,
        expiration_date: parsed.expiration_date || null,
        term_months: parsed.term_months || null,
        base_rent_psf: parsed.base_rent_psf || null,
        rent_schedule: parsed.rent_schedule || [],
        escalation_type: parsed.escalation_type || '',
        escalation_rate: parsed.escalation_rate || null,
        free_rent_months: parsed.free_rent_months || 0,
        ti_allowance_psf: parsed.ti_allowance_psf || null,
        parking_spaces: parsed.parking_spaces || null,
        parking_rate: parsed.parking_rate || null,
        renewal_options: parsed.renewal_options || [],
        expansion_options: parsed.expansion_options || [],
        termination_options: parsed.termination_options || [],
        operating_expenses: parsed.operating_expenses || '',
        security_deposit: parsed.security_deposit || '',
        assignment_subletting: parsed.assignment_subletting || '',
        notable_clauses: parsed.notable_clauses || '',
        source_filename: options?.sourceFilename || '',
        raw_abstract: abstractText,
        completeness_score: parsed.completeness_score || 0,
      });

      return record;
    } catch (err) {
      console.error('parseAndSave error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to parse lease abstract');
      return null;
    }
  }, [user, saveAbstract]);

  return { abstracts, loading, saveAbstract, updateAbstract, deleteAbstract, parseAndSave, refetch: fetchAbstracts };
}

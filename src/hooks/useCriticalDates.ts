import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CriticalDate {
  id: string;
  prospect_id: string | null;
  prospect_name: string;
  building_name: string;
  date_type: string;
  date_value: string;
  description: string;
  remind_days_before: number;
  acknowledged: boolean;
  source: string;
  lease_abstract_id: string | null;
  created_at: string;
}

const DATE_TYPE_LABELS: Record<string, string> = {
  lease_commencement: 'Lease Commencement',
  lease_expiration: 'Lease Expiration',
  rent_commencement: 'Rent Commencement',
  early_termination: 'Early Termination Option',
  renewal_option: 'Renewal Option Deadline',
  rent_escalation: 'Rent Escalation',
  free_rent_expiry: 'Free Rent Expires',
  ti_deadline: 'TI Completion Deadline',
  notice_period: 'Notice Required',
  cam_reconciliation: 'CAM Reconciliation',
  security_deposit_return: 'Security Deposit Return',
  insurance_renewal: 'Insurance Renewal',
  estoppel_deadline: 'Estoppel Deadline',
  snda_deadline: 'SNDA Deadline',
  construction_milestone: 'Construction Milestone',
  option_exercise: 'Option Exercise Deadline',
  audit_right: 'Audit Right Deadline',
  other: 'Other',
};

export function getDateTypeLabel(type: string) {
  return DATE_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function getDaysUntil(dateStr: string) {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

export function getUrgency(daysUntil: number, remindDaysBefore: number): 'critical' | 'warning' | 'upcoming' | 'safe' | 'past' {
  if (daysUntil < 0) return 'past';
  if (daysUntil <= 14) return 'critical';
  if (daysUntil <= remindDaysBefore) return 'warning';
  if (daysUntil <= remindDaysBefore * 2) return 'upcoming';
  return 'safe';
}

export function useCriticalDates() {
  const { user } = useAuth();
  const [dates, setDates] = useState<CriticalDate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDates = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('critical_dates')
      .select('*')
      .eq('user_id', user.id)
      .order('date_value', { ascending: true });

    if (!error && data) {
      setDates(data as CriticalDate[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDates();
  }, [fetchDates]);

  const addDates = useCallback(async (newDates: Omit<CriticalDate, 'id' | 'created_at' | 'acknowledged'>[]) => {
    if (!user) return false;
    const rows = newDates.map(d => ({
      ...d,
      user_id: user.id,
      acknowledged: false,
    }));

    const { error } = await supabase
      .from('critical_dates')
      .insert(rows);

    if (!error) {
      await fetchDates();
      return true;
    }
    return false;
  }, [user, fetchDates]);

  const acknowledge = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('critical_dates')
      .update({ acknowledged: true })
      .eq('id', id);

    if (!error) {
      setDates(prev => prev.map(d => d.id === id ? { ...d, acknowledged: true } : d));
    }
  }, []);

  const deleteDate = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('critical_dates')
      .delete()
      .eq('id', id);

    if (!error) {
      setDates(prev => prev.filter(d => d.id !== id));
    }
  }, []);

  // Get dates that are within their reminder window and not acknowledged
  const alerts = dates.filter(d => {
    if (d.acknowledged) return false;
    const days = getDaysUntil(d.date_value);
    return days <= d.remind_days_before && days >= -7; // Include up to 7 days past
  });

  return { dates, loading, alerts, addDates, acknowledge, deleteDate, refetch: fetchDates };
}

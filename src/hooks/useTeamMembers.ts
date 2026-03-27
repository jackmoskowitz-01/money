
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizationId } from '@/hooks/useOrganization';

export type TeamMember = {
  id: string;
  fullName: string;
  email: string;
  avatarInitials: string;
};

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const orgId = useOrganizationId();

  useEffect(() => {
    const fetch = async () => {
      if (orgId) {
        // Fetch team members from the same organization
        const { data, error } = await supabase
          .from('organization_members')
          .select('user_id, profiles(id, full_name, email, avatar_initials)')
          .eq('organization_id', orgId)
          .order('joined_at');

        if (!error && data) {
          setMembers(data.map((m: any) => ({
            id: m.profiles?.id || m.user_id,
            fullName: m.profiles?.full_name || m.profiles?.email || 'Unknown',
            email: m.profiles?.email || '',
            avatarInitials: m.profiles?.avatar_initials || 'AN',
          })));
        }
      } else {
        // Fallback: show all profiles (backwards compatible)
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_initials')
          .order('full_name');

        if (!error && data) {
          setMembers(data.map(p => ({
            id: p.id,
            fullName: p.full_name || p.email || 'Unknown',
            email: p.email,
            avatarInitials: p.avatar_initials || 'AN',
          })));
        }
      }
      setLoading(false);
    };
    fetch();
  }, [orgId]);

  return { members, loading };
}

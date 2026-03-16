
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TeamMember = {
  id: string;
  fullName: string;
  email: string;
  avatarInitials: string;
};

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
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
      setLoading(false);
    };
    fetch();
  }, []);

  return { members, loading };
}

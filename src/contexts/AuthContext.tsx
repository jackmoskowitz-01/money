import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type UserProfile = {
  full_name: string;
  email: string;
  avatar_initials: string;
  is_super_admin: boolean;
};

export type OrgMembership = {
  organization_id: string;
  organization_name: string;
  role: 'owner' | 'admin' | 'member';
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  organization: OrgMembership | null;
  loading: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  organization: null,
  loading: true,
  isSuperAdmin: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<OrgMembership | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, email, avatar_initials, is_super_admin')
      .eq('id', userId)
      .single();
    if (data) {
      setProfile({
        full_name: data.full_name,
        email: data.email,
        avatar_initials: data.avatar_initials,
        is_super_admin: data.is_super_admin ?? false,
      });
    }
  };

  const fetchOrganization = async (userId: string) => {
    const { data } = await supabase
      .from('organization_members')
      .select('organization_id, role, organizations(name)')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (data) {
      const orgName = (data as any).organizations?.name ?? '';
      setOrganization({
        organization_id: data.organization_id,
        organization_name: orgName,
        role: data.role as OrgMembership['role'],
      });
    } else {
      setOrganization(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] state change:', event);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
          fetchOrganization(session.user.id);
        }, 0);
      } else {
        setProfile(null);
        setOrganization(null);
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isSuperAdmin = profile?.is_super_admin ?? false;

  return (
    <AuthContext.Provider value={{ user, session, profile, organization, loading, isSuperAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

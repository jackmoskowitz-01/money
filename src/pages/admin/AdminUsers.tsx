import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  avatar_initials: string;
  is_super_admin: boolean;
  created_at: string;
  org_name: string | null;
  org_role: string | null;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    // Get all profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_initials, is_super_admin, created_at')
      .order('created_at', { ascending: false });

    if (error || !profiles) {
      toast.error('Failed to load users');
      return;
    }

    // Get org memberships for all users
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('user_id, role, organizations(name)');

    const memberMap = new Map<string, { org_name: string; role: string }>();
    (memberships || []).forEach((m: any) => {
      memberMap.set(m.user_id, {
        org_name: m.organizations?.name ?? '',
        role: m.role,
      });
    });

    setUsers(profiles.map(p => {
      const membership = memberMap.get(p.id);
      return {
        ...p,
        is_super_admin: p.is_super_admin ?? false,
        org_name: membership?.org_name ?? null,
        org_role: membership?.role ?? null,
      };
    }));
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleSuperAdmin = async (userId: string, currentValue: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_super_admin: !currentValue })
      .eq('id', userId);

    if (error) {
      toast.error('Failed to update admin status');
      return;
    }

    toast.success(currentValue ? 'Admin access removed' : 'Admin access granted');
    fetchUsers();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">All registered users across the platform.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Admin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">No users found</TableCell>
                </TableRow>
              ) : (
                users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {u.avatar_initials}
                        </div>
                        <span className="text-sm font-medium">{u.full_name || 'Unnamed'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-sm">
                      {u.org_name ? (
                        <Badge variant="outline">{u.org_name}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {u.org_role ? (
                        <Badge variant="secondary" className="text-xs">{u.org_role}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 ${u.is_super_admin ? 'text-destructive' : 'text-muted-foreground'}`}
                        onClick={() => toggleSuperAdmin(u.id, u.is_super_admin)}
                        title={u.is_super_admin ? 'Remove admin access' : 'Grant admin access'}
                      >
                        {u.is_super_admin ? <Shield className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

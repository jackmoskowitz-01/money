import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Trash2, Brain, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAuthToken } from '@/lib/getAuthToken';

type Organization = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  member_count: number;
};

type OrgMember = {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile: { full_name: string; email: string } | null;
};

export default function AdminOrganizations() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [backfilling, setBackfilling] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<'owner' | 'admin' | 'member'>('member');

  const fetchOrgs = useCallback(async () => {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load organizations');
      return;
    }

    // Get member counts
    const orgsWithCounts: Organization[] = [];
    for (const org of data || []) {
      const { count } = await supabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', org.id);

      orgsWithCounts.push({
        ...org,
        member_count: count ?? 0,
      });
    }

    setOrgs(orgsWithCounts);
    setLoading(false);
  }, []);

  const fetchMembers = useCallback(async (orgId: string) => {
    const { data } = await supabase
      .from('organization_members')
      .select('id, user_id, role, joined_at, profiles(full_name, email)')
      .eq('organization_id', orgId)
      .order('joined_at', { ascending: true });

    if (data) {
      setMembers(data.map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        joined_at: m.joined_at,
        profile: m.profiles,
      })));
    }
  }, []);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  useEffect(() => {
    if (selectedOrg) fetchMembers(selectedOrg);
  }, [selectedOrg, fetchMembers]);

  const createOrg = async () => {
    if (!newName.trim()) return;
    const slug = newSlug.trim() || newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const { error } = await supabase.from('organizations').insert({ name: newName.trim(), slug });
    if (error) {
      if (error.code === '23505') toast.error('An organization with that slug already exists');
      else toast.error('Failed to create organization');
      return;
    }

    toast.success('Organization created');
    setNewName('');
    setNewSlug('');
    setCreateOpen(false);
    fetchOrgs();
  };

  const deleteOrg = async (orgId: string) => {
    if (!confirm('Delete this organization and all its data? This cannot be undone.')) return;

    const { error } = await supabase.from('organizations').delete().eq('id', orgId);
    if (error) {
      toast.error('Failed to delete organization');
      return;
    }

    toast.success('Organization deleted');
    if (selectedOrg === orgId) setSelectedOrg(null);
    fetchOrgs();
  };

  const addMember = async () => {
    if (!selectedOrg || !addMemberEmail.trim()) return;

    // Find user by email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', addMemberEmail.trim())
      .single();

    if (!profile) {
      toast.error('No user found with that email');
      return;
    }

    const { error } = await supabase.from('organization_members').insert({
      organization_id: selectedOrg,
      user_id: profile.id,
      role: addMemberRole,
    });

    if (error) {
      if (error.code === '23505') toast.error('User is already a member');
      else toast.error('Failed to add member');
      return;
    }

    toast.success('Member added');
    setAddMemberEmail('');
    fetchMembers(selectedOrg);
    fetchOrgs();
  };

  const removeMember = async (membershipId: string) => {
    if (!selectedOrg) return;
    const { error } = await supabase.from('organization_members').delete().eq('id', membershipId);
    if (error) {
      toast.error('Failed to remove member');
      return;
    }
    toast.success('Member removed');
    fetchMembers(selectedOrg);
    fetchOrgs();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-sm text-muted-foreground">Create and manage teams.</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={newName}
                  onChange={e => {
                    setNewName(e.target.value);
                    setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                  }}
                  placeholder="Acme Brokerage"
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={newSlug}
                  onChange={e => setNewSlug(e.target.value)}
                  placeholder="acme-brokerage"
                />
                <p className="text-xs text-muted-foreground mt-1">URL-friendly identifier. Auto-generated from name.</p>
              </div>
              <Button onClick={createOrg} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Org list */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">All Organizations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No organizations yet. Create one to get started.</p>
            ) : (
              orgs.map(org => (
                <div
                  key={org.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedOrg === org.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-accent'
                  }`}
                  onClick={() => setSelectedOrg(org.id)}
                >
                  <div>
                    <p className="text-sm font-medium">{org.name}</p>
                    <p className="text-xs text-muted-foreground">{org.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {org.member_count}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary hover:text-primary"
                      title="Backfill RAG embeddings"
                      disabled={backfilling === org.id}
                      onClick={async e => {
                        e.stopPropagation();
                        setBackfilling(org.id);
                        try {
                          const token = await getAuthToken();
                          const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-backfill`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ organizationId: org.id }),
                          });
                          const data = await resp.json();
                          if (resp.ok) {
                            toast.success(`Embedded ${data.total_embedded} records for ${org.name}`);
                          } else {
                            toast.error(data.error || 'Backfill failed');
                          }
                        } catch { toast.error('Backfill failed'); }
                        setBackfilling(null);
                      }}
                    >
                      {backfilling === org.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={e => { e.stopPropagation(); deleteOrg(org.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Members panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">
              {selectedOrg ? `Members — ${orgs.find(o => o.id === selectedOrg)?.name}` : 'Select an organization'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedOrg ? (
              <p className="text-sm text-muted-foreground">Click an organization to manage its members.</p>
            ) : (
              <div className="space-y-4">
                {/* Add member */}
                <div className="flex gap-2">
                  <Input
                    value={addMemberEmail}
                    onChange={e => setAddMemberEmail(e.target.value)}
                    placeholder="User email address"
                    className="flex-1"
                    onKeyDown={e => e.key === 'Enter' && addMember()}
                  />
                  <select
                    value={addMemberRole}
                    onChange={e => setAddMemberRole(e.target.value as any)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                  <Button onClick={addMember} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>

                {/* Members table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No members yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      members.map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="font-medium text-sm">
                            {m.profile?.full_name || 'Unknown'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {m.profile?.email || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={m.role === 'owner' ? 'default' : 'secondary'} className="text-xs">
                              {m.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(m.joined_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeMember(m.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

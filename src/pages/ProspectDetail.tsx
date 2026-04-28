import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Globe, MapPin, Building2, Plus, Send, Loader2, FileText, Trash2, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import CompanyContacts from '@/components/CompanyContacts';
import ActivityLog from '@/components/ActivityLog';

type Prospect = {
  id: string;
  company_name: string;
  website_url: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

type ProspectNote = {
  id: string;
  content: string;
  author_name: string;
  created_at: string;
};

const ProspectDetail = () => {
  const { prospectId } = useParams();
  const { profile } = useAuth();
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<ProspectNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ company_name: '', website_url: '', address: '' });

  useEffect(() => {
    if (!prospectId) return;
    setLoading(true);

    // Fetch prospect
    supabase
      .from('prospects')
      .select('*')
      .eq('id', prospectId)
      .single()
      .then(({ data, error }) => {
        if (data) {
          setProspect(data as Prospect);
          setEditForm({
            company_name: data.company_name || '',
            website_url: data.website_url || '',
            address: data.address || '',
          });
        }
        setLoading(false);
      });

    // Fetch notes for this prospect
    supabase
      .from('building_notes')
      .select('id, content, author_name, created_at')
      .eq('building_id', prospectId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setNotes(data || []));
  }, [prospectId]);

  const addNote = useCallback(async () => {
    if (!newNote.trim() || !prospectId) return;
    const { data, error } = await supabase
      .from('building_notes')
      .insert({
        building_id: prospectId,
        content: newNote.trim(),
        author_name: profile?.full_name || 'Unknown',
      })
      .select('id, content, author_name, created_at')
      .single();
    if (error) { toast.error('Failed to save note'); return; }
    if (data) setNotes(prev => [data, ...prev]);
    setNewNote('');
  }, [newNote, prospectId, profile]);

  const saveEdit = useCallback(async () => {
    if (!prospectId || !editForm.company_name.trim()) return;
    const { error } = await supabase
      .from('prospects')
      .update({
        company_name: editForm.company_name.trim(),
        website_url: editForm.website_url.trim() || null,
        address: editForm.address.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', prospectId);
    if (error) { toast.error('Failed to update'); return; }
    setProspect(prev => prev ? { ...prev, ...editForm } : prev);
    setEditing(false);
    toast.success('Prospect updated');
  }, [prospectId, editForm]);

  const deleteProspect = useCallback(async () => {
    if (!prospectId || !confirm('Delete this prospect?')) return;
    await supabase.from('prospects').delete().eq('id', prospectId);
    toast.success('Prospect deleted');
    window.history.back();
  }, [prospectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="p-6">
        <Link to="/prospect-table" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Prospects
        </Link>
        <p className="text-muted-foreground">Prospect not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link to="/prospect-table" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Prospects
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          {editing ? (
            <div className="space-y-2">
              <Input
                value={editForm.company_name}
                onChange={(e) => setEditForm(f => ({ ...f, company_name: e.target.value }))}
                className="text-2xl font-bold h-10"
                autoFocus
              />
              <div className="flex gap-2">
                <Input
                  value={editForm.website_url}
                  onChange={(e) => setEditForm(f => ({ ...f, website_url: e.target.value }))}
                  placeholder="Website URL"
                  className="h-8 text-sm"
                />
                <Input
                  value={editForm.address}
                  onChange={(e) => setEditForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Address"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} className="text-xs">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="text-xs">Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{prospect.company_name}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                {prospect.website_url && (
                  <a
                    href={prospect.website_url.startsWith('http') ? prospect.website_url : `https://${prospect.website_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {prospect.website_url.replace(/^https?:\/\//, '')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {prospect.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {prospect.address}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="text-xs">
              Edit
            </Button>
            <Button size="sm" variant="outline" onClick={deleteProspect} className="text-xs text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info card */}
          <Card className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant="outline" className="mt-1">{prospect.status}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Added</p>
                <p className="text-sm font-medium mt-1">{new Date(prospect.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm font-medium mt-1">{notes.length}</p>
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Notes
            </h3>
            <div className="flex gap-2 mb-4">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                className="text-sm min-h-[60px]"
                onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) addNote(); }}
              />
            </div>
            <Button size="sm" onClick={addNote} disabled={!newNote.trim()} className="text-xs mb-4">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Note
            </Button>

            {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg bg-secondary/40 p-3 border border-border/40">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                      <span className="text-xs text-primary/80 font-medium">{note.author_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.created_at).toLocaleDateString()} {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Activity */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Activity</h3>
            <ActivityLog tenantId={prospectId || ''} buildingId="" />
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contacts */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Contacts</h3>
            <CompanyContacts entityId={prospectId || ''} />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProspectDetail;

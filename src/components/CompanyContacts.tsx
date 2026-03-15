import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, User, Mail, Phone, X, ChevronDown, Search, Loader2, Pencil, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  getContactsAsync, addContact, removeContact, updateContact,
  type CompanyContact,
} from '@/data/companyContacts';

interface Props {
  entityId: string;
  companyName?: string;
  primaryContact?: {
    name: string;
    title: string;
    email: string;
  };
  onContactsChange?: () => void;
}

const CompanyContacts = ({ entityId, companyName, primaryContact, onContactsChange }: Props) => {
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', title: '', mobilePhone: '', directPhone: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [zoomInfoLoading, setZoomInfoLoading] = useState(false);
  const [zoomInfoUrl, setZoomInfoUrl] = useState('');
  const [showZoomInfoInput, setShowZoomInfoInput] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', title: '', mobilePhone: '', directPhone: '' });

  const loadContacts = useCallback(async () => {
    const data = await getContactsAsync(entityId);
    setContacts(data);
  }, [entityId]);

  useEffect(() => {
    loadContacts();
    const channel = supabase
      .channel(`contacts-${entityId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_contacts', filter: `entity_id=eq.${entityId}` }, () => {
        loadContacts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadContacts, entityId]);

  const validate = (f: typeof form) => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Name is required';
    else if (f.name.trim().length > 100) e.name = 'Max 100 characters';
    if (!f.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = 'Invalid email';
    if (!f.title.trim()) e.title = 'Title is required';
    else if (f.title.trim().length > 100) e.title = 'Max 100 characters';
    if (f.mobilePhone && f.mobilePhone.length > 30) e.mobilePhone = 'Too long';
    if (f.directPhone && f.directPhone.length > 30) e.directPhone = 'Too long';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = async () => {
    if (!validate(form)) return;
    try {
      const contact = await addContact(entityId, {
        name: form.name.trim(),
        email: form.email.trim(),
        title: form.title.trim(),
        mobilePhone: form.mobilePhone.trim() || undefined,
        directPhone: form.directPhone.trim() || undefined,
      });
      setContacts(prev => [...prev, contact]);
      setForm({ name: '', email: '', title: '', mobilePhone: '', directPhone: '' });
      setErrors({});
      setShowForm(false);
      toast.success(`${contact.name} added as contact`);
      onContactsChange?.();
    } catch (err) {
      toast.error('Failed to add contact');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeContact(entityId, id);
      setContacts(contacts.filter(c => c.id !== id));
      toast.success('Contact removed');
      onContactsChange?.();
    } catch {
      toast.error('Failed to remove contact');
    }
  };

  const startEdit = (contact: CompanyContact) => {
    setEditingId(contact.id);
    setEditForm({
      name: contact.name,
      email: contact.email,
      title: contact.title,
      mobilePhone: contact.mobilePhone || '',
      directPhone: contact.directPhone || '',
    });
    setErrors({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!validate(editForm)) return;
    try {
      await updateContact(entityId, editingId, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        title: editForm.title.trim(),
        mobilePhone: editForm.mobilePhone.trim() || undefined,
        directPhone: editForm.directPhone.trim() || undefined,
      });
      setContacts(prev => prev.map(c => c.id === editingId ? {
        ...c,
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        title: editForm.title.trim(),
        mobilePhone: editForm.mobilePhone.trim() || undefined,
        directPhone: editForm.directPhone.trim() || undefined,
      } : c));
      setEditingId(null);
      setErrors({});
      toast.success('Contact updated');
      onContactsChange?.();
    } catch {
      toast.error('Failed to update contact');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setErrors({});
  };

  const handleZoomInfoImport = async () => {
    if (!zoomInfoUrl.trim()) return;
    const urls = zoomInfoUrl.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) {
      toast.error('Paste valid ZoomInfo profile URL(s)');
      return;
    }
    setZoomInfoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('apify-zoominfo-enrich', {
        body: {
          companyName: companyName || 'Unknown',
          entityId,
          importContacts: true,
          peopleProfileUrls: urls,
          skipCompanyScrape: true,
        },
      });
      if (error) throw error;
      const count = data?.peopleImportCount || 0;
      if (count > 0) {
        toast.success(`Imported ${count} contact(s) from ZoomInfo`);
        loadContacts();
        onContactsChange?.();
      } else {
        toast.error('No contacts could be imported');
      }
      setZoomInfoUrl('');
      setShowZoomInfoInput(false);
    } catch (err) {
      console.error('ZoomInfo import failed:', err);
      toast.error('ZoomInfo import failed');
    } finally {
      setZoomInfoLoading(false);
    }
  };

  const totalContacts = (primaryContact ? 1 : 0) + contacts.length;

  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-secondary/30 px-3 py-2 text-left transition-colors hover:bg-secondary/50 group">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Contacts</span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary">
            {totalContacts}
          </Badge>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2 space-y-2">
        {primaryContact && (
          <div className="flex items-center gap-3 rounded-md border border-border bg-secondary/20 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-foreground">{primaryContact.name}</p>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">Primary</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">{primaryContact.title}</p>
              <p className="text-[10px] text-muted-foreground">{primaryContact.email}</p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {contacts.map(contact => (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-md border border-border bg-secondary/20 p-3"
            >
              {editingId === contact.id ? (
                /* ── Inline Edit Mode ── */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">Edit Contact</p>
                    <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div>
                    <Input placeholder="Full name *" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
                    {errors.name && <p className="text-[10px] text-destructive mt-0.5">{errors.name}</p>}
                  </div>
                  <div>
                    <Input placeholder="Email *" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
                    {errors.email && <p className="text-[10px] text-destructive mt-0.5">{errors.email}</p>}
                  </div>
                  <div>
                    <Input placeholder="Title *" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
                    {errors.title && <p className="text-[10px] text-destructive mt-0.5">{errors.title}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Input placeholder="Mobile phone" value={editForm.mobilePhone} onChange={e => setEditForm({ ...editForm, mobilePhone: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
                      {errors.mobilePhone && <p className="text-[10px] text-destructive mt-0.5">{errors.mobilePhone}</p>}
                    </div>
                    <div>
                      <Input placeholder="Direct phone" value={editForm.directPhone} onChange={e => setEditForm({ ...editForm, directPhone: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
                      {errors.directPhone && <p className="text-[10px] text-destructive mt-0.5">{errors.directPhone}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit} className="text-xs h-7 gap-1">
                      <Check className="h-3 w-3" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} className="text-xs h-7">Cancel</Button>
                  </div>
                </div>
              ) : (
                /* ── Display Mode ── */
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{contact.name}</p>
                    <p className="text-[10px] text-muted-foreground">{contact.title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Mail className="h-2.5 w-2.5" /> {contact.email}
                      </span>
                      {contact.mobilePhone && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Phone className="h-2.5 w-2.5" /> {contact.mobilePhone}
                        </span>
                      )}
                      {contact.directPhone && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Phone className="h-2.5 w-2.5" /> {contact.directPhone} (direct)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(contact)}
                      className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-primary/10 hover:text-primary"
                      title="Edit contact"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemove(contact.id)}
                      className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                      title="Remove contact"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="border-primary/30 bg-card p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">New Contact</p>
                  <button onClick={() => { setShowForm(false); setErrors({}); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div>
                  <Input placeholder="Full name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
                  {errors.name && <p className="text-[10px] text-destructive mt-0.5">{errors.name}</p>}
                </div>
                <div>
                  <Input placeholder="Email *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
                  {errors.email && <p className="text-[10px] text-destructive mt-0.5">{errors.email}</p>}
                </div>
                <div>
                  <Input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
                  {errors.title && <p className="text-[10px] text-destructive mt-0.5">{errors.title}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input placeholder="Mobile phone" value={form.mobilePhone} onChange={e => setForm({ ...form, mobilePhone: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
                    {errors.mobilePhone && <p className="text-[10px] text-destructive mt-0.5">{errors.mobilePhone}</p>}
                  </div>
                  <div>
                    <Input placeholder="Direct phone" value={form.directPhone} onChange={e => setForm({ ...form, directPhone: e.target.value })} className="border-border bg-secondary/50 text-xs h-8" />
                    {errors.directPhone && <p className="text-[10px] text-destructive mt-0.5">{errors.directPhone}</p>}
                  </div>
                </div>
                <Button size="sm" onClick={handleAdd} className="w-full text-xs h-8">Add Contact</Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {!showForm && !showZoomInfoInput && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              <Plus className="h-3 w-3" /> Add Contact
            </button>
            <button
              onClick={() => setShowZoomInfoInput(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              <Search className="h-3 w-3" /> Import from ZoomInfo
            </button>
          </div>
        )}

        <AnimatePresence>
          {showZoomInfoInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="border-primary/30 bg-card p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Import from ZoomInfo</p>
                  <button onClick={() => { setShowZoomInfoInput(false); setZoomInfoUrl(''); }} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">Paste ZoomInfo people profile URL(s), one per line</p>
                <textarea
                  value={zoomInfoUrl}
                  onChange={e => setZoomInfoUrl(e.target.value)}
                  placeholder="https://www.zoominfo.com/p/john-smith/123456789"
                  rows={3}
                  className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
                <Button
                  size="sm"
                  onClick={handleZoomInfoImport}
                  disabled={zoomInfoLoading || !zoomInfoUrl.trim()}
                  className="w-full text-xs h-8 gap-1.5"
                >
                  {zoomInfoLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  {zoomInfoLoading ? 'Importing...' : 'Import Contacts'}
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default CompanyContacts;

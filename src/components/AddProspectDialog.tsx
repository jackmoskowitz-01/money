import { useState } from 'react';
import { Plus, Building2, Globe, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function AddProspectDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ company_name: '', website_url: '', address: '' });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!form.company_name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('prospects')
      .insert({
        company_name: form.company_name.trim(),
        website_url: form.website_url.trim() || null,
        address: form.address.trim() || null,
      })
      .select('id')
      .single();

    setSaving(false);
    if (error) {
      toast.error('Failed to add prospect');
      return;
    }
    toast.success(`${form.company_name} added to prospects`);
    setForm({ company_name: '', website_url: '', address: '' });
    setOpen(false);
    navigate('/prospect-table');
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="h-7 gap-1.5 text-xs"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Prospect
      </Button>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
        onClick={() => setOpen(false)}
      />
      <div className="fixed left-1/2 top-24 z-50 w-full max-w-md -translate-x-1/2 px-4 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
        <div className="rounded-xl border bg-card shadow-2xl p-5">
          <h3 className="text-base font-semibold mb-4">Add New Prospect</h3>

          <div className="space-y-3">
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Company name *"
                value={form.company_name}
                onChange={(e) => setForm(f => ({ ...f, company_name: e.target.value }))}
                className="pl-10 h-9 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOpen(false);
                  if (e.key === 'Enter' && form.company_name.trim()) handleSubmit();
                }}
              />
            </div>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Website URL"
                value={form.website_url}
                onChange={(e) => setForm(f => ({ ...f, website_url: e.target.value }))}
                className="pl-10 h-9 text-sm"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Address"
                value={form.address}
                onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!form.company_name.trim() || saving}
              className="text-xs gap-1.5"
            >
              {saving ? 'Adding...' : 'Add Prospect'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

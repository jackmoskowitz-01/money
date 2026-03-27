import { useState } from 'react';
import { Plus, Building2, User, Mail, Phone, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePipeline } from '@/hooks/usePipeline';

export function AddProspectDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', sqft: '' });
  const [saving, setSaving] = useState(false);
  const { addProspect } = usePipeline();

  const handleSubmit = async () => {
    if (!form.company.trim()) return;
    setSaving(true);
    const success = await addProspect(form);
    setSaving(false);
    if (success) {
      setForm({ name: '', company: '', email: '', phone: '', sqft: '' });
      setOpen(false);
    }
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
                value={form.company}
                onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))}
                className="pl-10 h-9 text-sm"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
              />
            </div>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Contact name"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className="pl-10 h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  className="pl-10 h-9 text-sm"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="pl-10 h-9 text-sm"
                />
              </div>
            </div>
            <div className="relative">
              <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="SF requirement (e.g. 15000)"
                type="number"
                value={form.sqft}
                onChange={(e) => setForm(f => ({ ...f, sqft: e.target.value }))}
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
              disabled={!form.company.trim() || saving}
              className="text-xs gap-1.5"
            >
              {saving ? 'Adding...' : 'Add to Pipeline'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

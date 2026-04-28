import { useState, useMemo } from 'react';
import { Plus, Building2, Globe, Hash, Layers, Ruler, Briefcase, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { buildings as mockBuildings } from '@/data/mockData';
import { costarBuildings } from '@/data/costarBuildings';

export function AddProspectDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    website_url: '',
    building_id: '',
    building_search: '',
    suite: '',
    floor: '',
    sqft: '',
    industry: '',
  });
  const [saving, setSaving] = useState(false);
  const [showBuildingList, setShowBuildingList] = useState(false);
  const navigate = useNavigate();

  // All buildings from every source (same as map view)
  const allBuildings = useMemo(() => {
    const seen = new Set<string>();
    const result: typeof mockBuildings = [];
    for (const b of [...mockBuildings, ...costarBuildings]) {
      const key = b.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(b);
      }
    }
    return result;
  }, []);

  const filteredBuildings = useMemo(() => {
    const q = form.building_search.toLowerCase().replace(/[,.\s]+/g, ' ').trim();
    if (!q) return allBuildings;
    const words = q.split(' ').filter(Boolean);
    return allBuildings.filter(b => {
      const haystack = `${b.name} ${b.address}`.toLowerCase();
      return words.every(w => haystack.includes(w));
    });
  }, [form.building_search, allBuildings]);

  const selectedBuilding = allBuildings.find(b => b.id === form.building_id);

  const handleSubmit = async () => {
    if (!form.company_name.trim() || !form.building_id) return;
    setSaving(true);

    // Save to prospects table
    const { data: prospect, error: prospectError } = await supabase
      .from('prospects')
      .insert({
        company_name: form.company_name.trim(),
        website_url: form.website_url.trim() || null,
        address: selectedBuilding?.address || null,
      })
      .select('id')
      .single();

    if (prospectError) {
      toast.error('Failed to add prospect');
      setSaving(false);
      return;
    }

    // Save to stacking_plans so it shows up in the building on map
    const { error: stackingError } = await supabase
      .from('stacking_plans')
      .insert({
        tenant_name: form.company_name.trim(),
        building_id: form.building_id,
        suite: form.suite.trim() || null,
        floor: form.floor.trim() || '1',
        sqft: form.sqft ? parseInt(form.sqft) : null,
        industry: form.industry.trim() || null,
        website_url: form.website_url.trim() || null,
        prospect_id: prospect?.id || null,
      });

    if (stackingError) {
      console.error('Stacking plan insert error:', stackingError);
    }

    setSaving(false);
    toast.success(`${form.company_name} added to ${selectedBuilding?.name || 'building'}`);
    setForm({ company_name: '', website_url: '', building_id: '', building_search: '', suite: '', floor: '', sqft: '', industry: '' });
    setOpen(false);
    navigate(`/prospect/${prospect?.id}`);
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm" className="h-7 gap-1.5 text-xs">
        <Plus className="h-3.5 w-3.5" />
        Add Prospect
      </Button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0" onClick={() => setOpen(false)} />
      <div className="fixed left-1/2 top-16 z-50 w-full max-w-md -translate-x-1/2 px-4 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
        <div className="rounded-xl border bg-card shadow-2xl p-5 max-h-[80vh] overflow-y-auto">
          <h3 className="text-base font-semibold mb-4">Add New Prospect</h3>

          <div className="space-y-3">
            {/* Company name */}
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Company name *"
                value={form.company_name}
                onChange={(e) => setForm(f => ({ ...f, company_name: e.target.value }))}
                className="pl-10 h-9 text-sm"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
              />
            </div>

            {/* Website */}
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Website URL"
                value={form.website_url}
                onChange={(e) => setForm(f => ({ ...f, website_url: e.target.value }))}
                className="pl-10 h-9 text-sm"
              />
            </div>

            {/* Building selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Building *</label>
              {selectedBuilding ? (
                <div className="flex items-center justify-between rounded-md border bg-secondary/30 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{selectedBuilding.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedBuilding.address}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => setForm(f => ({ ...f, building_id: '', building_search: '' }))}>
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type a building address..."
                    value={form.building_search}
                    onChange={(e) => { setForm(f => ({ ...f, building_search: e.target.value })); setShowBuildingList(true); }}
                    onFocus={() => setShowBuildingList(true)}
                    onBlur={() => setTimeout(() => setShowBuildingList(false), 200)}
                    className="pl-10 h-9 text-sm"
                  />
                  {showBuildingList && filteredBuildings.length > 0 && (
                    <div className="absolute top-10 left-0 right-0 z-10 max-h-56 overflow-y-auto rounded-md border bg-popover shadow-lg">
                      {filteredBuildings.map((b) => (
                        <button
                          key={b.id}
                          className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/30 last:border-0"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setForm(f => ({ ...f, building_id: b.id, building_search: '' }));
                            setShowBuildingList(false);
                          }}
                        >
                          <p className="text-sm font-medium">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.address} · Class {b.class} · {b.sqft.toLocaleString()} SF</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Suite, Floor, SF, Industry — show once building is selected */}
            {selectedBuilding && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Suite #"
                      value={form.suite}
                      onChange={(e) => setForm(f => ({ ...f, suite: e.target.value }))}
                      className="pl-10 h-9 text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Floor"
                      value={form.floor}
                      onChange={(e) => setForm(f => ({ ...f, floor: e.target.value }))}
                      className="pl-10 h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="SF requirement"
                      type="number"
                      value={form.sqft}
                      onChange={(e) => setForm(f => ({ ...f, sqft: e.target.value }))}
                      className="pl-10 h-9 text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Industry"
                      value={form.industry}
                      onChange={(e) => setForm(f => ({ ...f, industry: e.target.value }))}
                      className="pl-10 h-9 text-sm"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!form.company_name.trim() || !form.building_id || saving}
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

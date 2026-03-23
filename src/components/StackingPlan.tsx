import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, X, UserPlus, Upload, Download, Loader2, Pencil, Check } from 'lucide-react';
import { type Building, type Tenant } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { digestEvent } from '@/lib/autoDigest';
import { getAuthToken } from '@/lib/getAuthToken';

type StackingPlanProps = {
  building: Building;
  onTenantsChange?: (tenants: Tenant[]) => void;
};

type DbTenant = {
  id: string;
  building_id: string;
  tenant_name: string;
  industry: string;
  sqft: number;
  floor: string;
  lease_expiration: string;
  notes: string;
  source: string;
};

type FloorEntry = {
  floor: number;
  tenants: { name: string; sqft: number; leaseExpiration: string; urgency: string; isDb?: boolean }[];
};

const PARSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-stacking-plan`;

const StackingPlan = ({ building, onTenantsChange }: StackingPlanProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [dbTenants, setDbTenants] = useState<DbTenant[]>([]);
  const [newTenant, setNewTenant] = useState({ name: '', industry: '', sqft: '', floor: '', leaseExpiration: '' });
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);

  // Load from database
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('stacking_plans')
        .select('*')
        .eq('building_id', building.id)
        .order('floor', { ascending: false });

      if (data) setDbTenants(data as unknown as DbTenant[]);
    };
    load();

    // Realtime updates
    const channel = supabase
      .channel(`stacking-${building.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stacking_plans', filter: `building_id=eq.${building.id}` }, () => {
        load();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [building.id]);

  const allTenants = useMemo(() => {
    const dbAsTenants: Tenant[] = dbTenants.map(dt => ({
      id: dt.id,
      name: dt.tenant_name,
      industry: dt.industry || 'Unknown',
      sqft: dt.sqft || 0,
      floor: dt.floor || '1',
      leaseExpiration: dt.lease_expiration || 'N/A',
      contactName: '',
      contactTitle: '',
      contactEmail: '',
      headcount: 0,
      outreachReasons: [],
    }));
    return [...building.tenants, ...dbAsTenants];
  }, [building.tenants, dbTenants]);

  const floorData = useMemo(() => {
    const floors: FloorEntry[] = [];
    const maxFloor = Math.max(building.floors, ...allTenants.map(t => {
      if (t.floor.includes('-')) return Number(t.floor.split('-')[1]) || 1;
      return Number(t.floor) || 1;
    }));

    for (let f = maxFloor; f >= 1; f--) {
      const matchingTenants = allTenants.filter(t => {
        const floorStr = t.floor;
        if (floorStr.includes('-')) {
          const [start, end] = floorStr.split('-').map(Number);
          return f >= start && f <= end;
        }
        return Number(floorStr) === f;
      });

      const tenantEntries = matchingTenants.map(t => {
        const floorSpan = t.floor.includes('-')
          ? Number(t.floor.split('-')[1]) - Number(t.floor.split('-')[0]) + 1
          : 1;
        const highUrgency = t.outreachReasons?.some(r => r.urgency === 'high');
        const medUrgency = t.outreachReasons?.some(r => r.urgency === 'medium');
        const isDb = dbTenants.some(dt => dt.id === t.id);
        return {
          name: t.name,
          sqft: Math.round(t.sqft / floorSpan),
          leaseExpiration: t.leaseExpiration,
          urgency: highUrgency ? 'high' : medUrgency ? 'medium' : 'low',
          isDb,
        };
      });

      floors.push({ floor: f, tenants: tenantEntries });
    }

    return floors;
  }, [allTenants, building.floors, dbTenants]);

  const getUrgencyColor = (urgency: string, isDb?: boolean) => {
    if (isDb) return 'bg-accent/15 border-accent/30';
    switch (urgency) {
      case 'high': return 'bg-destructive/15 border-destructive/30';
      case 'medium': return 'bg-primary/15 border-primary/30';
      default: return 'bg-success/15 border-success/30';
    }
  };

  const handleAddTenant = async () => {
    if (!newTenant.name.trim()) return;
    const row = {
      building_id: building.id,
      tenant_name: newTenant.name.trim(),
      industry: newTenant.industry.trim(),
      sqft: Number(newTenant.sqft) || 0,
      floor: newTenant.floor.trim() || '1',
      lease_expiration: newTenant.leaseExpiration.trim() || 'N/A',
      notes: '',
      source: 'manual',
    };
    const { data, error } = await supabase.from('stacking_plans').insert(row).select('*').single();
    if (error) {
      toast.error('Failed to add tenant');
      return;
    }
    if (data) setDbTenants(prev => [...prev, data as unknown as DbTenant]);
    setNewTenant({ name: '', industry: '', sqft: '', floor: '', leaseExpiration: '' });
    setShowAddForm(false);
    onTenantsChange?.(allTenants);

    // Feed to Brain
    digestEvent('stacking_plan_updated', {
      action: 'tenant_added',
      building_name: building.name || building.address,
      tenant_name: row.tenant_name,
      industry: row.industry,
      sqft: row.sqft,
      floor: row.floor,
      lease_expiration: row.lease_expiration,
    });
  };

  // Inline edit for DB tenants
  const [editingTenant, setEditingTenant] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<DbTenant>>({});

  const startEdit = (dt: DbTenant) => {
    setEditingTenant(dt.id);
    setEditValues({ tenant_name: dt.tenant_name, industry: dt.industry, sqft: dt.sqft, floor: dt.floor, lease_expiration: dt.lease_expiration });
  };

  const saveEdit = async (id: string) => {
    const { error } = await supabase.from('stacking_plans').update({
      tenant_name: editValues.tenant_name,
      industry: editValues.industry,
      sqft: Number(editValues.sqft) || 0,
      floor: editValues.floor,
      lease_expiration: editValues.lease_expiration,
    }).eq('id', id);
    if (error) {
      toast.error('Failed to update tenant');
      return;
    }
    setDbTenants(prev => prev.map(t => t.id === id ? { ...t, ...editValues, sqft: Number(editValues.sqft) || 0 } as DbTenant : t));
    setEditingTenant(null);
    toast.success('Tenant updated');

    digestEvent('stacking_plan_updated', {
      action: 'tenant_updated',
      building_name: building.name || building.address,
      tenant_name: editValues.tenant_name,
      industry: editValues.industry,
      sqft: editValues.sqft,
      floor: editValues.floor,
      lease_expiration: editValues.lease_expiration,
    });
  };

  const handleRemoveDb = async (id: string) => {
    const { error } = await supabase.from('stacking_plans').delete().eq('id', id);
    if (!error) setDbTenants(prev => prev.filter(t => t.id !== id));
  };

  // Upload stacking plan document
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('buildingName', building.name || building.address);

      const resp = await fetch(PARSE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
        },
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to parse document');
      }

      const { tenants } = await resp.json();
      if (!tenants || tenants.length === 0) {
        toast.info('No tenants found in document');
        return;
      }

      // Insert parsed tenants into database
      const rows = tenants.map((t: any) => ({
        building_id: building.id,
        tenant_name: t.tenant_name || t.name || 'Unknown',
        industry: t.industry || '',
        sqft: Number(t.sqft) || 0,
        floor: String(t.floor || '1'),
        lease_expiration: t.lease_expiration || t.leaseExpiration || 'N/A',
        notes: t.notes || '',
        source: 'upload',
      }));

      const { data, error } = await supabase.from('stacking_plans').insert(rows).select('*');
      if (error) throw error;
      if (data) setDbTenants(prev => [...prev, ...(data as unknown as DbTenant[])]);
      toast.success(`📋 ${tenants.length} tenants imported from ${file.name}`);

      // Feed to Brain
      digestEvent('stacking_plan_updated', {
        action: 'bulk_import',
        building_name: building.name || building.address,
        tenant_count: tenants.length,
        tenants_summary: tenants.slice(0, 5).map((t: any) => `${t.tenant_name || t.name} (${t.sqft || '?'} SF, Fl ${t.floor || '?'})`).join(', '),
        source: file.name,
      });
    } catch (err: any) {
      console.error('Upload parse error:', err);
      toast.error(err.message || 'Failed to parse stacking plan');
    } finally {
      setUploading(false);
    }
  };

  // Export stacking plan as CSV
  const handleExportCSV = useCallback(() => {
    const headers = ['Floor', 'Tenant', 'Industry', 'Sq Ft', 'Lease Expiration'];
    const rows = allTenants.map(t => [t.floor, t.name, t.industry, t.sqft, t.leaseExpiration]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${building.name || building.address}_Stacking_Plan.csv`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Stacking plan exported as CSV');
  }, [allTenants, building]);

  // Export as styled HTML/image for presentations
  const handleExportImage = useCallback(async () => {
    setExporting(true);
    try {
      // Build HTML table for the stacking plan
      const bName = building.name || building.address;
      let html = `<html><head><style>
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 24px; }
        h2 { color: #7c3aed; margin-bottom: 4px; }
        h3 { color: #a78bfa; font-weight: 400; margin-top: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #7c3aed; color: white; text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
        td { padding: 6px 12px; border-bottom: 1px solid #2a2a4a; font-size: 12px; }
        tr:nth-child(even) { background: #16162a; }
        .vacant { color: #666; font-style: italic; }
        .footer { margin-top: 16px; font-size: 10px; color: #666; }
      </style></head><body>`;
      html += `<h2>${bName}</h2>`;
      html += `<h3>${building.sqft.toLocaleString()} SF · Class ${building.class} · ${building.vacancyRate}% Vacant</h3>`;
      html += `<table><tr><th>Floor</th><th>Tenant</th><th>Industry</th><th>Sq Ft</th><th>Lease Exp</th></tr>`;

      for (const floor of floorData) {
        if (floor.tenants.length === 0) {
          html += `<tr><td>${floor.floor}</td><td class="vacant" colspan="4">Vacant</td></tr>`;
        } else {
          for (const t of floor.tenants) {
            html += `<tr><td>${floor.floor}</td><td>${t.name}</td><td></td><td>${t.sqft > 0 ? t.sqft.toLocaleString() : '—'}</td><td>${t.leaseExpiration}</td></tr>`;
          }
        }
      }
      html += `</table>`;
      html += `<p class="footer">Generated ${new Date().toLocaleDateString()} · DealFlow</p>`;
      html += `</body></html>`;

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bName}_Stacking_Plan.html`.replace(/[^a-zA-Z0-9_.-]/g, '_');
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Stacking plan exported for presentation');
    } finally {
      setExporting(false);
    }
  }, [building, floorData]);

  const visibleFloors = expanded ? floorData : floorData.slice(0, 8);
  const hasMore = floorData.length > 8;

  return (
    <div className="w-full" ref={stackRef}>
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1 text-sm font-semibold text-foreground"
        >
          Stacking Plan
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex items-center gap-1">
          {/* Export dropdown */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2 gap-1"
            onClick={handleExportCSV}
            title="Export as CSV"
          >
            <Download className="h-3 w-3" />
            CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2 gap-1"
            onClick={handleExportImage}
            disabled={exporting}
            title="Export for presentation"
          >
            {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Deck
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2 gap-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Upload stacking plan document"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt"
            onChange={handleUpload}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] px-2 gap-1"
            onClick={() => setShowAddForm(prev => !prev)}
          >
            <UserPlus className="h-3 w-3" />
            Add
          </Button>
        </div>
      </div>

      {/* Upload status */}
      {uploading && (
        <div className="mb-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-[11px] text-primary font-medium">Parsing stacking plan with AI...</span>
        </div>
      )}

      {/* Add Tenant Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-2 rounded-md border border-accent/30 bg-accent/5 p-2 space-y-1.5">
              <div className="flex gap-1.5">
                <Input
                  placeholder="Tenant name *"
                  value={newTenant.name}
                  onChange={e => setNewTenant(p => ({ ...p, name: e.target.value }))}
                  className="h-7 text-[11px]"
                />
                <Input
                  placeholder="Industry"
                  value={newTenant.industry}
                  onChange={e => setNewTenant(p => ({ ...p, industry: e.target.value }))}
                  className="h-7 text-[11px] w-24"
                />
              </div>
              <div className="flex gap-1.5">
                <Input
                  placeholder="Floor"
                  value={newTenant.floor}
                  onChange={e => setNewTenant(p => ({ ...p, floor: e.target.value }))}
                  className="h-7 text-[11px] w-16"
                />
                <Input
                  placeholder="Sq Ft"
                  type="number"
                  value={newTenant.sqft}
                  onChange={e => setNewTenant(p => ({ ...p, sqft: e.target.value }))}
                  className="h-7 text-[11px] w-20"
                />
                <Input
                  placeholder="Lease exp (e.g. 6/2027)"
                  value={newTenant.leaseExpiration}
                  onChange={e => setNewTenant(p => ({ ...p, leaseExpiration: e.target.value }))}
                  className="h-7 text-[11px] flex-1"
                />
              </div>
              <div className="flex gap-1.5 justify-end">
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" className="h-6 text-[10px]" onClick={handleAddTenant} disabled={!newTenant.name.trim()}>
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-px">
        {visibleFloors.map((floor) => (
          <div
            key={floor.floor}
            className={`flex items-stretch gap-0 rounded-sm border overflow-hidden ${
              floor.tenants.length === 0 ? 'bg-muted/30 border-border' : 'border-border'
            }`}
          >
            <span className="w-5 shrink-0 text-[10px] font-bold text-muted-foreground flex items-center justify-center bg-background/50">
              {floor.floor}
            </span>
            <div className="flex-1 min-w-0">
              {floor.tenants.length === 0 ? (
                <div className="px-2 py-1">
                  <span className="text-[10px] italic text-muted-foreground/60">Vacant</span>
                </div>
              ) : (
                <div className="flex h-full">
                  {floor.tenants.map((t, i) => {
                    const totalSqft = floor.tenants.reduce((sum, tt) => sum + (tt.sqft || 1), 0);
                    const widthPct = totalSqft > 0 ? Math.max(((t.sqft || 1) / totalSqft) * 100, 20) : 100 / floor.tenants.length;
                    return (
                      <div
                        key={i}
                        className={`px-1.5 py-1 ${getUrgencyColor(t.urgency, t.isDb)} ${
                          i > 0 ? 'border-l border-border/50' : ''
                        }`}
                        style={{ width: floor.tenants.length > 1 ? `${widthPct}%` : '100%' }}
                      >
                        <div className="flex items-center justify-between gap-0.5">
                          <span className="text-[10px] font-medium text-foreground truncate">
                            {t.name}
                            {t.isDb && <span className="text-[8px] text-accent ml-0.5">✦</span>}
                          </span>
                          <span className="text-[8px] text-muted-foreground shrink-0">{t.leaseExpiration}</span>
                        </div>
                        {t.sqft > 0 && floor.tenants.length > 1 && (
                          <span className="text-[8px] text-muted-foreground">{(t.sqft / 1000).toFixed(0)}k SF</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 w-full text-center text-[10px] text-primary hover:underline"
        >
          +{floorData.length - 8} more floors
        </button>
      )}

      {/* DB tenants list for editing/removal */}
      {dbTenants.length > 0 && (
        <div className="mt-2 space-y-0.5">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
            Added ({dbTenants.length})
          </p>
          {dbTenants.map(dt => (
            editingTenant === dt.id ? (
              <div key={dt.id} className="rounded border border-accent/30 bg-accent/5 p-1.5 space-y-1">
                <div className="flex gap-1">
                  <Input placeholder="Name" value={editValues.tenant_name || ''} onChange={e => setEditValues(v => ({ ...v, tenant_name: e.target.value }))} className="h-6 text-[10px]" />
                  <Input placeholder="Industry" value={editValues.industry || ''} onChange={e => setEditValues(v => ({ ...v, industry: e.target.value }))} className="h-6 text-[10px] w-20" />
                </div>
                <div className="flex gap-1">
                  <Input placeholder="Floor" value={editValues.floor || ''} onChange={e => setEditValues(v => ({ ...v, floor: e.target.value }))} className="h-6 text-[10px] w-14" />
                  <Input placeholder="SF" type="number" value={editValues.sqft || ''} onChange={e => setEditValues(v => ({ ...v, sqft: Number(e.target.value) }))} className="h-6 text-[10px] w-16" />
                  <Input placeholder="Lease exp" value={editValues.lease_expiration || ''} onChange={e => setEditValues(v => ({ ...v, lease_expiration: e.target.value }))} className="h-6 text-[10px] flex-1" />
                  <Button size="sm" className="h-6 w-6 p-0" onClick={() => saveEdit(dt.id)}><Check className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingTenant(null)}><X className="h-3 w-3" /></Button>
                </div>
              </div>
            ) : (
              <div key={dt.id} className="flex items-center justify-between rounded px-1.5 py-0.5 bg-accent/5 text-[10px] group">
                <span className="text-foreground font-medium truncate">
                  {dt.tenant_name}
                  <span className="text-muted-foreground"> · Fl {dt.floor}</span>
                  {dt.sqft > 0 && <span className="text-muted-foreground"> · {(dt.sqft / 1000).toFixed(0)}k SF</span>}
                  {dt.lease_expiration && dt.lease_expiration !== 'N/A' && <span className="text-muted-foreground"> · {dt.lease_expiration}</span>}
                  {dt.source === 'upload' && <span className="text-primary/60 ml-1">📄</span>}
                </span>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => startEdit(dt)} className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => handleRemoveDb(dt.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-destructive/30" /> Urgent</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary/30" /> Medium</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-success/30" /> Stable</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-muted/50" /> Vacant</span>
        {dbTenants.length > 0 && (
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent/30" /> Added ✦</span>
        )}
      </div>
    </div>
  );
};

export default StackingPlan;

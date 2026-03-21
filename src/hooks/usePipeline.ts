import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { buildings } from '@/data/mockData';
import { digestEvent } from '@/lib/autoDigest';
import { toast } from 'sonner';
import type { PipelineStage, PipelineItem, Touchpoint } from '@/data/pipelineData';

type DbRow = {
  id: string;
  tenant_id: string;
  building_id: string;
  stage: string;
  notes: string[];
  last_activity: string;
  is_manual: boolean;
  prospect_name: string | null;
  prospect_company: string | null;
  prospect_email: string | null;
  prospect_phone: string | null;
  prospect_sqft: number | null;
  sent_touchpoints: any;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const rowToItem = (r: DbRow): PipelineItem => ({
  tenantId: r.tenant_id,
  buildingId: r.building_id,
  stage: r.stage as PipelineStage,
  notes: r.notes || [],
  lastActivity: r.last_activity,
  isManual: r.is_manual,
  prospectName: r.prospect_name || undefined,
  prospectCompany: r.prospect_company || undefined,
  prospectEmail: r.prospect_email || undefined,
  prospectPhone: r.prospect_phone || undefined,
  prospectSqft: r.prospect_sqft || undefined,
  sentTouchpoints: Array.isArray(r.sent_touchpoints) ? r.sent_touchpoints : [],
  sortOrder: r.sort_order ?? 0,
});

export function usePipeline() {
  const [pipeline, setPipeline] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPipeline = useCallback(async () => {
    const { data, error } = await supabase
      .from('pipeline_deals')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      toast.error('Failed to load pipeline');
      return;
    }

    const rows = (data || []) as unknown as DbRow[];
    const items = rows.map(rowToItem);

    // Seed mock tenants if pipeline is empty
    if (items.length === 0) {
      const allTenants = buildings.flatMap(b =>
        b.tenants.map(t => ({ tenantId: t.id, buildingId: b.id }))
      );
      const seedRows = allTenants.map(({ tenantId, buildingId }) => ({
        tenant_id: tenantId,
        building_id: buildingId,
        stage: 'meeting_set',
        notes: [] as string[],
        last_activity: new Date().toISOString(),
        is_manual: false,
        sent_touchpoints: [] as any[],
      }));

      if (seedRows.length > 0) {
        const { data: inserted } = await supabase
          .from('pipeline_deals')
          .insert(seedRows)
          .select('*');

        if (inserted) {
          setPipeline((inserted as unknown as DbRow[]).map(rowToItem));
        }
      }
    } else {
      setPipeline(items);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPipeline();

    // Realtime subscription for pipeline changes
    const channel = supabase
      .channel('pipeline-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipeline_deals' }, () => {
        fetchPipeline();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchPipeline]);

  const updateStage = useCallback(async (tenantId: string, buildingId: string, stage: PipelineStage) => {
    const item = pipeline.find(p => p.tenantId === tenantId && p.buildingId === buildingId);
    const { error } = await supabase
      .from('pipeline_deals')
      .update({ stage, last_activity: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('building_id', buildingId);

    if (error) {
      toast.error('Failed to update deal stage');
      return;
    }
    setPipeline(prev => prev.map(p =>
      p.tenantId === tenantId && p.buildingId === buildingId
        ? { ...p, stage, lastActivity: new Date().toISOString() }
        : p
    ));
    // Auto-digest: feed pipeline move to AI brain
    const name = item?.prospectName || item?.prospectCompany || tenantId;
    const prevStage = item?.stage || 'unknown';
    digestEvent('pipeline_moved', {
      prospect: name,
      tenantId,
      buildingId,
      previousStage: prevStage,
      newStage: stage,
      sqft: item?.prospectSqft || undefined,
      touchpoints: item?.sentTouchpoints?.length || 0,
    });
  }, [pipeline]);

  const addNote = useCallback(async (tenantId: string, buildingId: string, note: string) => {
    const item = pipeline.find(p => p.tenantId === tenantId && p.buildingId === buildingId);
    if (!item) return;
    const newNotes = [...item.notes, note];

    const { error } = await supabase
      .from('pipeline_deals')
      .update({ notes: newNotes, last_activity: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('building_id', buildingId);

    if (error) {
      toast.error('Failed to add note');
      return;
    }
    setPipeline(prev => prev.map(p =>
      p.tenantId === tenantId && p.buildingId === buildingId
        ? { ...p, notes: newNotes, lastActivity: new Date().toISOString() }
        : p
    ));
  }, [pipeline]);

  const addProspect = useCallback(async (prospect: {
    name: string; company: string; email: string; phone: string; sqft: string;
  }) => {
    const id = `manual-${Date.now()}`;
    const row = {
      tenant_id: id,
      building_id: 'manual',
      stage: 'meeting_set',
      notes: [] as string[],
      last_activity: new Date().toISOString(),
      is_manual: true,
      prospect_name: prospect.name.trim(),
      prospect_company: prospect.company.trim() || null,
      prospect_email: prospect.email.trim() || null,
      prospect_phone: prospect.phone.trim() || null,
      prospect_sqft: prospect.sqft ? parseInt(prospect.sqft) : null,
      sent_touchpoints: [] as any[],
    };

    const { data, error } = await supabase
      .from('pipeline_deals')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      toast.error('Failed to add prospect');
      return false;
    }
    if (data) {
      setPipeline(prev => [...prev, rowToItem(data as unknown as DbRow)]);
    }
    return true;
  }, []);

  const markTouchpointSent = useCallback(async (tenantId: string, buildingId: string, touchpoint: Touchpoint) => {
    const item = pipeline.find(p => p.tenantId === tenantId && p.buildingId === buildingId);
    if (!item) return;

    const sent: Touchpoint = {
      ...touchpoint,
      sentAt: new Date().toISOString(),
      followUpDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    };
    const newSent = [...(item.sentTouchpoints || []), sent];

    const { error } = await supabase
      .from('pipeline_deals')
      .update({
        sent_touchpoints: newSent as any,
        last_activity: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('building_id', buildingId);

    if (error) {
      toast.error('Failed to record touchpoint');
      return;
    }
    setPipeline(prev => prev.map(p =>
      p.tenantId === tenantId && p.buildingId === buildingId
        ? { ...p, sentTouchpoints: newSent, lastActivity: new Date().toISOString() }
        : p
    ));
  }, [pipeline]);

  const deleteDeal = useCallback(async (tenantId: string, buildingId: string) => {
    const { error } = await supabase
      .from('pipeline_deals')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('building_id', buildingId);

    if (error) {
      toast.error('Failed to delete deal');
      return;
    }
    setPipeline(prev => prev.filter(p => !(p.tenantId === tenantId && p.buildingId === buildingId)));
  }, []);

  const reorderInStage = useCallback(async (stage: PipelineStage, fromIndex: number, toIndex: number) => {
    const stageItems = pipeline
      .filter(p => p.stage === stage)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    if (fromIndex < 0 || toIndex < 0 || fromIndex >= stageItems.length || toIndex >= stageItems.length) return;

    const reordered = [...stageItems];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Optimistic update
    const updatedPipeline = pipeline.map(p => {
      if (p.stage !== stage) return p;
      const idx = reordered.findIndex(r => r.tenantId === p.tenantId && r.buildingId === p.buildingId);
      return idx >= 0 ? { ...p, sortOrder: idx } : p;
    });
    setPipeline(updatedPipeline);

    // Persist all sort orders for this stage
    await Promise.all(
      reordered.map((item, idx) =>
        supabase
          .from('pipeline_deals')
          .update({ sort_order: idx })
          .eq('tenant_id', item.tenantId)
          .eq('building_id', item.buildingId)
      )
    );
  }, [pipeline]);

  return { pipeline, loading, updateStage, addNote, addProspect, markTouchpointSent, deleteDeal, reorderInStage, refetch: fetchPipeline };
}

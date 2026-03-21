import { useState, useEffect, useMemo, useCallback } from 'react';
import { buildings } from '@/data/mockData';
import { getCustomProspectsAsync, type CustomProspect } from '@/data/customProspects';
import { usePipeline } from '@/hooks/usePipeline';
import type { PipelineStage } from '@/data/pipelineData';

export type ProspectRow = {
  id: string;
  source: 'mock' | 'custom';
  company: string;
  contact: string;
  contactEmail: string;
  contactTitle: string;
  sfNeed: number;
  pipelineStage: PipelineStage | null;
  lastActivity: string;
  signals: { type: string; urgency: 'high' | 'medium' | 'low'; title: string }[];
  industry: string;
  tenantId: string;
  buildingId: string;
  buildingName: string;
};

export type SortColumn = 'company' | 'contact' | 'sfNeed' | 'pipelineStage' | 'lastActivity' | 'industry';
export type SortDirection = 'asc' | 'desc';

export function useProspectTable() {
  const { pipeline, loading: pipelineLoading } = usePipeline();
  const [customProspects, setCustomProspects] = useState<CustomProspect[]>([]);
  const [customLoading, setCustomLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>('lastActivity');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getCustomProspectsAsync().then(prospects => {
      setCustomProspects(prospects);
      setCustomLoading(false);
    });
  }, []);

  // Build unified rows
  const allRows = useMemo<ProspectRow[]>(() => {
    const rows: ProspectRow[] = [];

    // Mock tenants from buildings
    for (const building of buildings) {
      for (const tenant of building.tenants) {
        const pipelineItem = pipeline.find(
          p => p.tenantId === tenant.id && p.buildingId === building.id
        );
        rows.push({
          id: `mock-${tenant.id}`,
          source: 'mock',
          company: tenant.name,
          contact: tenant.contactName,
          contactEmail: tenant.contactEmail,
          contactTitle: tenant.contactTitle,
          sfNeed: tenant.sqft,
          pipelineStage: pipelineItem?.stage ?? null,
          lastActivity: pipelineItem?.lastActivity ?? tenant.leaseExpiration,
          signals: tenant.outreachReasons.map(r => ({
            type: r.type,
            urgency: r.urgency,
            title: r.title,
          })),
          industry: tenant.industry,
          tenantId: tenant.id,
          buildingId: building.id,
          buildingName: building.name,
        });
      }
    }

    // Custom prospects
    for (const cp of customProspects) {
      const pipelineItem = pipeline.find(p => p.tenantId === cp.id);
      const enrichment = cp.enrichment;
      const signals: ProspectRow['signals'] = [];
      if (enrichment?.creSignals) {
        enrichment.creSignals.forEach(signal => {
          signals.push({ type: 'market_news', urgency: 'medium', title: signal });
        });
      }
      if (enrichment?.recentNews) {
        enrichment.recentNews.forEach(news => {
          const urgency = news.signal === 'high' ? 'high' : news.signal === 'low' ? 'low' : 'medium';
          signals.push({ type: 'market_news', urgency, title: news.headline });
        });
      }

      rows.push({
        id: cp.id,
        source: 'custom',
        company: cp.name,
        contact: enrichment?.keyContacts?.[0]?.name ?? '',
        contactEmail: '',
        contactTitle: enrichment?.keyContacts?.[0]?.title ?? '',
        sfNeed: enrichment?.spaceDetails?.currentSqft
          ? parseInt(enrichment.spaceDetails.currentSqft.replace(/[^0-9]/g, ''), 10) || 0
          : 0,
        pipelineStage: pipelineItem?.stage ?? null,
        lastActivity: pipelineItem?.lastActivity ?? cp.createdAt,
        signals,
        industry: enrichment?.industry ?? 'Unknown',
        tenantId: cp.id,
        buildingId: '',
        buildingName: enrichment?.spaceDetails?.buildingName ?? cp.address ?? '',
      });
    }

    return rows;
  }, [pipeline, customProspects]);

  // Extract unique filter options
  const industries = useMemo(() => {
    const set = new Set(allRows.map(r => r.industry));
    return Array.from(set).sort();
  }, [allRows]);

  const stages = useMemo(() => {
    const set = new Set(allRows.map(r => r.pipelineStage).filter(Boolean) as PipelineStage[]);
    return Array.from(set);
  }, [allRows]);

  // Filter
  const filteredRows = useMemo(() => {
    let rows = allRows;

    if (stageFilter !== 'all') {
      rows = rows.filter(r => r.pipelineStage === stageFilter);
    }
    if (industryFilter !== 'all') {
      rows = rows.filter(r => r.industry === industryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r =>
        r.company.toLowerCase().includes(q) ||
        r.contact.toLowerCase().includes(q) ||
        r.buildingName.toLowerCase().includes(q) ||
        r.industry.toLowerCase().includes(q)
      );
    }

    return rows;
  }, [allRows, stageFilter, industryFilter, searchQuery]);

  // Sort
  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'company':
          cmp = a.company.localeCompare(b.company);
          break;
        case 'contact':
          cmp = a.contact.localeCompare(b.contact);
          break;
        case 'sfNeed':
          cmp = a.sfNeed - b.sfNeed;
          break;
        case 'pipelineStage':
          cmp = (a.pipelineStage ?? '').localeCompare(b.pipelineStage ?? '');
          break;
        case 'lastActivity':
          cmp = new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime();
          break;
        case 'industry':
          cmp = a.industry.localeCompare(b.industry);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRows, sortColumn, sortDirection]);

  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === sortedRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedRows.map(r => r.id)));
    }
  }, [selectedIds, sortedRows]);

  return {
    rows: sortedRows,
    loading: pipelineLoading || customLoading,
    sortColumn,
    sortDirection,
    handleSort,
    stageFilter,
    setStageFilter,
    industryFilter,
    setIndustryFilter,
    searchQuery,
    setSearchQuery,
    industries,
    stages,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    totalCount: filteredRows.length,
  };
}

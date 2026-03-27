import { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type Table,
} from '@tanstack/react-table';
import { buildings } from '@/data/mockData';
import { getCustomProspectsAsync, type CustomProspect } from '@/data/customProspects';
import { supabase } from '@/integrations/supabase/client';
import { usePipeline } from '@/hooks/usePipeline';
import type { PipelineStage } from '@/data/pipelineData';

type DbProspect = {
  id: string;
  company_name: string;
  website_url: string | null;
  address: string | null;
  status: string | null;
  created_at: string;
};

export type ProspectRow = {
  id: string;
  source: 'mock' | 'custom' | 'db';
  company: string;
  buildingName: string;
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
};

// Keep the old SortColumn type exported so any remaining consumers don't break
export type SortColumn = 'company' | 'contact' | 'sfNeed' | 'pipelineStage' | 'lastActivity' | 'industry';
export type SortDirection = 'asc' | 'desc';

export type ProspectTableReturn = {
  table: Table<ProspectRow>;
  loading: boolean;
  globalFilter: string;
  setGlobalFilter: (v: string) => void;
  stageFilter: string;
  setStageFilter: (v: string) => void;
  industryFilter: string;
  setIndustryFilter: (v: string) => void;
  industries: string[];
  stages: PipelineStage[];
  totalCount: number;
};

const PAGE_SIZE = 25;

export function useProspectTable(): ProspectTableReturn {
  const { pipeline, loading: pipelineLoading } = usePipeline();
  const [customProspects, setCustomProspects] = useState<CustomProspect[]>([]);
  const [customLoading, setCustomLoading] = useState(true);
  const [dbProspects, setDbProspects] = useState<DbProspect[]>([]);
  const [dbLoading, setDbLoading] = useState(true);

  // TanStack table state
  const [sorting, setSorting] = useState<SortingState>([{ id: 'lastActivity', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');

  // Faceted filter state managed outside TanStack (simpler for Select dropdowns)
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [industryFilter, setIndustryFilter] = useState<string>('all');

  useEffect(() => {
    getCustomProspectsAsync().then(prospects => {
      setCustomProspects(prospects);
      setCustomLoading(false);
    });
  }, []);

  useEffect(() => {
    supabase
      .from('prospects')
      .select('id, company_name, website_url, address, status, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setDbProspects((data || []) as unknown as DbProspect[]);
        setDbLoading(false);
      });
  }, []);

  // Build unified rows from mock + custom sources
  const allRows = useMemo<ProspectRow[]>(() => {
    const rows: ProspectRow[] = [];

    for (const building of buildings) {
      for (const tenant of building.tenants) {
        const pipelineItem = pipeline.find(
          p => p.tenantId === tenant.id && p.buildingId === building.id,
        );
        rows.push({
          id: `mock-${tenant.id}`,
          source: 'mock',
          company: tenant.name,
          buildingName: building.name,
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
        });
      }
    }

    for (const cp of customProspects) {
      const pipelineItem = pipeline.find(p => p.tenantId === cp.id);
      const enrichment = cp.enrichment;
      const signals: ProspectRow['signals'] = [];

      enrichment?.creSignals?.forEach(signal => {
        signals.push({ type: 'market_news', urgency: 'medium', title: signal });
      });
      enrichment?.recentNews?.forEach(news => {
        const urgency = news.signal === 'high' ? 'high' : news.signal === 'low' ? 'low' : 'medium';
        signals.push({ type: 'market_news', urgency, title: news.headline });
      });

      rows.push({
        id: cp.id,
        source: 'custom',
        company: cp.name,
        buildingName: enrichment?.spaceDetails?.buildingName ?? cp.address ?? '',
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
      });
    }

    // Add rows from the prospects table (Supabase)
    for (const dbp of dbProspects) {
      // Avoid duplicating if already represented in custom_prospects
      if (customProspects.some(cp => cp.id === dbp.id)) continue;

      const pipelineItem = pipeline.find(p => p.tenantId === dbp.id);
      rows.push({
        id: dbp.id,
        source: 'db',
        company: dbp.company_name,
        buildingName: dbp.address || '',
        contact: '',
        contactEmail: '',
        contactTitle: '',
        sfNeed: 0,
        pipelineStage: pipelineItem?.stage ?? null,
        lastActivity: pipelineItem?.lastActivity ?? dbp.created_at,
        signals: [],
        industry: dbp.status || 'Unknown',
        tenantId: dbp.id,
        buildingId: '',
      });
    }

    return rows;
  }, [pipeline, customProspects, dbProspects]);

  // Apply faceted filters (stage + industry) before handing to TanStack
  const facetedRows = useMemo(() => {
    let rows = allRows;
    if (stageFilter !== 'all') rows = rows.filter(r => r.pipelineStage === stageFilter);
    if (industryFilter !== 'all') rows = rows.filter(r => r.industry === industryFilter);
    return rows;
  }, [allRows, stageFilter, industryFilter]);

  // Derived filter options from the full dataset (not faceted) so dropdowns always show all options
  const industries = useMemo(() => {
    return Array.from(new Set(allRows.map(r => r.industry))).sort();
  }, [allRows]);

  const stages = useMemo(() => {
    return Array.from(
      new Set(allRows.map(r => r.pipelineStage).filter(Boolean) as PipelineStage[]),
    );
  }, [allRows]);

  // Column definitions — no cell renderers here; rendering stays in the page component
  const columns = useMemo<ColumnDef<ProspectRow>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        enableHiding: false,
        // header/cell rendered directly in page using table.getState().rowSelection
      },
      {
        accessorKey: 'company',
        header: 'Company',
        enableGlobalFilter: true,
      },
      {
        accessorKey: 'buildingName',
        header: 'Building',
        enableGlobalFilter: true,
      },
      {
        accessorKey: 'contact',
        header: 'Contact',
        enableGlobalFilter: true,
      },
      {
        accessorKey: 'sfNeed',
        header: 'SF Need',
        enableGlobalFilter: false,
      },
      {
        accessorKey: 'pipelineStage',
        header: 'Stage',
        enableGlobalFilter: false,
      },
      {
        accessorKey: 'lastActivity',
        header: 'Last Activity',
        enableGlobalFilter: false,
      },
      {
        accessorKey: 'industry',
        header: 'Industry',
        enableGlobalFilter: true,
      },
      {
        id: 'signals',
        header: 'Signals',
        enableSorting: false,
        enableHiding: true,
        enableGlobalFilter: false,
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableHiding: false,
        enableGlobalFilter: false,
      },
    ],
    [],
  );

  const table = useReactTable<ProspectRow>({
    data: facetedRows,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const q = filterValue.toLowerCase();
      return (
        row.original.company.toLowerCase().includes(q) ||
        row.original.contact.toLowerCase().includes(q) ||
        row.original.buildingName.toLowerCase().includes(q) ||
        row.original.industry.toLowerCase().includes(q)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: PAGE_SIZE, pageIndex: 0 },
    },
  });

  return {
    table,
    loading: pipelineLoading || customLoading || dbLoading,
    globalFilter,
    setGlobalFilter,
    stageFilter,
    setStageFilter,
    industryFilter,
    setIndustryFilter,
    industries,
    stages,
    totalCount: facetedRows.length,
  };
}
